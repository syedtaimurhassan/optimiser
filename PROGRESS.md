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

---

## M1 — Infrastructure: routing, persistence, capabilities, error boundaries

**Date:** 2026-08-07 · **Branch:** `m1-infrastructure` (from `main` @ `4d342df`)

Plumbing only. The app looks and behaves exactly as before; everything added is
foundation for M2 onwards.

### What changed

**Dependencies added** (both approved): `wouter` 3.10.0 (~2.2 kB gz),
`idb` 8.0.3 (~1 kB gz).

**Added**

- `src/routes.tsx` + `src/screens/*` — hash router, route table, stub screens
- `src/lib/device/capabilities.ts`, `src/store/deviceStore.ts`,
  `src/components/DiagnosticsPanel.tsx`
- `src/lib/persistence/{db,zustandStorage,migrate,boot}.ts`
- `src/components/ErrorBoundary.tsx`, `src/lib/diagnostics/errorLog.ts`
- `src/hooks/useHydrated.ts`, `src/vite-env.d.ts`, `src/routeIds.ts`
- `bench/m1-smoke.mjs` — 24 acceptance checks (`npm run smoke`)

**Removed:** `src/App.css`, `src/assets/{react.svg,vite.svg,hero.png}`

### Verified

- **24/24 smoke checks pass** against the pruned production bundle
- A seeded v2 localStorage session reaches the UI: 3 stops migrated, favorite
  carried over, `schemaVersion` 3, legacy key + `.backup` both preserved,
  idempotent across reloads
- Fresh install stamps `schemaVersion` without inventing data
- Deep links (`#/settings`, `#/route/current/stop/a1`) resolve on cold load;
  unknown paths show not-found; `/` still lands on the working screen
- A thrown render error produces the recovery UI with all three actions
- `npm run lint` and `npm run build` clean; `lib/` imports neither React nor the
  store; seam and `/__crash` both absent from production output

### What surprised me

1. **The error boundary was broken when I wrote it.** `getDerivedStateFromError`
   returned `{ error: null }`, deferring to `componentDidCatch`. Because that's a
   commit-phase hook, React re-rendered the same throwing children, and a
   throw-while-handling-a-throw unmounts the tree — a blank page, the exact
   failure the component exists to prevent. Only the `/__crash` route caught it.
   An untested recovery path is not a recovery path.

2. **`import.meta.env.VITE_BENCH_SEAM` is not a compile-time constant when the
   variable is unset.** Vite inlines VITE_ vars only when they're set, so in a
   normal production build the guard stayed a runtime lookup, never folded, and
   the dev-only `/__crash` route's strings shipped. Fixed with a `define`.
   The bench seam was unaffected because a dynamic `import()` behind a false
   branch drops its whole chunk regardless.

3. **A `path=""` route in wouter matches every location.** It silently swallowed
   `/nonsense` and redirected it to the working screen. `useHashLocation` already
   normalises an empty fragment to `/`, so the route was both unnecessary and
   harmful.

### 🟡 Finding: the production bundle is not fully minified

`npm run build` emits **739 kB** (gzip 171 kB). Building with an explicit
`--minify esbuild` gives **467 kB** (gzip 148 kB) — a **272 kB / 23 kB gzip**
saving for a one-line config change. Identifiers are mangled but dead-code
folding and whitespace removal are not running, which suggests the Vite 8 +
Rolldown default for `build.minify` is doing less than expected.

**I did not change it.** M1 said infrastructure only and behaviour unchanged, and
minification alters the deployed artifact. Flagging it for your call — I'd take
it in M5 alongside the PWA work, where bundle size directly affects install and
offline cost.

### Deferred

