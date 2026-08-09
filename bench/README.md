# bench/

The instrument we use to decide whether a change to the solver was actually an
improvement. It exists so that "the new engine is better" is a measurement rather
than an opinion.

## Run it

```bash
npm run bench:fixtures   # once — caches the real OSRM matrix for the 107-pt sample
npm run bench            # build + COI probe + full grid + endurance probe
```

Results land in `bench/results/` as JSON, plus a summary table on stdout.

| Command | What it does |
|---|---|
| `npm run bench` | Full grid, **every engine**, 3 reps, median reported |
| `npm run bench -- --quick` | One rep, 1 config — smoke test while iterating |
| `npm run bench -- --engine=ts` | One engine only (comma-separate for several) |
| `npm run bench:tsplib:fetch` | Once — caches the TSPLIB instances (gitignored) |
| `npm run bench:tsplib` | **Gap to proven optimum** on the standard library |
| `npm run bench -- --probe-only` | Just the cross-origin-isolation probe |
| `npm run bench -- --headed` | Watch the browser do it |
| `npm run bench:nocoi` | Full grid on a pthread-patched, un-isolated build |
| `npm run bench:verify-seam` | Asserts the test seam is absent from production output |
| `node bench/compare.mjs a.json b.json` | Config-by-config diff of two reports |

## How it's set up, and why

**It measures the real artifact.** The harness serves the *pruned production
bundle* (`dist-bench`, built exactly like `dist` plus a seam flag) from a
deliberately header-less static server. GitHub Pages sends no COOP/COEP headers
and gives you no way to add them, so a server that sent them would be measuring a
host we don't deploy to.

**The engine never grades its own work.** Engines return a visited-node sequence
and nothing else — this holds INSIDE an engine too, since the worker pool
re-validates and re-scores every worker's answer before letting it win. Node
scores it via `lib/objective.mjs` —
`travel + SKIP_PENALTY × unvisited`, the same formula for every engine — after
`validate()` has checked the structure: indices in range, no repeats, fixed
endpoints in position, K cap respected. An invalid result cannot post a good
score.

**Every config gets a fresh page.** or-tools-wasm never frees native routing
models in a browser, so the WASM heap grows until `std::bad_alloc` aborts the
module (see AUDIT.md §6). Without a reload between configs, config #3 onwards
measures the wreckage of config #2 rather than anything real.

**Instances are seeded.** `lib/rng.mjs` is the same mulberry32 the production
solver uses, so a given seed reproduces the same instance everywhere.

## Instance families

| Family | Shape | What it's for |
|---|---|---|
| `uniform` | Scatter over a ~20 km box | Well-conditioned control |
| `clustered` | 6 tight clusters, empty space between | The realistic delivery shape |
| `decoy` | Cheap near-decoy ring + dense far cluster | **The adversarial one.** Greedy construction walks the cheap ring, burns its K budget, and never reaches the payload. Escaping needs a real add/drop move or a diversified restart |
| `sample` | `samples/bikes_low_battery.json`, 107 real points | The instance we actually care about |

Synthetic matrices are haversine with a deterministic per-direction multiplier,
because **real driving matrices are asymmetric — 98.3% of pairs in the cached
OSRM fixture disagree with their reverse.** A symmetric matrix would flatter any
solver, and would make 2-opt's O(1) reversal delta look valid when it isn't.

## Relative vs absolute

Almost everything here is a RELATIVE number: engine A beat engine B on an
instance we invented. That is enough to decide whether a change helped, and not
enough to know whether any of them is any good — three engines could agree on a
route 30% above optimal and the comparison table would look perfectly healthy.

`npm run bench:tsplib` is the answer to that. TSPLIB publishes PROVEN optima, so
it is the only place the harness reports an absolute gap. Two details there are
load-bearing and documented in [`lib/tsplib.mjs`](lib/tsplib.mjs):

- **The closed-tour transform.** TSPLIB optima are for a closed tour; our port
  solves an open path. The depot is duplicated as node `n` with a forbidden arc
  between the twins, so `0 → … → 0'` costs exactly what the closed tour does.
- **`nint` rounding.** EUC_2D is `nint(sqrt(xd²+yd²))`, halfway away from zero.
  Get it wrong and the published optimum is no longer optimal for *your* matrix,
  and the "gap" measures your rounding rather than your solver.

Instances are fetched on demand and never committed — TSPLIB publishes no
licence, and downloading is not redistributing.

## Time windows

Two harnesses, asking two different questions.

