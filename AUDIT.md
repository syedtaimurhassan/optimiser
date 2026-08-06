# M0 Audit — Route Optimiser

Date: 2026-08-06 · Commit: `31b8cfa` · Auditor: Claude (Opus 5)

Everything below was verified against source or measured. Where I could not
verify something, it says so rather than repeating the existing documentation.

---

## 0. Headline

Three things changed my picture of this project:

1. **The per-arc FFI claim is wrong.** Arc costs are read from a native int64
   matrix inside WASM during search — there is no JS callback on the inner loop.
   The real cost is an N² callback sweep **once per solve attempt**, and the
   project's central performance story needs rewriting around that.
2. **Cross-origin isolation is droppable, today, for a one-line build patch.**
   Shared memory is not the blocker; posting it to Emscripten's pthread pool is.
   Set the pool to zero and the solver runs with `crossOriginIsolated === false`,
   producing **byte-identical results on all 20 benchmark configs**.
3. **There is a live memory-exhaustion bug.** or-tools-wasm never frees native
   routing models in a browser. The optimizer dies with `std::bad_alloc` on the
   **12th consecutive Calculate** and stays dead until reload. This affects the
   deployed app right now.

---

## 1. Claim verification

| # | Claim | Verdict | What's actually true |
|---|---|---|---|
| 1 | Per-arc JS closure FFI crossing in `lib/solver.ts` | ❌ **False** | `SolveWithParameters` calls `installMatrixEvaluator()` **before** solving. That materialises the whole matrix into WASM heap and registers `_routing_register_matrix_transit_callback` — a **native** evaluator — then overrides the arc-cost evaluator with it. During search, OR-Tools reads a C++ array. The JS closure is called exactly (n+2)² times per attempt, up front. See §2. |
| 2 | Per-attempt `RoutingIndexManager` + `RoutingModel` allocation | ✅ **True** | [solver.ts:179-180](src/lib/solver.ts#L179-L180) constructs both inside `runOnce`, called once per attempt (≤400/solve). Worse than documented — see claim 8. |
| 3 | Per-restart N×N matrix copy | ✅ **True** | [solver.ts:142-148](src/lib/solver.ts#L142-L148) `noiseMatrix` allocates a fresh N×N via nested `.map` on every GRASP restart. |
| 4 | `or-tools-wasm@0.9.1` does not serialize `local_search_metaheuristic` or `time_limit` | ✅ **True** (with a correction) | Code path in §3. Only `firstSolutionStrategy` and `solution_limit` reach the ccall. **Correction:** `local_search_metaheuristic?: LocalSearchMetaheuristic` *is* declared in `routing.d.ts` and is inert, but `time_limit` is **not in the type at all** — the string appears 0 times in the shipped JS and 0 times in the `.d.ts`. So there is no misleading `time_limit` field to be fooled by; only GLS is declared-but-ignored. |
| 5 | Exact constants | ✅ **All confirmed** | Table in §4. |
| 6 | `App.css`, `react.svg`, `vite.svg`, `hero.png` are dead | ✅ **True** | Zero references across `src/`, `index.html`, `vite.config.ts`, `package.json`. Note `App.css`'s own comment claims *"Kept as a placeholder so the import in main.tsx / App.tsx stays valid"* — that import no longer exists; the comment is stale. |
| 7 | `prune-wasm.mjs` behaviour | ✅ **True** | Measured: **151 MB → 16 MB**, 26 of 31 asset files removed, 141 MB freed. Survivors in §5. |
| 8 | *(new)* Native routing models are never freed in browsers | ⚠️ **New defect** | §6. |

---

## 2. What actually costs what (claim 1, in detail)

`RoutingModel.SolveWithParameters` → `installMatrixEvaluator()`:

```js
installMatrixEvaluator() {
  const matrix = this.buildTransitMatrix();                    // ← N² JS callback calls
  const matrixBytes = new Uint8Array(matrix.buffer, …);
  const matrixPtr = this.module._malloc(matrixBytes.byteLength); // ← N²·8 bytes into WASM heap
  this.module.HEAPU8.set(matrixBytes, matrixPtr);
  const evaluatorIndex = this.module._routing_register_matrix_transit_callback(
    this.handle, matrixPtr, matrix.length, this.manager.GetNumberOfIndices());
  this.module._routing_set_arc_cost_evaluator_of_all_vehicles(this.handle, evaluatorIndex);
  …
}
```

and `buildTransitMatrixFromCallback`:

```js
const matrix = new BigInt64Array(dimension * dimension);
for (let from = 0; from < dimension; from++)
  for (let to = 0; to < dimension; to++)
    matrix[from * dimension + to] = toInt64(callback(from, to));   // BigInt per cell
```

So the real per-attempt cost is:

- **(n+2)² JS→WASM callback invocations**, each allocating a **BigInt**
- a **(n+2)²·8-byte** `BigInt64Array`, plus the same again `_malloc`'d in WASM

For the 107-point instance that is ~11,900 calls and ~95 KB **per attempt**, and
an attempt is cheap enough that a 3 s budget runs hundreds of them. The
allocation churn is real and roughly an order of magnitude worse than the
existing docs describe — but it is *per attempt*, not *per arc*, and it happens
*before* the search, not during it.

**Consequence for M1:** the fix is not "escape the FFI." It is "stop rebuilding
the model." Any engine that keeps one model and mutates a solution in place —
which a plain TypeScript local search does naturally — avoids this entirely.

### Untested corollary ⚠️

The docs justify excluding `BEST_INSERTION`/`CHRISTOFIDES` from the portfolio by
the per-arc FFI cost. That justification is now void. Whether the *observation*
(>12 s on a 10-node model) still holds was **not re-tested** — it needs a seam
that can drive a single named strategy, which M0 didn't build. Given a 10-node
model is only 144 callback calls, the cost cannot be FFI, so it is more likely
genuine OR-Tools cost on models with disjunctions. **Cheap M1 experiment with
real upside:** if those strategies are usable, the portfolio widens for free.

---

## 3. The parameter-serialization code path (claim 4)

`node_modules/or-tools-wasm/build/javascript/node/routing.js` (browser build is
byte-identical on this path — verified, both contain the same 3 call sites):

```js
async SolveWithParameters(parameters = DefaultRoutingSearchParameters()) {
  …
  const ok = await this.module.ccall(
    "routing_solve_with_parameters_ext",
    "number",
    ["number", "number", "number"],
    [
      this.handle,
      parameters.firstSolutionStrategy ?? 0,   // ← only these two
      parameters.solution_limit ?? 0           // ←
    ],
    { async: true }
  );
```

Three arguments. `local_search_metaheuristic` is declared in the public type and
never read. Confirmed by count: `local_search_metaheuristic` appears **0 times**
in both `browser/routing.js` and `node/routing.js`; `time_limit` appears **0
times** in both, and 0 times in `lib/routing.d.ts`.

**The multi-start portfolio is therefore load-bearing, exactly as documented.**
OR-Tools here is a construction heuristic with no local search whatsoever.

---

## 4. Constants (claim 5)

| Constant | Value | Location |
|---|---|---|
| `MAX_TABLE_POINTS` | `300` | [routingService.ts:51](src/lib/routingService.ts#L51) |
| `OSRM_TABLE_MAX_CELLS` | `10_000` | [routingService.ts:47](src/lib/routingService.ts#L47) |
| `OSRM_MIN_REQUEST_GAP_MS` | `1_100` | [routingService.ts:49](src/lib/routingService.ts#L49) |
| `UNREACHABLE_COST` | `9_999_999` | [routingService.ts:12](src/lib/routingService.ts#L12) |
| `SKIP_PENALTY` | `10_000_000` | [solver.ts:14](src/lib/solver.ts#L14) |
| `FORBIDDEN` | `1_000_000_000` | [solver.ts:17](src/lib/solver.ts#L17) |
| `DEFAULT_TIME_BUDGET_MS` | `3000` | [solver.ts:20](src/lib/solver.ts#L20) |
| `NOISE_FRACTION` | `0.25` | [solver.ts:26](src/lib/solver.ts#L26) |
| `MAX_ATTEMPTS` | `400` | [solver.ts:23](src/lib/solver.ts#L23) |
| patience | `Math.max(30, 3 * n)` | [solver.ts:277](src/lib/solver.ts#L277) |
| `SEARCH_BUDGET_MS` | fast `1000` / deep `3000` / maximum `5000` | [routeStore.ts:60-64](src/store/routeStore.ts#L60-L64) |

`PORTFOLIO`, in order ([solver.ts:42-50](src/lib/solver.ts#L42-L50)):

1. `PATH_CHEAPEST_ARC` 2. `PARALLEL_CHEAPEST_INSERTION`
3. `SEQUENTIAL_CHEAPEST_INSERTION` 4. `LOCAL_CHEAPEST_INSERTION`
5. `GLOBAL_CHEAPEST_ARC` 6. `SAVINGS` 7. `PATH_MOST_CONSTRAINED_ARC`

### Two constant-ordering smells 🔎

- **`UNREACHABLE_COST` (9,999,999) < `SKIP_PENALTY` (10,000,000)** — one unit
  apart. Traversing a road OSRM says does not exist is *cheaper* than skipping a
  stop, so on a disconnected input the solver will happily route through
  impossible arcs. The K cap usually masks it. Worth widening the gap.
- **Pass 1 always runs at least two strategies** regardless of budget:
  `if (s > 0 && Date.now() >= deadline && best) break` checks the deadline only
  *after* a solve ([solver.ts:283](src/lib/solver.ts#L283)), so a single slow
  strategy can overrun the ceiling. This is why the tier is a ceiling "except
  when it isn't."

---

## 5. Runtime variant inventory (Task 2)

`or-tools-wasm@0.9.1` ships **7 solvers × 2 variants** for the browser
(`build/javascript/wasm/`), plus a parallel `node-wasm/` set for Node.

Variants are **plain** (JSPI) and **`_asyncify`**. The app forces asyncify via
`setWorkerBridgeEnabled(false)`; `prune-wasm.mjs` deletes all others.

**Every single one is a pthread build.** I parsed the WebAssembly import
sections directly (limits flag bit 1 = shared):

| Module (browser) | Memory | Shared | Pages |
|---|---|---|---|
| `cp_sat_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `graph_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `mathopt_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `mp_solver_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `pdlp_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `routing_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |
| `set_cover_runtime{,_asyncify}` | imported `env.memory` | **YES** | 256 → 32768 |

**There is no non-pthread variant to switch to.** The glue's
`if (Module["wasmMemory"])` injection point is useless, because the module
*imports* its memory with the shared flag set and instantiation would reject a
non-shared one.

`prune-wasm.mjs` survivors (16 MB total): `routing_runtime_asyncify.wasm` (15 MB),
`index.js` (704 K), `routing_runtime_asyncify.js` (188 K), `index.css` (43 K),
`ortools_worker.js` (19 K).

---

## 6. 🔴 New defect: WASM heap exhaustion after 12 solves

`RoutingModel.delete()`:

```js
if (this.handle !== 0) {
  if (this.module && canDeleteNativeRoutingModel()) {
    this.module._routing_delete_model(this.handle);
  }
  this.handle = 0;
}
```

and:

```js
function canDeleteNativeRoutingModel() {
  return !isDenoRuntime() && !isBrowserRuntime();
}
```

**In a browser this is always `false`.** `routing.delete()` clears the JS-side
callback registry but the native `RoutingModel` is deliberately never freed.
`solver.ts` calls `routing.delete()` in a `finally` and is right to — the library
simply declines to act on it.

Every attempt leaks a model. Measured on `uniform-n25-k23` at the Deep (3 s)
tier, no page reload:

> **Died on solve #12 with `std::bad_alloc`, after 11 successes.** The Emscripten
> module then aborts permanently (`Aborted(native code called abort())`) and
> every later solve fails until the page is reloaded.

Small instances are the harsh case, counter-intuitively: cheap attempts mean more
attempts per second, so more leaked models. My first benchmark run tripped over
this and produced 15 bogus `FAILED` rows before I isolated each config on a fresh
page — worth knowing, because it will bite anyone benchmarking this.

**User impact:** press Calculate ~12 times on a small route in one session and the
optimizer is dead with no recovery but a refresh. Nothing in the UI explains it.

**Mitigations** (M1 decides): reload/recreate the WASM module every N solves;
cap `MAX_ATTEMPTS` far lower; or — the real fix — stop rebuilding models.

---

## 7. 🟢 The escape hatch: cross-origin isolation IS droppable

### How it actually fails

With `coi-serviceworker.js` 404'd (probe, Chromium 149):

| Probe | Result |
|---|---|
| `crossOriginIsolated` | `false` |
| `SharedArrayBuffer` global | `undefined` |
| `new WebAssembly.Memory({shared:true})` | ✅ **succeeds** — buffer *is* a `SharedArrayBuffer`, growable, `Atomics` work |
| `worker.postMessage(sharedMemory)` | ❌ `Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.` |
| `initRouting()` | ❌ **hangs forever** — `still waiting on run dependencies: loading-workers` |

So shared memory is **not** the blocker. The blocker is one call: Emscripten's
pthread pool posting `wasmMemory` to its workers. When that throws, the
`loading-workers` run dependency is never cleared, and initialisation never
settles — it doesn't even fail, it just hangs. (Our own guard in `solver.ts`
turns that hang into an error message, which is more valuable than it looks.)

### The fix

```js
initMainThread(){var pthreadPoolSize=4;while(pthreadPoolSize--){PThread.allocateUnusedWorker()}}
//                                   ↑ set to 0
```

No workers allocated → nothing posted → no run dependency → init completes.
The solver is single-threaded anyway (`setWorkerBridgeEnabled(false)`), so
nothing is lost. If native code ever did call `pthread_create`, Emscripten's own
`_emscripten_has_threading_support()` already returns false without a
`SharedArrayBuffer` global, so it would fail loudly rather than corrupt state.

Implemented reproducibly as [bench/patch-pthread-pool.mjs](bench/patch-pthread-pool.mjs).

### The evidence

Full 20-config grid, `dist-bench-nocoi`, `crossOriginIsolated: false`:

```
identical: 20   B better: 0   B worse: 0
→ Every objective matches exactly. The two configurations are equivalent.
```

Cold warm-up was *faster* without isolation (63 ms vs 90 ms) — no worker pool to
spin up. Reproduce with `npm run bench:nocoi && node bench/compare.mjs baseline-ortools.json ortools-nocoi.json`.

### Verdict: **can we drop cross-origin isolation?**

> ## Yes — and I'd do it in M1, not later.

It unblocks Safari and Firefox, deletes `coi-serviceworker.js`, deletes the
forced reload, deletes the `crossOriginIsolated` guard and its scary error
message, and frees the root service-worker scope that M5's PWA needs. Measured
cost: zero — same answers, faster init.

**The one caveat, stated plainly:** the patch is a post-build byte rewrite of
vendored glue, and `bench/patch-pthread-pool.mjs` fails loudly if the needle
disappears. Shipping it means a Vite plugin doing the same rewrite. That is
acceptable but it is not *clean*. Cleaner options, in order of preference:

1. **Rebuild or-tools-wasm without `-pthread`.** The upstream build repo is
   already vendored at `or-tools-wasm-stable/` — though its
   `scripts/build_wasm.sh` contains no pthread flag I could find, so the flag
   lives elsewhere (likely CMake/Emscripten defaults). Needs an Emscripten
   toolchain; worth one timeboxed attempt.
2. **Ask upstream** to publish a single-threaded variant.
3. **Ship the build-time patch** as the pragmatic default.

And note this is only worth doing at all *if OR-Tools survives M1*. If the pure
TypeScript engine wins the benchmark, all of this — WASM, isolation, patch,
16 MB — is deleted outright, which is the better outcome.

---

## 8. Baseline numbers (Task 4)

`bench/results/baseline-ortools.json` · Chromium 149.0.7827.55 · darwin/arm64 ·
median of 3 reps · fresh page per config · **real OSRM duration matrix** for the
`sample` family.

Objective is split into its two parts for readability
(`objective = travel + 10,000,000 × skipped`).

| Instance | Tier | Wall ms | Travel cost | Skipped | Visited |
|---|---|---|---|---|---|
| `sample-n107-k20` | deep | 3028 | 1,489 | 85 | 22/107 |
| `sample-n107-k50` | deep | 3106 | 4,336 | 55 | 52/107 |
| `sample-n107-k105` | deep | 3088 | 12,574 | 0 | 107/107 |
| `uniform-n25-k23` | deep | 1375 | 73,530 | 0 | 25/25 |
| `uniform-n25-k11` | deep | 1064 | 25,561 | 12 | 13/25 |
| `clustered-n25-k23` | deep | 2396 | 54,702 | 0 | 25/25 |
| `clustered-n25-k11` | deep | 1114 | 22,319 | 12 | 13/25 |
| `decoy-n25-k9` | deep | 1016 | 19,795 | 14 | 11/25 |
| `uniform-n50-k48` | deep | 3029 | 94,433 | 0 | 50/50 |
| `uniform-n50-k24` | deep | 3000 | 39,375 | 24 | 26/50 |
| `clustered-n50-k48` | deep | 3040 | 54,459 | 0 | 50/50 |
| `clustered-n50-k24` | deep | 3019 | 30,356 | 24 | 26/50 |
| `decoy-n50-k19` | deep | 3021 | 20,495 | 29 | 21/50 |
| `uniform-n107-k105` | deep | 3011 | 140,032 | 0 | 107/107 |
| `uniform-n107-k52` | deep | 3045 | 58,571 | 53 | 54/107 |
| `clustered-n107-k105` | deep | 3160 | 81,225 | 0 | 107/107 |
| `clustered-n107-k52` | deep | 3102 | 35,109 | 53 | 54/107 |
| `decoy-n107-k42` | deep | 3034 | 23,033 | 63 | 44/107 |
| `sample-n107-k50` | **fast** | 1038 | 4,336 | 55 | 52/107 |
| `sample-n107-k50` | **maximum** | 5037 | 4,336 | 55 | 52/107 |

All 20 structurally valid (endpoints fixed correctly, no repeats, K respected).
Cold WASM warm-up: **90 ms** (already cached by the HTTP layer — this is *not*
the 16 MB download).

### What the baseline says

**🔴 The search budget buys nothing.** `sample-n107-k50` scores **4,336 at every
tier** — 1 s, 3 s and 5 s are identical. The 5 s run spent its full budget
(5037 ms) and found no improvement, so this is not early convergence; it is a
local optimum that GRASP restarts cannot escape. **Four fifths of the Maximum
tier's wall-clock is wasted.** The tier control is, on this instance, a placebo.

That is the strongest possible argument for M1's direction: what's missing is not
more restarts, it's *local search*. Or-opt and 2-opt would attack precisely the
structure that repeated construction keeps rebuilding.

**Wall time tracks the budget, not the problem.** Everything at n≥50 runs the
full 3 s. Only small instances converge early (`uniform-n25-k11` at 1064 ms) via
the patience rule.

**Memory numbers are not usable.** `peakJsHeapBytes` reported a flat 57.5 MB for
every config — Chrome quantises `performance.memory` for security, and it
excludes WASM linear memory, which is where this engine's real consumption lives.
`performance.measureUserAgentSpecificMemory()` would cover WASM but requires
cross-origin isolation, which is exactly what we're trying to delete. **Treat
memory as unmeasured;** §6's endurance probe is the honest proxy.

### The bar for M1

The TypeScript engine must, on the same instances:

- match or beat every **travel cost** above (skip counts should match exactly —
  K is a hard cap, so any difference means a bug), and
- do it without leaking, and
- ideally show a *falling* objective as the tier rises, which OR-Tools does not.

---

## 9. Dead files (claim 6) — noted, not removed

Per M0's instruction these stay until M1:

- `src/App.css` — empty; its comment references an import that no longer exists
- `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`
- `or-tools-wasm-stable/` — vendored upstream build repo, unreferenced by app or
  build. **Keep for now:** it's the starting point for the non-pthread rebuild in
  §7. It is also being linted (it dominates `npm run lint` output) — worth an
  oxlint ignore regardless of what happens to it.

---

## 10. Coordinate-as-identity — a latent bug M2 must fix

Not in M0's brief but it surfaced while reading, and it constrains the plan:
**28 sites** across 5 files key stop identity on float coordinate equality
(`sameCoord`, `ckey`, `markDeliveredByCoord`) rather than on `Stop.id`, which
already exists.

Two stops at one address — normal the moment addresses arrive in M3 — are
indistinguishable. Marking one delivered marks both; the map merges them into one
marker. Fix this in M2, *before* the UI is rebuilt on top of it.

---

## 11. Recommendations

| # | Action | When | Why |
|---|---|---|---|
| 1 | Build the pure-TypeScript engine and benchmark it against §8 | **M1** | The budget-buys-nothing result says local search is the missing ingredient |
| 2 | Drop cross-origin isolation | **M1** | Proven free; unblocks Safari/Firefox and M5's service worker |
| 3 | Fix or contain the `bad_alloc` leak | **M1** | Live bug in production; if the TS engine wins, it evaporates |
| 4 | Timeboxed attempt at a non-pthread or-tools rebuild | **M1, optional** | Only worth it if OR-Tools survives the benchmark |
| 5 | Re-test `BEST_INSERTION`/`CHRISTOFIDES` | **M1, cheap** | Their exclusion rests on a now-disproven explanation |
| 6 | Widen the `UNREACHABLE_COST` ↔ `SKIP_PENALTY` gap | M1 | 1-unit margin lets impossible arcs beat skipping |
| 7 | Move identity to `Stop.id` | **M2** | Blocks correct address support |
| 8 | Add `or-tools-wasm-stable/` to `.oxlintrc.json` ignores | M1 | It drowns the lint signal |

---

## Appendix — how to reproduce

```bash
npm run bench:fixtures     # once: cache the real OSRM matrix (2 requests, ~3 s)
npm run bench              # full grid + COI probe + endurance → bench/results/
npm run bench:nocoi        # same grid on the pthread-patched, un-isolated build
node bench/compare.mjs baseline-ortools.json ortools-nocoi.json
npm run bench:verify-seam  # asserts the test seam is absent from production output
```

The harness serves the **pruned production bundle** from a deliberately
header-less static server (`bench/lib/server.mjs`) — GitHub Pages sends no
COOP/COEP and offers no way to add them, so anything else would measure a host we
don't deploy to.

Engines register by name in [src/benchSeam.ts](src/benchSeam.ts) behind
`VITE_BENCH_SEAM`; scoring is done in Node by [bench/lib/objective.mjs](bench/lib/objective.mjs),
never by the engine itself, and every result is structurally validated before it
is allowed to count.