- Dropping cross-origin isolation (M0's recommendation) — needs `solver.ts`,
  which M1 was told not to touch. Still the right M-next move.
- Coordinate-as-identity bug (28 sites) — M2, before the UI rebuild
- `matrices` and `photos` stores are created but unused until M6

### What the next session needs to know

1. **The data model is deliberately untouched.** The migration puts the whole
   legacy session into ONE `routes` row with its payload verbatim, so M2 can
   restructure from complete information. `RouteRow.payload` is `unknown` on
   purpose — do not build on its shape, replace it.
2. **`SCHEMA_VERSION` is 3; M2 goes to 4.** `db.ts`'s `upgrade` callback already
   receives `oldVersion` and must stay purely structural — no awaits inside an
   upgrade transaction, or it deadlocks. Data migration belongs in `migrate.ts`.
3. **Boot order is load-bearing.** Migration must finish before rehydration. If
   M2 adds another async boot step, it goes inside `bootPersistence()`, not
   alongside it.
4. **`CURRENT_ROUTE_ID = 'current'`** is a placeholder in `src/routeIds.ts`. M2
   replaces it with real ids and deletes the redirect in `RoutesListScreen`.
5. **Run `npm run smoke` after touching persistence, routing or boot.** It is
   fast and it has already caught two shipped-quality bugs.

---

## M2 — The data model: many routes, addressed stops, immutable stop IDs

**Date:** 2026-08-07 · **Branch:** `m2-data-model` (from `main` @ `3b87512`)

The spine. No new screens; the existing UI still works, now on top of the new model.

### What changed

**Added**

- `src/lib/stopIds.ts` + tests — the immutable ID allocator
- `src/lib/persistence/migrateV4.ts` + tests — pure 3→4 transform
- `src/store/{routesStore,uiStore,solverStore}.ts`
- `npm test` (node:test, native TS stripping, **no test dependency**)

**Rewritten:** `src/types.ts`, `src/store/routeStore.ts` (now a compat facade),
`src/lib/persistence/migrate.ts` (version-aware chain)

**No dependencies added.**

### Verified

- **73 unit tests** pass, including the specified D7 / D8 / E3 / A10 / B1 cases
- **42 browser checks** pass, including the 3→4 upgrade driven through a real
  IndexedDB, multi-route creation, an A7→A7.1 insert renumbering nothing, and
  timestamped status transitions with undo
- Both migration entry paths covered: v2 localStorage **and** a deployed-M1
  IndexedDB at version 3 — a real upgrader takes the second, which the v2 test
  does not exercise at all
- `npm run lint`, `npm run build`, seam verification all clean; `lib/` still
  imports neither React nor the store

### Decisions worth knowing

**Task 5 — compatibility facade, not a rewrite.** M3–M8 replace every one of
these components, so porting ~20 of them now would be throwaway work with real
regression risk. The facade projects the new model into the old shape.

The hard part was **referential stability**: Zustand re-renders when a selector's
result changes identity, so a facade that rebuilt its view each call would return
fresh arrays and closures every time — every selector would look changed and
every component would re-render on every write, destroying the narrow-selector
discipline right before M4 makes the map expensive. Actions are module-level
constants; the legacy stop projection is memoised against the stops array by
WeakMap. **This layer is scaffolding — if it still exists after M8, something
went wrong.**

**Deviations from the brief** (all flagged, none silent):
- `Route.start`/`end` are `LatLng | null` with an explicit `endpointMode`, not
  optional fields. Open routes already exist and null is the honest shape.
- Added `targetK` to `Route` — the existing K control would otherwise break.
- `planSelectiveRoute` returns `PlannedRoute` (OptimizedRoute minus the two new
  fields). The pipeline gets bare coordinates and never sees stop identity, so
  it cannot honestly fill them. The caller joins them back. M7's job.

**Decimal inserts allocate off the ROOT, not the neighbour.** Inserting beside
D7.1 gives D7.2, not D7.1.1 — nesting would deepen without bound as a driver
worked down a street, and nobody wants "D7.1.2.1" on a box. Suffixes are also
never reused after a delete, because someone may still be holding a parcel
marked D7.1.

**Migrated delivery timestamps are the migration time, and say so.** The old
model stored only a boolean. Inventing a plausible past time would have been
worse than an honest one.

### What surprised me

1. **Node runs `.ts` tests natively with zero dependencies** — `node --test` plus
   type stripping, which the project's existing `erasableSyntaxOnly` setting
   already guaranteed would work. No Vitest, no Jest. The one catch: Node's ESM
   resolver needs explicit `.ts` extensions in import specifiers, which Vite
   accepts happily.

2. **Two migration entry paths, not one.** I nearly shipped a migration that only
   handled v2 localStorage — which would have done nothing for anyone already
   running the deployed M1 build, silently starting them empty. Their data is in
   IndexedDB at version 3. The smoke test now covers that path explicitly.

3. **The favorites object store quietly stopped being populated.** The v4 blob
   held them, so the app worked, and only the smoke test noticed the database
   had stopped being a truthful index of what exists.

### Deferred

- Groups, breaks, time windows, pending changes: modelled and stored, no UI yet
- `arrivalSec` is always `[]` — the pipeline can't compute arrivals yet (M7)
- `markDeliveredByCoord` still exists for old callers; deleted when the last
  legacy component goes
- Dropping cross-origin isolation (M0) and the unminified-bundle finding (M1)

### What the next session needs to know

1. **`useRouteStore` is now a facade, not a store.** It has no `.persist` and no
   `setState`. Reach for `useRoutesStore` / `useUiStore` / `useSolverStore`
   directly in anything new — do not extend the facade.
2. **`SCHEMA_VERSION` is 4.** M3+ bumps to 5 and adds a `4 → 5` branch in
   `migrateLegacyIfNeeded`. Keep `db.ts`'s `upgrade` purely structural.
3. **Never write `stopId` or `originalPosition` outside the allocator.**
   `updateStop` strips them on purpose. Only "Reset Stop IDs" changes them.
4. **`npm test` is fast (~0.1s) and `npm run smoke` is thorough.** Run both.
5. M3's route list should read `useRoutesStore.listRoutes()` /
   `listRoutesByDate()`, and delete the placeholder redirect in
   `RoutesListScreen` plus `CURRENT_ROUTE_ID` in `src/routeIds.ts`.
