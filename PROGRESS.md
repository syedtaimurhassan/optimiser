# PROGRESS

Running log, newest milestone last. One entry per milestone: what changed, what's
verified, what's deferred, what surprised me, what the next session needs.

---

## M0 — Audit, baseline, and the cross-origin-isolation experiment

**Date:** 2026-08-06 · **Branch:** `main` · **Base commit:** `31b8cfa`

Knowledge-and-harness milestone. No production behaviour changed.

### What changed

**Added**

- `AUDIT.md` — claim verification, runtime inventory, the no-COI experiment, baseline analysis
- `DEVICE-SMOKE-TEST.md` — the manual Android/iPhone checklist (**you run this**)
- `bench/` — harness: `run.mjs`, `compare.mjs`, `fetch-fixtures.mjs`,
  `patch-pthread-pool.mjs`, `verify-seam.mjs`, `lib/{objective,instances,server,rng}.mjs`,
  `README.md`, committed `results/`
- `src/benchSeam.ts` — engine registry, bench builds only
- `PROGRESS.md` — this file

**Modified (minimally, on purpose)**

- `src/main.tsx` — 4-line guarded seam import behind `VITE_BENCH_SEAM`
- `scripts/prune-wasm.mjs` — accepts an optional target dir (default unchanged)
- `package.json` — bench scripts
- `.gitignore` — `dist-bench`, `dist-seamcheck`

No component, store, data-model or solver logic was touched.

### Verified

- 6 of 7 documented claims hold; **the per-arc FFI claim does not** (AUDIT §1–2)
- OR-Tools genuinely has no local search — only `firstSolutionStrategy` and
  `solution_limit` reach the WASM (AUDIT §3, with the code path)
- All 11 constants + the PORTFOLIO order confirmed exactly (AUDIT §4)
- `prune-wasm.mjs`: 151 MB → 16 MB, measured
- All 14 browser WASM variants are pthread builds — verified by parsing the
  import sections, not by reading docs
- Baseline recorded: 20 configs, 3 reps, real OSRM matrix, all structurally valid
- Seam is absent from production output (`npm run bench:verify-seam`)
- `npm run lint` and `npm run build` pass

### The three things that surprised me

1. **There is no per-arc FFI crossing.** `SolveWithParameters` uploads the whole
   matrix to WASM and registers a *native* evaluator before searching. The real
   cost is an N² BigInt callback sweep **per solve attempt** (~11,900 calls and
   ~95 KB for the 107-point instance, hundreds of times per solve). The project's
   central performance narrative was pointing at the wrong thing. The fix isn't
   "escape the FFI", it's "stop rebuilding the model".

2. **Cross-origin isolation is droppable for a one-line patch.** Shared memory
   constructs fine without isolation; what fails is `postMessage`-ing it to
   Emscripten's pthread pool, after which init *hangs* rather than errors. Set
   the pool size to 0 and the solver runs with `crossOriginIsolated === false` —
   **20/20 configs byte-identical**, and warm-up is *faster* (63 ms vs 90 ms).

3. **🔴 A live bug: the optimizer dies on the 12th consecutive Calculate.**
   or-tools-wasm's `canDeleteNativeRoutingModel()` returns false in browsers, so
   native routing models are never freed. `std::bad_alloc`, then the module
   aborts permanently until reload. This is in production today. I found it by
   accident — my first benchmark run produced 15 bogus failures before I worked
   out the harness itself was tripping over it.

Runner-up: **the search budget buys nothing.** `sample-n107-k50` scores
identically at 1 s, 3 s and 5 s, with the 5 s run spending its full budget and
finding no improvement. The tier control is a placebo on that instance.

### Deferred

- Dead files (`App.css`, three assets) — noted, removal is M1's per instructions
- `BEST_INSERTION`/`CHRISTOFIDES` re-test — needs a per-strategy seam; their
  exclusion now rests on a disproven explanation, so it's worth a cheap M1 retest
- Non-pthread rebuild of or-tools-wasm — one timeboxed M1 attempt, only if
  OR-Tools survives the M1 benchmark
- Memory measurement — `performance.memory` is quantised (flat 57.5 MB for every
  config) and excludes WASM heap; the accurate API needs the isolation we're
  removing. Endurance-to-failure is the honest proxy for now
- Coordinate-as-identity bug (28 sites, 5 files) — M2, before the UI rebuild

### What the next session needs to know

1. **Run `DEVICE-SMOKE-TEST.md` on real hardware.** The iPhone
   `crossOriginIsolated` answer is the one open empirical question. It no longer
   blocks M1 — the pthread patch works regardless — but it tells us whether the
   *currently deployed* app is usable on iOS at all.
2. **`bench/results/baseline-ortools.json` is the bar.** The TS engine must match
   or beat every travel cost, with skip counts matching *exactly* (K is a hard
   cap — any difference is a bug).
3. **Watch for the `bad_alloc` trap when benchmarking.** Always reload between
   configs, or you'll measure corpses. The harness already does this.
4. **The decoy family and the flat budget curve are the two signals to aim at.**
   If the TS engine shows a falling objective as the tier rises, that alone
   justifies the rewrite.
5. Design constraint for the TS solver: **the real OSRM matrix is 98.3%
   asymmetric.** Textbook 2-opt's O(1) reversal delta is invalid — either
   recompute reversed segments explicitly or use orientation-preserving moves
   (Or-opt) as the backbone.

### Open questions for you

- Commit `DOCUMENTATION.md`? It's untracked, and AUDIT.md now contradicts it in
  two places (the FFI claim, the `time_limit` type claim).
- `vite-plugin-pwa` at M5 — still the one dependency I'd like to add.