**`npm run bench:tsptw` — the absolute number.** The
[TSPTW instance library](https://lopez-ibanez.eu/tsptw-instances) is the same
problem we actually solve: one vehicle, a start, a sequence, time windows,
minimise travel. 370 cached instances across five sets, most with a **proven
optimum**, so the gap is an absolute claim rather than a comparison. Run
`npm run bench:tsptw:fetch` first.

The report leads with FEASIBILITY, not cost, because a cheap route that misses a
window is not a better route — it is a wrong answer. The gap is computed over the
feasible runs only. An engine that ignores windows shows a lovely negative gap
and 0% feasible, which is exactly how it should look.

Three conventions in [`lib/tsptw.mjs`](lib/tsptw.mjs) are load-bearing, and each
one produces a plausible wrong number if you get it wrong: **service time is
baked into the matrix** (the diagonal is non-zero — there is no separate service
array), **waiting for a window to open is free**, and **the return leg to the
depot is scored** against the depot's own window. So `bench:tsptw:fetch` finishes
by re-evaluating all 370 published best-known PERMUTATIONS and refuses to succeed
unless our cost and violation count equal theirs. The harness is checked against
the library before the library is used to check an engine.

**`npm run bench:solomon` — the shape check.** Solomon and Gehring-Homberger are
scored on vehicles first, then distance, with capacity; a single-vehicle engine
cannot compete on that objective at all, which is why M9 parked them. So instead
of relaxing their objective, this asks a question we can answer honestly: take
each ROUTE of SINTEF's published best-known solution, fix its customer set — the
fleet term and capacity are then satisfied by construction — and re-solve it as a
TSPTW sub-instance. Given the customers a state-of-the-art VRPTW solver assigned
to this vehicle, can we order them at least as well as it did?

Because our cost and theirs come from the same function over the same customers,
any disagreement about Solomon's rounding conventions cancels exactly. The script
still verifies itself first: summing our own evaluation of every published route
must reproduce SINTEF's published vehicle count and distance (c101 → 10 vehicles,
828.94, zero violations) before any engine is run.

Everything crossing into an engine is scaled to fixed point ×100, because the
port takes `Int32Array` and both libraries are real-valued. The engine optimises
the rounded copy and is graded on the real one — it can only lose from the
rounding, never gain.

## Adding an engine

Register it in [`src/benchSeam.ts`](../src/benchSeam.ts)'s `ENGINES` map. It must
implement `SolverEngine` from [`solverPort.ts`](../src/lib/compute/solverPort.ts),
and it is built lazily so a heavyweight engine never downloads just to be listed:

```ts
const ENGINES = {
  ts: async () => engineTs,
  mine: async () => (await import('./lib/compute/engineMine')).default,
}
```

then `npm run bench -- --engine=ts,mine` and
`node bench/compare.mjs baseline-ortools.json mine-full.json`.

The seam is imported from `main.tsx` behind `import.meta.env.VITE_BENCH_SEAM`,
which Vite statically replaces — production builds tree-shake it away entirely.
`npm run bench:verify-seam` fails the build if that ever stops being true.

## Files

| File | Role |
|---|---|
| `run.mjs` | Driver: probe, grid, endurance, reporting |
| `compare.mjs` | Diffs two result files |
| `fetch-fixtures.mjs` | Caches the real OSRM matrix (rate-limited, mirrors `routingService.ts`) |
| `patch-pthread-pool.mjs` | Post-build patch disabling the pthread pool — the no-COI experiment |
| `verify-seam.mjs` | Proves the seam isn't in production output |
| `tsplib.mjs` | Gap to proven optimum, per engine |
| `fetch-tsplib.mjs` | Caches TSPLIB instances + the optima table |
| `lib/tsplib.mjs` | TSPLIB parser, distance functions, closed-tour transform |
| `tsptw.mjs` | Time windows: feasibility, then gap to proven optimum |
| `fetch-tsptw.mjs` | Caches the TSPTW library and self-checks the referee against 370 published solutions |
| `lib/tsptw.mjs` | TSPTW parser, open-path transform, and the referee (transcribed from the authors' checker) |
| `solomon-routes.mjs` | Re-sequences each route of SINTEF's published best-known solutions |
| `lib/vrptw.mjs` | Solomon / Gehring-Homberger parser, solution reader, and Solomon-convention scorer |
| `lib/objective.mjs` | The referee: scoring + structural validation |
| `lib/instances.mjs` | Instance generators + matrix construction |
| `lib/server.mjs` | Header-less static server |
| `lib/rng.mjs` | Seeded PRNG |
| `results/` | Committed. `baseline-ortools.json` is the number to beat |
