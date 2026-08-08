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

## VRPTW is parsed but not run

[`lib/vrptw.mjs`](lib/vrptw.mjs) reads Solomon and Gehring-Homberger instances
and records SINTEF's best-known values, and **nothing scores against them yet**.
Those benchmarks have a hierarchical objective — minimise vehicles first, then
distance — and carry time windows and capacity. Our engine is single-vehicle and
M9 ignores both constraints, so a gap number today would be an answer to a
different question. M11 turns it on.

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
| `lib/vrptw.mjs` | Solomon / Gehring-Homberger parser — parked for M11 |
| `lib/objective.mjs` | The referee: scoring + structural validation |
| `lib/instances.mjs` | Instance generators + matrix construction |
| `lib/server.mjs` | Header-less static server |
| `lib/rng.mjs` | Seeded PRNG |
| `results/` | Committed. `baseline-ortools.json` is the number to beat |
