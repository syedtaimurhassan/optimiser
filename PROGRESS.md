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

---

## M3 — The outer shell: design tokens, primitives, routes drawer, create route

**Date:** 2026-08-07 · **Branch:** `m3-outer-shell`

⚠️ The commits were made on `m2-data-model` (from `47adb75`) before I noticed
the branch, and `m3-outer-shell` was cut at the end. Both names point at the
same commit; nothing was rewritten. `m2-data-model` is still unmerged, so
merging it now brings M3 with it.

First milestone where the app looks like the target. No solver, map or
persistence behaviour changed.

### What changed

**Added**

- `src/index.css` — the design tokens, as a Tailwind v4 `@theme` block
- `src/components/ui/*` — 12 primitives + the icon set + `useScrollLock`
- `src/components/routes/*` — `RoutesDrawer`, `RouteListRow`,
  `RouteOverflowSheet`, `CreateRouteModal`, `DrawerTrigger`
- `src/lib/routeGrouping.ts` + tests — dates, sections, stop summaries
- `src/screens/UiGalleryScreen.tsx` — dev-only `/__ui`
- `bench/m3-smoke.mjs` — 50 acceptance checks (`npm run smoke:m3`)

**Modified:** `routesStore` (duplicate, metadata edits, safer delete),
`uiStore` (drawer/editor/overflow/confirm state), `RouteWorkScreen` (honours
`:routeId`), `RoutesListScreen` (real redirect), `routes.tsx`, `verify-seam.mjs`

**Removed:** `src/routeIds.ts` — `CURRENT_ROUTE_ID` is gone, as M2 asked.

**No dependencies added.**

### Verified

- **50/50 M3 browser checks**, driving the whole definition of done: create a
  named dated route → right section header → open → rename → duplicate →
  delete, with cancel actually keeping the route
- **42/42 M1+M2 checks still pass** — no regression from deleting the
  placeholder route id
- **97 unit tests** (73 from M2 + 24 new), and the new ones pass under
  `TZ=America/Los_Angeles`, `Pacific/Kiritimati` and `UTC`
- Drawer geometry asserted, not eyeballed: 384px panel in a 390px viewport, a
  full-width scrim, and the exposed strip dismisses
- Every thumb target measured ≥ 44dp; verified on a 390×844 viewport and at
  1280×800
- `npm run lint`, `npm run build`, `npm run bench:verify-seam` clean; `lib/`
  still imports neither React nor the store

### Decisions worth knowing

**The drawer and the create modal are overlays, not routes.** A route for
either would unmount `RouteWorkScreen` and tear down the Leaflet map on every
open — expensive now, worse after M4. The cost is no deep link and no
hardware-back dismissal; Escape, the scrim and the exposed strip all close
them. Back-button handling belongs with M5's PWA navigation work.

**The overflow menu is a bottom sheet, not a popover.** It is a list of demoted
actions ending in a destructive one, which is precisely `DemotedActionGroup`,
and a sheet puts all three inside thumb reach rather than anchoring them beside
a row near the top of the screen.

**`DemotedActionGroup` takes its destructive action as a separate required
prop.** "The last item is always red" is then a fact about the type, not a
convention a caller has to remember: you cannot build one with the delete in
the middle, or with two red rows.

**Deviations from the brief** (all deliberate):

- **An "Upcoming" section.** The create flow offers "Tomorrow", so future-dated
  routes exist the moment anyone uses it, and "Earlier this week" is a false
  statement about a route that hasn't happened yet.
- **The name placeholder tracks the selected date's weekday**, not today's, so
  picking Tomorrow shows "Thursday" — the name that route will actually get.
  Identical to the brief when the date is today.
- **The account band says "This device"**, not an email. There is no account
  and never will be; the honest local equivalent is where the data lives. One
  line to change when M4's Settings owns an identity.
- **The drawer caps at 384px on desktop.** 90% of a 1440px window is not a side
  sheet.
- **`deleteRoute` never leaves the app with nothing.** Deleting the active
  route falls through to the newest remaining one; deleting the last creates a
  blank route for today. Every screen assumes an active route exists, and that
  invariant has to survive deletion, not just first run.

### What surprised me

1. **`todayISO()` was UTC.** `new Date().toISOString().slice(0, 10)` — so east
   of Greenwich every route created after ~22:00 was dated tomorrow. It had
   been harmless for two milestones because nothing displayed a date; the
   moment routes are filed into dated sections it becomes "I created today's
   route and it appeared under Upcoming". Fixed with a local-time helper, and
   the test that catches it constructs 23:30 local deliberately.

2. **Adjacent flex children leave no whitespace in `textContent`.** "Today
   Fri 07 Aug" is two spans separated by `gap-2`, so the accessible name was
   "TodayFri 07 Aug". The smoke test caught it, not the browser. The fix is an
   explicit space, which costs nothing visually because whitespace-only text
   nodes between flex children aren't rendered.

3. **Class order in JSX does not decide which utility wins.** `ListRow` emits
   `bg-surface` for an outlined row, and the caller's `bg-primary-container`
   silently lost — Tailwind's stylesheet order decides, not the order they are
   written. The selected date option rendered white for one build. Variant
   props on the primitive, not background classes from the caller.

Runner-up: the drawer trigger landed exactly on Leaflet's zoom control, hiding
the "+". Screenshots showed it; the geometry probe proved the fix.

### Deferred

- **"Pick past stops to carry over" does nothing.** Wired to state with a
  TODO(M6), as specified — it needs M6's stop copying.
- Settings and Help are still M1 stubs.
- Dropping cross-origin isolation (M0) and the unminified-bundle finding (M1)
  are both still open.
- The legacy sidebar, `HeaderPanel` and the rest of the M1 UI are untouched
  behind the drawer. M4/M5 replace them, and the `routeStore` facade with them.

### What the next session needs to know

1. **Assemble M4 from `src/components/ui`.** If a screen needs a new visual
   treatment, it goes in the primitive first. `Stepper`, `SegmentedControl`,
   `StatusPill`, `IdChip` and `ActionRow3Up` are built and unused on purpose —
   see them all at `#/__ui` in a bench build.
2. **`npm run smoke:m3` is the M3 regression net**, and `npm run smoke` still
   covers M1/M2. Both need a bench build, which their `pre` scripts handle.
3. **The route screen reads `:routeId` from the URL.** Anything that changes
   which route is open must set the active route *before* navigating, or the
   first frame shows the previous route's stops. `RoutesDrawer.openRoute` is
   the pattern.
4. **`SCHEMA_VERSION` is still 4.** M3 added no persisted field. M4+ bumps to 5
   and adds a `4 → 5` branch if it does.
5. **The semantic colour rule is enforceable and worth enforcing**: red only
   for failure or destruction, green only for success. If M4 needs a warning
   colour, add an amber token — do not reach for `danger`.

---

## M4 — MapLibre GL, and the map layer Spoke's UI needs

**Date:** 2026-08-07 · **Branch:** `m4-maplibre` (from `m3-outer-shell` @ `fb8d353`)

Leaflet is gone. The map is now WebGL with global symbol collision, which is
the whole point: Spoke ships overlapping chips and labels clipped mid-word
("Elmekro… 10"), and this is the machinery that makes that impossible rather
than the machinery that makes it a bug to fix later.

### What changed

**Dependencies:** `+maplibre-gl` 5.24.0 (pinned exact), `−leaflet`,
`−react-leaflet`, `−@types/leaflet`. Net one.

**Added**

- `src/lib/map/*` — `basemap`, `palette`, `chipSpec`, `chipImage`, `features`,
  `splitRoute`, `camera`, `layers`, `controller`, plus four test files
- `src/components/map/*` — `MapChrome`, `FabStack`, `FinishPill`, `PeekPill`,
  `MapControllerContext`
- `src/hooks/useGeolocation.ts`
- `bench/m4-smoke.mjs` (40 checks, `npm run smoke:m4`), `bench/m4-perf.mjs`
  (`npm run map:perf`)
- `DEVICE-SMOKE-TEST.md` §10–14

**Rewritten:** `MapComponent.tsx`. **Modified:** `index.css` (all Leaflet CSS
deleted), `ui/icons.tsx` (+6 glyphs), `DrawerTrigger`, `uiStore` (+`basemap`,
and `cameraIntent` finally has a consumer).

### Task 1 — the tile source, with receipts

**OpenFreeMap primary, Stadia Maps fallback.** Neither puts a secret in the
bundle: OpenFreeMap has no key at all, Stadia authenticates on the `Origin`
header. Verified by hitting the endpoints, not by reading docs —
`access-control-allow-origin: *`, 111 style layers, glyphs and sprites on the
same host, no request cap, commercial use permitted.

**GitHub Pages does serve range requests.** Measured against the live site:
`HTTP/2 206`, `content-range: bytes 0-99/721351`, `accept-ranges: bytes`. So
PMTiles is technically viable, and I still recommended against it for M4 — not
because of the known Firefox range-caching bug (PMTiles #582, still open) but
because **this app has no fixed geography**. A driver uploads arbitrary
coordinates; a Copenhagen extract renders grey tiles for a route in Aarhus.
PMTiles is right for M14, scoped to the driver's actual bbox.

### Verified

- **40/40 M4 browser checks**, including the milestone's critical detail
  driven end to end: tap a failed stop in a green group, assert the chip fills
  `#12823c` and the failure appears only on the badge
- **180 unit tests** (97 from M3 + 83 new)
- **42/42 M1+M2 and 52/52 M3** — but three of their assertions had to be
  rewritten, and two were weak before M4 touched them. M1 asserted the map
  existed by querying `.leaflet-container` without waiting for the mount, so
  it passed on timing luck. M3's `settle()` was documented as waiting for the
  sheet transition and was a flat 400ms sleep; MapLibre competing for the main
  thread pushed the drawer's close past it. Both now wait on real conditions.
  M3's Leaflet-zoom-control overlap check had no subject left, and became
  "nothing overlaps the drawer trigger" instead
- Seam absent from production output
- `npm run lint`, `npm run build`, `tsc -b` clean; `lib/` still imports neither
  React nor the store

### The numbers

**Bundle.** 459 kB gzip, up from 171 kB — MapLibre costs **~288 kB gzip** as
currently built. Building with explicit `--minify esbuild` gives 392 kB, so
**M1's unminified-bundle finding is now worth 67 kB gzip / 893 kB raw**, up
from 23 kB / 272 kB. It was a nice-to-have at M1; it is three times more
valuable now and I would take it in M5.

**Performance — a proxy, not the definition of done.** 300 markers, 390×844,
desktop Chromium:

| | median frame | mean | p95 |
|---|---|---|---|
| unthrottled | 17.4 ms (57 fps) | 25.6 ms | 50.0 ms |
| 4× CPU throttle | 33.4 ms (30 fps) | 39.6 ms | 66.7 ms |

Cold load → map ready: ~300 ms. Markers placed: **z12 39 · z14 18 · z16 0** of
300 — suppression is deliberate.

🔴 **I could not measure FPS on a real mid-range Android, and that is the
definition-of-done item.** This rig throttles the CPU and models nothing else
— no GPU, no memory bandwidth, no thermals — and a phone is usually bound by
the things it cannot see. The median sitting at the vsync cap unthrottled is
reassuring; the p95 spikes during zoom transitions are symbol re-placement and
are the weak point. **Run DEVICE-SMOKE-TEST.md §11.**

### Decisions worth knowing

**One bitmap per stop, one symbol layer.** The alternative was a chip layer
plus a separate badge layer, and MapLibre cannot link two layers into one
collision unit — a badge could outlive the chip it belongs to. Baking the
badge into the chip makes the pairing true by construction. `icon-optional`
and `text-optional` are both `false`, which is what makes a chip and its
label collide as one thing; with either `true`, MapLibre will place a chip
whose label did not fit. That single pair of properties is the fix for the
clipped labels.

**Fill and badge are independent inputs, and that is a unit test.**
`chipSpec.ts` is pure and separate from the canvas precisely so the rule —
fill is the GROUP colour, badge is the STATUS, they never cross — is
enforceable rather than a thing to remember.

**Deviations, all deliberate:**
- **Delivered stops are dimmed** as well as badged. Opacity only, never hue.
  A finished round is otherwise 200 chips at full strength and the remaining
  work stops standing out.
- **Labels are dropped below z14.** Measured, not taste: with labels always
  on, 2 of 6 test stops placed at z12. `LABEL_MIN_ZOOM` is the knob.
- **Streets ↔ light, not streets ↔ satellite.** Keyless satellite has no
  clean free source; picking one is a provider decision, not a smuggled-in
  default.
- **The finish pill's estimate is a straight line through a curve** — the
  solved total scaled by the share of stops still pending. `arrivalSec` is
  still empty; M7 should replace this, not refine it.

### What surprised me

1. **`map.isStyleLoaded()` is the wrong gate for adding sources and layers.**
   It is true only once the style is parsed AND every source has loaded — and
   sources finish on `sourcedata`, not `styledata`. So the gate never opened
   on the same tick an event fired, and the app rendered a flawless basemap
   with absolutely nothing on it. No error, no warning, a perfect map of
   Copenhagen with no stops. It now simply tries, and retries on the next
   `styledata` if the style is not parsed.

2. **My basemap-fallback trigger matched MapLibre's own error messages.** It
   sniffed message text for `/style/`, which matches "does not exist in the
   map's style" — so an unrelated runtime error silently switched tile
   provider mid-session. It now fires only on an AJAXError whose URL is
   actually an openfreemap.org one. Error-string matching was never going to
   survive contact with a library that talks about styles constantly.

3. **My own test for the milestone's critical detail passed vacuously.** It
   asserted a failed stop in a green group was "not red" — but unselected
   chips are white whatever group they belong to, so the assertion was true
   for a reason that had nothing to do with the rule. The rule only exists on
   a *selected* chip. A green tick on the one check the brief flagged as
   easiest to get wrong, proving nothing.

Runner-up: **the FAB stack was buried under the legacy controls sheet** and
completely untappable. The first screenshot showed no FABs and I read that as
"cropped" rather than "covered". Playwright caught it properly, reporting the
sheet's subtree as intercepting every click.

### Deferred

- 🔴 **Real-device FPS** — the outstanding definition-of-done item
- **Satellite basemap** — needs a provider decision
- **The Stadia fallback is untested and will 401 until
  `syedtaimurhassan.github.io` is registered** under Manage Properties. Also:
  do not add a `Referrer-Policy` meta tag to index.html without re-checking
  it, because domain auth dies under `no-referrer`
- MapLibre v6 (ESM-only, WebGL2-only) — a self-contained upgrade
- PMTiles for M14; offline tiles were explicitly out of scope
- Cross-origin isolation (M0) and minification (M1) still open

### What the next session needs to know

1. **300 stops means 300 distinct chip bitmaps**, because the label is baked
   into the image. At 2× DPR that is roughly 10 MB of texture atlas. If the
   device FPS in §11 comes back bad, this is the first thing to attack, and
   the fix is known: `icon-text-fit` with one stretchable chip image per
   (fill, badge, tail) combination — about a dozen images — and the number as
   the symbol's `text-field`. The cost is that the address block can no longer
   live in the same layer, so you would trade collision unity for memory.
   **Do not attempt it before there is a real device number to justify it.**
2. **`LABEL_MIN_ZOOM` in `layers.ts` is the density knob.** Raising it shows
   more chips at overview zoom; lowering it shows addresses sooner.
3. **`PendingChange.stopId` is read as the stop's UUID, not its label.** The
   field name says otherwise and nothing else writes it yet. M6 owns staged
   edits and should rename it — labels are not unique after a "Reset Stop IDs".
4. **The FAB stack's 128px bottom offset is coupled to `Sidebar`'s
   `PEEK_PX = 116`.** M5 rebuilds that sheet and must own the relationship
   rather than inherit the magic number.
5. **`globalThis.__mapController` is the test seam**, behind `__DEV_ROUTES__`
   and folded out of production. Assert on `queryRenderedFeatures` — it is the
   only way to tell a marker that failed to render from one the collision
   detector correctly suppressed.
6. **`SCHEMA_VERSION` is still 4.** M4 persisted no new field; `basemap` lives
   in the transient `uiStore` deliberately.

---

## M5 — The persistent sheet, and the route list inside it

**Date:** 2026-08-08 · **Branch:** `m4-maplibre` (continues from `4fb88b0`)

The phone now has the structural surface everything after this hangs off: a
four-detent sheet over the map, a header that morphs instead of swapping, and a
virtualised route list. The M1 sidebar is desktop-only from here.

### What changed

**Dependencies:** `+@tanstack/react-virtual` 3.14.9 (one transitive dep,
`virtual-core`). Nothing removed.

**Added**

- `src/lib/routeOrder.ts`, `routeSummary.ts`, `routeList.ts`, `sheetSnap.ts`
  — the four pure modules, plus their tests
- `src/components/sheet/*` — `RouteSheet`, `SheetHeader`, `SummaryStrip`,
  `RouteList`, `StopRow`, `ListRows`, `Timeline`, `RouteSetupSheet`
- `src/hooks/useNowTicker.ts`
- `bench/m5-smoke.mjs` (54 checks, `npm run smoke:m5`), `bench/m5-perf.mjs`
  (`npm run list:perf`)
- `DEVICE-SMOKE-TEST.md` §15–17

**Modified:** `index.css` (pastel group tokens, `--text-route-title`,
`--sheet-peek`, `--fab-stack-height`), `IdChip` (+`pastel`), `Chip`
(+`outlined`, +`disabled`), `FullWidthButton` (+`outlined`), `icons` (+9),
`uiStore` (four detents, `setupOpen`), `RouteWorkScreen`, `Sidebar`
(`hidden md:flex`), `FabStack`, `CalculateFab`, `DrawerTrigger`, `FinishPill`,
`MapChrome`, `MapComponent`, `lib/map/features.ts`.

**Removed:** nothing. The M1 panels are all still reachable.

### Verified

- **54/54 M5 browser checks**, driving every definition-of-done item
- **42/42 M1+M2, 52/52 M3, 40/40 M4** — no regressions, though M3 and M4 each
  needed a selector fixed (see below)
- **248 unit tests** (180 from M4 + 68 new)
- `npm run lint`, `npm run build`, `tsc -b`, `bench:verify-seam` clean; `lib/`
  still imports neither React nor the store

### The numbers

**Bundle.** 486.3 kB gzip, up from 470.6 — **+15.7 kB gzip for all of M5**,
measured against a build of `d7f9d27` in a scratch worktree rather than
estimated. The virtualiser is a minority of that; most of it is ~1,100 lines of
new components. M1's unminified-bundle finding is still open and still worth
about 67 kB.

**List performance — a proxy, not the definition of done.** 300 stops, 390×844,
desktop Chromium, sustained scroll of the entire list:

| | median frame | mean | p95 | p99 |
|---|---|---|---|---|
| unthrottled | 16.7 ms (60 fps) | 16.7 ms | 17.6 ms | 17.7 ms |
| 4× CPU throttle | 16.7 ms (60 fps) | 17.7 ms | 17.7 ms | 65.7 ms |
| 6× CPU throttle | 16.7 ms (60 fps) | 17.6 ms | 17.6 ms | 66.7 ms |

**16 rows and 207 elements in the DOM** for a 305-row list, at every throttle
level. Jump-to-next: ~50 ms. The p99 is a single hitch at the scroll
direction reversal; the median sits on the vsync cap even at 6×, which is a
much healthier profile than M4's map got.

🔴 **Still no real-device number, and it is still the definition-of-done item.**
This rig throttles the CPU and models nothing else — and unlike M4 there is now
a second consumer of the main thread, because the map is live underneath the
sheet the whole time. **Run DEVICE-SMOKE-TEST.md §15 and §16.** §16 especially:
the nested-scroll behaviour is not testable with a mouse at all.

### Decisions worth knowing

**The header rows are IN the virtual list.** Title, action chips, break and
start row are rows, not a static block above a scroller. That buys one scroll
container (so there is one gesture question, not two), one measurement pass,
and a timeline connector that is continuous by construction because the start
and end rows are neighbours in the same array.

**The connector is a segment per row, never one tall element.** Under windowing
a single line would have to span rows that are not rendered; against variable
heights it would drift. Adjacent rows touch, so their segments touch, whatever
height either turns out to be. The smoke test asserts the largest gap between
consecutive segments — it is 0.00px.

**The gesture is classified once and never reclassified.** Below `expanded` the
list does not scroll at all, so there is nothing to arbitrate. At `expanded` and
`full` the sheet takes a drag only if the list is at the top AND the finger is
moving down, decided on the first move past a 4px slop and held for the rest of
the gesture. Re-deciding per move is what makes these sheets judder as
`scrollTop` crosses zero.

**The drag never enters React state.** The offset is a ref written straight to
`style.transform`; React is told only the resulting detent. A pointermove that
re-rendered would re-render the list with it.

**A fling goes to the next detent past the RELEASE point**, not one from where
the gesture started — otherwise a long drag ending in a flick snaps back behind
the user's own thumb. That is a unit test, not a feeling.

**Deviations from the brief, all deliberate:**

- **Kilometres, not miles.** OSRM returns metres and every address in the
  fixtures is Danish. One formatter to change if a units setting ever lands.
- **The summary strip drops segments it cannot honestly fill.** An unsolved
  route has no finish time and no distance, so it shows "12 stops" alone rather
  than "Finish --:-- · 12 stops · -- km".
- **The break row and both endpoint rows open Route setup.** They have no real
  editors until M6/M7. A control that visibly does nothing teaches a driver to
  stop trying it; one that lands somewhere useful does not.
- **The floating drawer trigger hides at `expanded` and above**, because the
  header's morph puts a hamburger in the sheet at exactly those detents. Two
  identical controls, one of them floating on top of the sheet, was the
  alternative.

### What surprised me

1. **My own guard swallowed every tap on the grab handle.** The drag handler
   ignores pointerdowns that land on a control, so a tap on a button is that
   button's — and the handle is itself a `role="button"`, because it is
   operable and a bare div is invisible to a screen reader. So the handle
   matched its own exclusion list, no drag ever started, and none of the four
   detents was reachable by tap. Everything else about the sheet worked
   perfectly, which is what made it convincing: dragging was fine, the morph
   was fine, only tapping did nothing.

2. **TanStack Virtual cannot smooth-scroll a dynamically measured list.** The
   jump FAB asked for `behavior: 'smooth'` and landed 24 rows short of the stop
   it was told to go to — the animation is chasing an offset that the two-pass
   measurement is still correcting underneath it. It is documented, and it is
   the kind of thing that reads as "the FAB is a bit inaccurate" rather than as
   a constraint being violated.

3. **My "flick" and my "slow drag" were the same speed.** Both are synthesised
   through CDP, where every dispatch costs a round trip of ~20ms, so the speed
   of a drag is set almost entirely by its distance per step. The 46px "flick"
   came out at 0.46 px/ms — just under the fling threshold — while the 675px
   "slow drag" came out at 1.4 px/ms and was correctly treated as a fling. Two
   failures, opposite causes, same helper. They are separate profiles now.

Runner-up: **the Calculate FAB landed exactly on the basemap button.** Both
offsets were rewritten to clear the new sheet, independently, and they
collided. Nothing looked wrong in a screenshot — the button simply stopped
responding — and it was the M4 suite that found it, reporting "Calculate route
intercepts pointer events". The stack's height is a token now and the M5 suite
asserts non-overlap.

### 🟡 Finding: the solid amber id chip fails contrast

While computing the pastel pairs I checked the existing solid ones. White on
`--color-group-amber` (#c77700) is **3.46:1**, below the 4.5:1 a 13px bold
label needs. It affects the solid chip and the map marker, not the new pastel
variant (which is 4.65:1). Left alone deliberately: changing a group colour
means changing `palette.ts`, its drift test and every rendered chip bitmap, and
that is a change worth making on purpose rather than as a side effect of this
milestone. Teal is 4.18:1 and marginal for the same reason.

### Deferred

- 🔴 **Real-device FPS and the thumb tests** — §15, §16, §17
- **Search does nothing.** The field is real, focuses to `full`, writes to
  `uiStore.searchQuery`, and has no consumer. M6.
- **Share live route / Load vehicle** are announced, disabled stubs, as specified
- **ETAs are always absent** — `arrivalSec` is still empty. The gutter renders
  the sequence alone, and the rendering for a real ETA is already there. M7.
- **Route setup is scaffolding.** The M1 panels, unchanged, in a modal behind
  the overflow. It goes in one commit when the last of them has a replacement.
- **Desktop is untouched** — still the M1 sidebar column. The sheet is
  `md:hidden` and the route list has no desktop presentation yet.
- Amber/teal chip contrast (above); cross-origin isolation (M0) and
  minification (M1) still open.

### What the next session needs to know

1. **`lib/sheetSnap.ts` and `lib/routeList.ts` are where the rules live.** If a
   detent feels wrong, or a row shows a tag it shouldn't, the fix is a pure
   function with a test — not a component.
2. **`--sheet-peek` is measured and published by `RouteSheet`**; anything that
   floats over the map must clear it by reading that variable. `--fab-stack-height`
   is the other half of that agreement, and it IS a hand-maintained constant —
   a third FAB means updating it.
3. **Two controls now share the accessible name "Your routes"** — the floating
   trigger and the sheet's hamburger. Only one is exposed at a time (the other
   is inside an `inert` layer), which is correct, but it broke three
   name-based selectors in the M3 and M4 suites. Use `[data-testid="drawer-trigger"]`.
4. **M6 owns search.** The plumbing is done: `searchQuery` is in `uiStore`, the
   field writes to it, and `buildRouteRows` is a pure function of a route — so
   filtering is a `.filter()` between those two and nothing else has to move.
5. **`estimateFor` in `RouteList.tsx` is the smoothness knob.** It decides how
   far the two-pass measure has to correct. If rows visibly settle on a real
   device, that function is wrong about that device's font metrics.
6. **`SCHEMA_VERSION` is still 4.** M5 persisted no new field; `sheetSnap` and
   `setupOpen` are transient `uiStore` state deliberately.

## M6 — Addresses: geocoding, the unified search screen, and the importer

The milestone that turns a coordinate into a place. Everything before this
worked on `{lat, lng}`; a stop now knows what it is called, and the screens
that were scaffolding in M5 have something real behind them.

### What changed

- **`lib/geocoding/`** — a provider seam, two adapters, an IndexedDB cache and
  a service that composes them. Nothing above it names a provider.
- **The unified search screen** — one field, two sections, no mode switch.
  Existing stops render with the *identical* `StopRow` the route list uses.
- **Add by map pin**, with a fixed centre pin and reverse geocoding on
  `moveend`.
- **The empty-route state**, and **copy stops from a past route**.
- **The importer** now reads addresses, recipients and notes, and accepts
  CSV/TSV/XLSX/JSON.
- `SCHEMA_VERSION` 4 → 5 (`geocache` store). Additive; no migrate.ts entry.

### The provider decision, and the axis that actually decided it

The brief asked about CORS, quotas and referrer restriction. Those all mattered
less than a question that was not on the list: **may we store the result
permanently?** This app persists an address onto a stop forever, and that single
fact eliminated most of the field before price was even considered —

| Provider | Storage rule | |
|---|---|---|
| Google Places | lat/lng cacheable 30 days; only `place_id` indefinitely | ❌ |
| Mapbox | temporary use only; permanent is a paid tier | ❌ |
| HERE / TomTom | 30-day cache; "no derivative databases" | ❌ |
| Stadia | permanent storage needs a paid plan; 7-day client cache cap | ❌ |
| Geoapify / LocationIQ / Photon | permitted (OSM-derived) | ✅ |

Stadia was the painful loss: domain-based auth means **no key in the bundle at
all**, 200k credits/month, and `basemap.ts` already lists it as the tile
fallback, so one property registration would have served both. Its free plan
forbids permanently storing results, which is precisely what we do.

The two suspected disqualifiers were confirmed. Nominatim's policy names our
exact use case — *"Auto-complete search … you must not implement such a service
on the client side using the API."* ORS is weaker: the ToS renders as an empty
shell to a fetcher, and the only evidence is a maintainer answering our exact
question with *"If you don't want to expose it to the user, that is correct."*
Guidance, not a quoted prohibition — unusable for us either way.

Geoapify won on a detail worth more than the quota: it returns `address_line1`
and `address_line2`, which is exactly the title/subtitle split `types.ts` was
already designed around. We store the provider's own answer instead of parsing
`formatted`.

### 🔴 The key is unrestricted, and the design leans on that

The Geoapify dashboard offered no way to restrict the key, so it ships in the
bundle usable by anyone. Verified: a forged referrer from an unrelated domain
returns 200. **This is an accepted risk, not an oversight**, and three things
compensate:

- the free tier has no billing overage, so an abused key degrades, never bills;
- min query length, a 350ms debounce, a 30-day cache and in-flight coalescing
  keep our own consumption low;
- **Photon needs no key**, so exhaustion is survivable rather than fatal.

That last point is why the fallback is load-bearing rather than decorative. If
key restriction ever becomes available, apply it — that removes the only reason
any of the above has to be true.

### What live testing caught that unit tests could not

Three things, all found by pointing the real adapters at the real APIs:

1. **Photon throttles with 503, not 429**, and readily — firing an autocomplete
   and a reverse back to back earns one. Added a shared 1.1 req/s limiter to
   respect its documented policy, and classified 503 as `rateLimited`.
2. **Geoapify reports Danish municipalities as `city`** — "Gladsaxe
   Municipality" where a driver says "Bagsværd". `suburb` is now preferred.
3. **Geoapify exposes no rate-limit headers at all**, so status codes are the
   only signal a limiter could use.

A fourth came from the M5 smoke suite: focusing search set `searchOpen` and
nothing cleared it, so dragging the sheet down left the route list replaced by
a search screen whose field was no longer visible. The way out had scrolled
away. Leaving the expanded detents now exits search.

### Where we deliberately diverge from Spoke

- **No scan/mic icons inside the field.** Spoke has the same two verbs twice on
  one screen, with the inline pair outside the thumb's reach. Tiles only.
- **The discard dialog is un-inverted.** Spoke makes the filled, thumb-nearest
  button the one that discards, and phrases it as a double negative ("Don't add
  stop?" / "Don't add stop"). Ours: *"Discard this stop?"*, filled **Keep
  editing**, text **Discard**. `ConfirmDialog` gained an opt-in `protective`
  tone; every existing caller keeps the destructive default.
- **A Paste tile Spoke lacks.** Four tiles in a 2×2 grid rather than
  `ActionRow3Up`, whose own docstring says a fourth item would shrink the
  targets — that reasoning does not stop being true because we wanted another
  verb.

### Verified

- 348 unit tests pass; `lint` and `build` clean.
- **58/58 M5 smoke checks pass in Chromium**, including new M6 assertions: the
  D7 parcel lookup, the ASCII-to-Danish fold, and Cancel restoring the list.
- Both adapters exercised against live APIs — autocomplete and reverse.
- The importer end to end: Danish headers, a phone folded into notes, a blank
  row reported by line, a nonsense address correctly unmatched, and a TSV of
  coordinates importing with **zero** lookups.

### Deferred

- **Scan and Voice** are present as tiles announced "Coming soon" — M13, as
  specified.
- **`details()` is a no-op.** Both providers return coordinates straight from
  autocomplete, so neither implements it. The seam exists for a provider that
  bills a separate details call.
- **No XLSX round-trip test against a real file.** The XML parsing is tested
  against hand-written fixtures; the ZIP reader is not, because generating a
  real .xlsx in a Node test needs the dependency the reader exists to avoid.
- **Desktop is still untouched** — the sidebar has no search.
- ETAs still absent (M7); amber/teal chip contrast; cross-origin isolation.

### What the next session needs to know

1. **The key is public and unrestricted.** Treat the quota as a shared, hostile
   resource. Before adding any geocoding call, ask what stops it firing per
   keystroke — `service.ts` is where that policy lives, not the components.
2. **`lib/searchScreen.ts` owns matching.** The Danish folding is not
   decoration: `ø` and `æ` have no canonical decomposition, so NFD alone leaves
   a Danish route unsearchable from an ASCII keyboard. Extend the fold map, not
   the components.
3. **`addStops` now takes `NewStopInput[]`** (`LatLng & { address? }`). Bare
   `LatLng[]` still type-checks, so M1 callers are unaffected.
4. **The bench seeders no longer name a DB version.** They broke on the 4 → 5
   bump; opening without one keeps the harness unpinned from any release.
   Don't reintroduce a literal.
5. **`AddByPin` must render inside `MapControllerContext`** — it reads the
   camera. That is why it lives in `MapComponent` and is driven by a store flag
   rather than a prop.
6. **`DEFAULT_TTL_MS` in the cache is a licence decision**, not a performance
   one. 30 days is defensible under Geoapify + the OSMF guideline; LocationIQ's
   free plan would cap it at 48 hours.

## M7 — The driver's surface: the stop carousel

The milestone with the app's signature interaction in it. Stop detail stopped
being a stub and became the surface a driver actually works in.

### What changed

- **The paged carousel.** One page per stop, swiped horizontally inside the
  sheet, with the map camera moving in lockstep behind it.
- **Stop detail states** — pending / delivered / failed, with the completion
  card and the promotion/demotion of the primary action.
- **The end location** as the last page, with a different grammar.
- **Failure reasons**, which are our invention and are flagged as such below.
- **Swipe a row** right for delivered, left for failed, again to undo.
- **Edit stop**, with route-scoped groups, the settings list, and sticky
  per-address defaults behind "Set Default ☆".
- **The route menu** — Spoke's nine items, our information architecture.
- **Real arrival times**, which `routeSummary.ts` had been asking for by name.

`SCHEMA_VERSION` is still 5, and the zustand persist version is still 4.
Everything M7 persists is additive: two optional fields on a stop, two on the
optimised route, and one new top-level slice. A blob written before this simply
lacks them and the shallow merge leaves the defaults in place.

### The signature interaction, and what it cost

The carousel is three DOM pages regardless of route length: the current one in
normal flow — it is what gives the sheet's scroller its height — and the
neighbours absolutely positioned at ±100%.

**There is no local index state, and that is the interesting part.** The URL
owns which page is showing. That sounds like it must cost a frame, but wouter's
hash `navigate` dispatches `hashchange` SYNCHRONOUSLY and `pointerup` is a
discrete event, so React flushes before paint and the slide starts on the frame
the finger lifted. The usual answer — an echo of the index that "leads" the URL
— is a trap: two swipes in quick succession leave the echo and the URL
disagreeing, and the card visibly snaps back to a page the driver already left.

On commit the NEW page is rendered in flow, the track is instantly placed where
the finger left it *expressed in the new page's coordinates*, and only then
transitioned to zero. The card carries on from where the thumb released it
rather than jumping and starting again.

### 🔴 The bug that took the longest, and would have taken longer on a device

`RouteSheet` calls `setPointerCapture` in its `pointerdown`, before it knows
what kind of gesture it has. It has to: dragging the sheet open moves the
finger off the top of the sheet's own box, and without capture the moves stop
arriving.

But **pointer capture RETARGETS every later pointer event to the capturing
element**. From that moment `pointermove` is dispatched at the sheet and travels
only through the sheet's ancestors — a card nested inside it never receives one.
The obvious implementation (a React `onPointerMove` on the card, `stopPropagation`
once the gesture is ours) therefore has nothing to stop propagating. The card sits
perfectly still while the sheet quietly decides the gesture was vertical.

`useHorizontalDrag` listens on `window` in the CAPTURE phase instead, which runs
before React's root listener whatever the target is, and stops propagation there.
`pointerup` is deliberately allowed through — the sheet clears its drag in that
handler, and swallowing the release leaks a drag that never ends.

A second bug in the same hook: its "don't steal from a control" guard used
`closest('[role="button"]')`, and a list row IS a `role="button"` — it has to be,
the whole row is the tap target and it carries its own trailing controls. The
guard matched the drag surface itself and declined every swipe on the list.
`control !== e.currentTarget` is the fix and it is load-bearing.

### Arrival times: where the clock is anchored

`arrivalSec` was empty and `routeSummary.ts` said, in its own docstring, that M7
should REPLACE its approximation rather than refine it. OSRM returns per-leg
durations and distances on every route response and the M2 pipeline discarded
them; keeping them is what makes an arrival real.

The plan is stored RELATIVE — seconds from the route's start — because that is
the only form that survives being stored: a route solved at 08:00 and opened at
14:00 has not changed shape, only when it is happening.

The anchor is the decision worth recording. **The next pending stop is reached in
the time the leg into it takes, starting now.** Not its planned arrival, which
would read "you are there now" and is true at exactly one instant; and not the
route's planned start, which would leave a driver who set off late seeing times
wrong by the same amount all day — precisely the failure that makes people stop
believing an ETA.

Handled stops get no ETA at all. An estimated arrival at a door you have already
been to is not stale information, it is noise — and dropping it is what makes the
completed state read as finished.

The ETAs are computed ONCE per tick in `RouteSheet` and shared with the rows and
the card. Two computations would anchor to two instants and let a row read 16:03
while its own card read 16:04.

### Where we deliberately diverge from Spoke

- **The route menu's IA.** Spoke's is nine flat items with the only destructive
  one rendered in the same black as the other eight — breaking the
  red-means-destruction convention Spoke follows everywhere else in its own app.
  Ours: three sections separated by a gap (share/move, reorder/renumber, bulk
  in/out), and the destructive item alone, last, and red. All nine items and all
  their behaviour are kept, as is the "…" convention.
- **A map tap no longer discards the card.** In M4 selecting a stop only tinted
  its marker and a map tap was the only way out. Now a marker tap opens the card
  and the card has its own X, so a stray tap discarding it would be a hazard —
  the map is exactly where a driver looks while the card is up.
- **Swiping between stops REPLACES history; opening a stop PUSHES.** A round is
  44 stops and can be 300; pushing each swipe would bury the route under a stack
  the driver has to walk back through one card at a time. Browsing is not
  navigating.

### 🟡 Our invention: the failure reason

Spoke's screenshots show the failed STATE but never the capture, so this is
designed rather than copied, and two decisions are recorded rather than assumed:

1. **The tap marks the stop immediately**; the reason sheet is a skippable
   follow-up. A modal standing between the driver and the action they asked for
   gets dismissed by reflex, and then the status is wrong — a missing reason is
   visibly missing, a wrong status is not.
2. **Five options, worded about the world rather than about blame** — "Nobody
   home", not "Customer unavailable". These end up in a message to a dispatcher
   and a driver should not have to accuse anyone to file one.

A reason cannot outlive its failure: undo, restore-all and duplicate all clear
it. The completion card offers "Add a reason" when it was skipped, so the one
dismissible step is not also the only chance to take it.

### Verified

- 440 unit tests, `lint` and `build` clean.
- **65/65 M7 checks** in Chromium, including the camera lockstep read off the
  LIVE MapLibre camera, both cards on screen mid-flight, three DOM pages at 300
  stops, every edit surviving a reload, and a new stop at a remembered address
  arriving with its door code.
- 58/58 M5, 41/41 M4, 42/42 M1. M3 is 50–51/52 for a reason that predates this
  milestone; see Deferred. `bench:verify-seam` passes — `__ui`, `__bench` and
  `__crash` are still absent from production.
- Haptics: `navigator.vibrate` is feature-detected, never platform-branched.
  The brief recorded "Android only", and as of 2026 that is no longer settled —
  MDN's compat data carries an open report of it working on iOS Safari while
  caniuse still shows none, and Apple has attached a user-gesture requirement.
  Detecting the method makes the disagreement irrelevant.

### 🔴 What the acceptance suite caught that nothing else would have

**Three checks passed vacuously before they passed honestly**, and all three
failed in a way that looked like a timing flake:

1. Every swipe check dispatched touches at `y > 844`. The list is virtualised
   with an overscan, so a row can be in the DOM with a rect far below the
   viewport, and a synthetic touch there lands on nothing at all — silently.
2. Every card selector matched THREE elements. A carousel holds three copies of
   the same card, and Playwright taps the first, which is a full screen width
   off to the left. `[data-page-role="current"]` scopes them now.
3. The M7 fixture had to be respaced. The M5 one packs 300 stops into a few
   hundred metres, and at zoom 16 two neighbours differ by a fraction of a
   degree that rounds away — a camera check on that data passes whether the map
   followed or not.

### Deferred

- **Photo capture** — the camera-plus icon is present and disabled. M13.
- **Navigate is a URL stub** (`googleMapsSearchUrl`), as specified. M13.
- **Share route copy, Transfer stops, Scan route manifest** — announced and
  disabled in the menu, as specified.
- **Change address** is announced and disabled in the edit form. M6 owns the
  search screen and it lives inside the route sheet; reaching it from a
  full-screen modal is a flow of its own.
- **Real-device FPS and the thumb tests** are still outstanding — §15–17, now
  three milestones old. The 88dp action row and the swipe are exactly the things
  a desktop Chromium cannot judge.
- **`labelLinesFor` still reads `stop.etaSec`**, which nothing sets. The map's
  marker labels therefore show no ETA even though the sheet's do. Fixable by
  feeding the same map in; not done because the marker label is already two
  lines and a third would need a design decision.
- 🟡 **M3's "tapping the exposed strip closes the drawer" fails**, and failed
  identically at b7c2dea — the commit before this milestone, checked by building
  that commit and running the suite against it. Left alone rather than fixed as
  a side effect of unrelated work.

  It cascades: the drawer is still open when the next check runs, so "Escape
  closes the drawer" then fails intermittently too and M3 reports 50 or 51 of
  52 depending on timing. One root cause, two symptoms. Worth an hour of
  someone's time — a drawer that cannot be dismissed by tapping outside it is a
  real defect, not just a failing assertion.
- Amber/teal chip contrast (M5); cross-origin isolation (M0); desktop is still
  the M1 sidebar.

### What the next session needs to know

1. **`useHorizontalDrag` listens on `window` in the capture phase, and that is
   not an implementation detail.** Anything else that wants a horizontal gesture
   inside the sheet must go through it, because a React handler on the element
   will never fire — see the pointer-capture note above.
2. **The URL is the source of truth for which stop is open.** `selectedStopId`
   mirrors it, never the other way round. Anything that wants to open a stop
   navigates; writing the selection directly is immediately overwritten.
3. **`lib/stopDetail.ts` owns which actions are prominent.** The rule that the
   primary slot holds exactly one thing is asserted there, not in the card. If a
   new state needs a new arrangement, it belongs in that function.
4. **Both routes in `routes.tsx` must keep pointing at the same component.**
   Wouter's `Switch` reconciles them as one element only because the `component`
   prop is identical; splitting them rebuilds the map on every stop opened.
5. **Groups are ROUTE-SCOPED and address defaults are GLOBAL.** That asymmetry is
   why `groupId` is excluded from a saved default — the id would resolve to a
   different group, or to nothing, on tomorrow's route.
6. **`retargetGroup` lives in the store's `updateStop`, not in the form**, so an
   importer or a bulk edit gets the purple/teal rule too. A group the driver
   chose is never overwritten; that is the invariant that makes it tolerable.
7. **M8 inherits a live-editing form.** `EditStopSheet` writes straight through
   and "Done" only closes. When staged changes arrive, that is the layer to put
   them in — a form with its own draft on top would give the app two levels of
   uncommitted state.

## M8 — Staged changes: nothing moves until you say so

The milestone the whole app was building towards. Mid-route edits are the
highest-stakes moment in a delivery app, because the driver has PHYSICALLY
SORTED PARCELS to match the sequence on their screen. An app that silently
reoptimises destroys that; one that silently appends produces a stupid route.

### What changed

- **Staged mode.** Adding, removing or editing a stop on an OPTIMISED route
  accumulates in `PendingChangeSet` instead of writing through.
- **A live preview** — order and ETAs — computed from a cached matrix, so the
  cost of a change is visible before committing it.
- **The review screen**, at `/route/:routeId/review`, with three sections and
  a deliberately asymmetric bottom bar.
- **The commit sheet**: two models, one line of consequence each.
- **Two commit algorithms** — cheapest-insert into a frozen sequence, and a
  full re-solve.
- **The cost-matrix cache**, which had been declared since M2 and written by
  nothing.
- **Decimal stop IDs on insert**, from where the stop actually lands.

`SCHEMA_VERSION` is still 5 and the zustand persist version is still 4.
`PendingChange` changed shape, but nothing had ever written one — `stageChange`
existed since M2 with zero callers — so there is no data in the old shape
anywhere. The `matrices` store gains an optional `keys` field; a row without it
is treated as a miss rather than migrated, and there are no such rows.

### The decision the milestone turns on

**Staged stops live in the change set, not in `route.stops`.**

The alternative — write the stop in and flag it — looks tidier and makes
Discard an UNWIND: delete the added stops, resurrect the removed ones, release
the labels, put back the edited fields. Every one of those is a place to get it
wrong, and getting it wrong loses a driver's work silently.

Holding the whole `AddressedStop` inside the `add` change makes Discard a single
assignment: `pending = undefined`. There is nothing to unwind because nothing
was ever done. The cost is a pure `stagedStops(route)` merge that the map, the
carousel, the edit form and the sheet all read, and that cost is paid once in
`lib/staging.ts` rather than at every call site.

### Where the line between staged and direct is drawn

**Staging engages only when the route has been optimised.** An unsolved route
has no sequence to protect and no parcels sorted against it, so putting a review
screen in front of building a round would be a review of nothing — and would
break every M6 flow at once.

**Only plan-affecting fields stage**: `lat`, `lng`, `address`, `twOpenSec`,
`twCloseSec`, `serviceTimeSec`. That list is defined by what `lib/provisional.ts`
actually reads, not by what sounds route-ish.

🟡 **`order` and `kind` were in that list and came out**, and the reason is worth
recording. Both sound like they belong. Neither reaches the plan: the planner
takes its endpoints from the route's own anchors and never looks at `order`, and
nothing anywhere honours pickup-before-delivery. Staging them would have put
changes on the review screen that provably move nothing — the exact "diff full
of noise" the split exists to prevent — and `kind` also drives the automatic
purple/teal group rule, which operates on the committed stop and would have been
left reading a value the driver had already changed. **M9–M11 should move them
back in when the solver learns to read them.**

**Bulk removals bypass staging.** `removeStopNow` exists for the Remove-stops
sheet, which already confirms by name and count. Two gates in a row teaches a
driver to clear both without reading. Bulk ADDS — import, copy stops — do stage,
because a batch appended silently to an optimised route with no diff is the
failure this milestone exists to remove.

### The two commit models

**Update route** — the preview already IS the answer. `lib/provisional.ts` froze
the sequence and cheapest-inserted the new stops into it; committing takes that
exact order and makes it real. No solver call, no second insertion pass. Running
the arithmetic again at commit time would let the committed route differ from the
one the driver read and agreed to, which is the single thing this screen exists
to prevent. The only network is one OSRM route request for the real polyline.

**Reoptimise route** — apply the changes, then run the existing pipeline. The
solver's internals are untouched, as specified.

The insertion cost is the DETOUR, not the two new legs:

    d(prev, new) + d(new, next) − d(prev, next)

🔴 **At an open end there is no displaced leg to subtract**, and the first
version subtracted one anyway. A `d(prev, next)` that does not exist evaluates
to nothing, which made an open end cost zero and win every gap — every stop got
appended, and the route looked plausible enough that only a fixture on a
straight line caught it.

Feasibility is a forward pass with waiting: arriving early is not a violation
(the driver waits, and the wait propagates downstream); arriving late is,
because no amount of waiting fixes late. When no gap is feasible the stop is
**still placed**, at the cheapest one, and the result says so. A parcel with
nowhere to go is worse than a route that admits one window will be missed.

### The matrix cache, which is what makes the insert cheap

`db.ts` has had a `matrices` object store since M1 and `Route.matrixCacheKey`
has been declared since M2. Nothing had ever written to either. Without it,
inserting one stop into a 44-stop round means refetching 1,936 cells to learn 88
new ones.

**Rows and columns are labelled with the stop's UUID, never with its index.** An
index means "the nth point of the list that was solved", so deleting one stop
shifts every index after it and every later lookup silently reads the wrong pair
— producing a route that is merely a bit worse than it should be, which is the
hardest kind of defect to ever notice.

`fetchCostBand` makes the extension two requests regardless of route length:
`sources = the new points` gives every new→old cell, `destinations = the new
points` gives every old→new, and the new→new block falls out of the first. OSRM
documents both parameters as accepting a subset of the input locations, which is
what makes the asymmetric request legal.

### 🔴 The two bugs the acceptance suite caught, and both were mine

Both came from the same root cause — **giving two halves of one screen different
plans to read** — and neither would have been visible in a screenshot.

1. **Staging anything made handled stops vanish.** The provisional plan follows
   `calculateRoute`'s "pending stops only" convention, and `stagedRoute` swapped
   it in wholesale for display. A driver twenty stops into a round who staged one
   add would have watched twenty delivered rows disappear from their list.
   Handled stops now come back into the ORDER at zero cost while staying out of
   the PLAN — spliced in where the committed plan had them, with an arrival that
   collapses forward so every array stays the same length and every total stays
   intact.

   A stop staged for REMOVAL deliberately does *not* come back with them. It is
   absent from the plan for a different reason, and putting it in the order would
   make `liveEta` count it as still to come — so the preview's finish time would
   include a stop the driver is removing, which is the one number the whole
   screen exists to get right. The map still draws it, wearing its red trash
   chip, from `stagedStops` rather than from the order.

2. **The end card read 07:26 while the finish pill read 07:25.** M7 recorded
   this exact failure and solved it by computing the ETAs once per tick; staging
   reintroduced it by moving the map to the provisional plan and leaving the
   sheet on the committed one. The whole sheet now reads `stagedRoute`.

### Where we deliberately diverge from Spoke

- **"2 changes", not "2 stops".** Spoke's header count is ambiguous in the one
  place it cannot afford to be — it could mean two stops changed or that the
  route has two stops — and a driver at a kerb has to open the screen to find
  out which. Ours names the unit it counts.
- **The count is the way back.** Spoke's review header has no exit except the
  system back gesture, which on iOS is an edge swipe that competes with the
  sheet's own drag. Making the count itself the back control costs no extra
  chrome and puts the exit where the eye already is.
- **Added stops appear TWICE**, once in their own section and once inline in the
  existing route. The first version left them out of the route, which looked
  tidier and was wrong twice over: the numbering came out 1, 2, 4, 5 with a hole
  where the new stop goes — which reads as a rendering bug — and the added row's
  "goes in at 3" then sat above another row also claiming 3. The top section is
  the actionable summary, where undo and the run colour live; the inline row is
  the consequence.
- **Every change is individually undoable** from its own row. A review screen you
  can only accept or abandon wholesale makes Discard the only way to fix one
  mistaken tap.

### The "times are counted from now" hint

ETAs are anchored to NOW rather than to the route's planned start — M7's
decision, and the only anchor a driver keeps believing. The consequence is that
a stale route poked at 19:23 reports a finish of 19:56, which is arithmetically
correct and looks like a bug.

`planIsStale` decides when to say so: a plan touched more than an hour ago, or
made on an earlier day. The threshold is a whole hour on purpose — a round
running forty minutes late is the normal case, and a hint that appeared then
would become wallpaper.

### Verified

- 526 unit tests, `lint` and `build` clean.
- **35/35 M8 checks** in Chromium, including the zero-network proof, the
  insertion position on a fixture where cheapest-insert has exactly one right
  answer, and a REORDER check run against a deliberately scrambled committed
  order — because "Update" preserves a scramble by definition, so an order that
  comes back monotonic can only have come from the other model.
- 65/65 M7 (after the suite was updated — see below), 58/58 M5, 41/41 M4,
  42/42 M1. M3 is 51/52 for the reason that predates M7.
- `bench:verify-seam` passes; `__ui`, `__bench` and `__crash` still absent from
  production.

**The zero-network proof.** Marking a stop delivered re-anchors every arrival on
the route — the anchor moves to the next pending stop, so all seven ETAs, the
finish pill and the summary strip change. The suite asserts the finish time
actually moved AND that the request count did not. The row is SWIPED rather than
tapped so the camera never moves; basemap tiles are excluded from the count and
nothing else is, because the basemap is a different host and a different
subsystem that fetches whenever the camera moves and has no opinion about
arrival times.

### What the M7 suite had to absorb

`addStops` now returns the ids it created, and on an optimised route that is the
ONLY way to find them — the stop is staged and never lands in `stops`. M7's
sticky-settings check reached in for `stops[stops.length - 1]`, got stop 300,
and reported its missing door code as a failure of the address-defaults feature.
The same pattern was fixed in `MapComponent`'s "add and edit" flow.

### Deferred

- 🟡 **The move GESTURE.** The `move` change kind is fully implemented — pinned
  position, provisional route, both commit algorithms, `applyMove` with its
  tests — and nothing in the UI produces one. Long-press drag-to-reorder against
  a virtualiser that measures rows dynamically is a milestone-sized feature, and
  the M7 note about pointer capture applies to it in full. The model is ready
  the day someone builds the gesture.
- **The review screen's magnifier** is announced and disabled. Searching a diff
  of two rows is not a thing anyone needs, and it stops being true somewhere
  north of twenty.
- 🟡 **A solve drops handled stops from `orderedStopIds`.** `calculateRoute`
  passes only pending stops to the planner, so after a real optimisation the
  route list and carousel show only what is left. Pre-existing, not introduced
  here, and masked in every suite by hand-seeded fixtures that list all 300.
  M8 works around it in the provisional (see the bug note above) rather than
  fixing it, because fixing it means changing what a solve produces.
- **Photo capture**, **Navigate**, **Share route copy**, **Transfer stops**,
  **Scan route manifest**, **Change address** — all still as M7 left them.
- **Real-device FPS and the thumb tests** — §15–17, now four milestones old.
- **`labelLinesFor` still reads `stop.etaSec`**, which nothing sets, so map
  marker labels carry no ETA.
- M3's drawer-dismissal defect; amber/teal chip contrast; cross-origin
  isolation; desktop is still the M1 sidebar.

### What the next session needs to know

1. **`lib/staging.ts` is the only place that knows what "staged" means.**
   `stagedRoute(route)` is what every surface reads — map, carousel, edit form,
   sheet. Anything that reads `route.stops` directly on a screen will be wrong
   the moment something is staged, and wrong invisibly.
2. **The preview is an OUTPUT, and `useProvisionalRoute`'s signature must never
   include one.** Publishing the preview writes to the route, which re-runs the
   effect; the guard is a signature over the changes, the frozen order and the
   statuses, and it deliberately excludes both the preview itself and the labels
   it hands the added stops. Include either and every staged add recomputes
   forever, fetching two OSRM rows each time round.
3. **Commit takes the preview's order verbatim.** `useApplyChanges.update` does
   not re-run the insertion. If it did, the committed route could differ from the
   one the driver read and agreed to.
4. **Matrix rows are keyed by stop uuid.** Any future work on the matrix layer
   (M12) must preserve that. Index-keyed rows are wrong the first time a stop is
   deleted, and wrong silently.
5. **`joinOrderedStopIds` is now shared** between `calculateRoute` and M8's
   commit path, and it consumes each coordinate match as it is used. The old
   hand-rolled copy kept only the first stop at a shared coordinate, which
   dropped the second delivery to a building from the itinerary entirely.
6. **`PLAN_FIELDS` is a claim about the solver, not about the domain.** When
   M9–M11 teach it pinned order and pickups, `order` and `kind` go back in.

## M9 — The seam: one port, four tiers, and an engine that beats the old one

The milestone that stopped the app knowing what its optimiser was. Everything
above `lib/compute/` now speaks only `SolveRequest` and `SolveResult`; below it,
engines can be TypeScript, workers, WebAssembly or a hosted service, and several
can coexist and be compared on the same instance by the same referee.

The headline is not the abstraction, though. It is that the replacement engine
is **better than the thing it replaced**, and that the app stopped telling iOS
and Firefox users to go and find Chrome.

### What changed

- **`lib/compute/solverPort.ts`** — the interfaces, the `SKIP_PENALTY`, and the
  referee. The matrix is a flat `Int32Array` indexed `m[i*n+j]`, everywhere.
- **`lib/compute/engineTs.ts`** — a real engine: cheapest-insertion construction,
  2-opt + Or-opt(1–3) over K-nearest candidate lists with don't-look bits,
  add/drop/swap, ruin-and-recreate, driven by ILS with a double-bridge kick.
- **`lib/compute/registry.ts`** — tiers A–D from M1's capability detector, with
  claimed and resolved tiers tracked separately.
- **`lib/compute/engineTsWorkers.ts`** — tier B, the default: N seeded workers,
  best-of, with a protocol built for transferables because M10 will reuse it.
- **`lib/compute/engineOrToolsLegacy.ts`** — the old solver, behind the same
  interface, reachable only from the dev seam. It is the correctness oracle now.
- **Cancellation that cancels**, and progress that reports.
- **`coi-serviceworker` off the production path.**
- **The benchmark runs every engine**, and TSPLIB gives an absolute gap.

### The numbers

TSPLIB, 1 s budget, gap to **proven optimum** — the only absolute measurement in
the harness, and the reason it was worth adding:

| engine | mean gap | worst | optimal on |
|---|---|---|---|
| `ts` (tier D) | 0.45% | 2.71% | 7/12 |
| **`ts-workers` (tier B, default)** | **0.13%** | 0.93% | **9/12** |
| `ortools` | 1.54% | 4.23% | 2/12 |

On the M0 grid, instances where OR-Tools produces the best route fell from 6 to
4 of 18 as the search was fixed. On the real 107-point OSRM instance at K=20 the
worker pool beats OR-Tools by 15.7% of travel cost, and does it in 3 s where
OR-Tools takes 3.6 s.

### What surprised me

**The old solver was worse than a plain local search, and by a lot.** M0
predicted it — best-of-seven *construction* with no local search, because the
WASM binding never forwarded a metaheuristic — but a 14% improvement in a tenth
of the time on the first instance I measured was still startling. OR-Tools is
excellent software; we were never running the part of it that does the work.

**Asymmetry makes the textbook 2-opt delta wrong, not merely imprecise.**
Reversing a segment flips every arc inside it, and the usual four-term delta
silently omits the cost of turning it round. An engine using it accepts losing
moves and cannot tell. Forward/backward prefix sums make the exact term O(1) for
any (i,j); the tests exhaust every legal (i,j) against a full recompute rather
than sampling, which is the only reason I trust it.

**Two bugs were in the driver, not the moves, and both were invisible.** Three
independent draws for the double-bridge cut points collided about half the time
on a short route, so the perturbation quietly did nothing while still counting
as a failed iteration. And exhausting patience *returned* rather than
restarting, so an 8-stop instance quit after 40 perturbations with 119 ms of its
budget unspent and settled 17% above an optimum it could have brute-forced. Both
only showed up because the tests brute-force small instances.

**The decoy family earned its keep.** Both TS engines returned *identical*
routes there from different seeds — the signature of every seed falling into one
trap. When K binds, the expensive question is which stops, not their order, and
neither a double bridge nor a 1-for-1 swap can answer it: trading one ring stop
for one cluster stop 18 km away pays the whole detour to gain one delivery, so
every individual swap is correctly rejected and the route never leaves the ring.
Ruin-and-recreate with a forced random seed, plus a 2% uphill drift allowed only
when the cap binds, is what got out.

**The skip penalty hid the differences it was meant to expose.** With 85 stops
skipped, the objective carries a constant 850,000,000, and two engines whose
driving differs by 15% both report "+0.00%". The bench now measures gaps on
travel cost when the skipped counts match.

### Verified

- 591 unit tests. Deltas checked against a full recompute over **every** legal
  (i,j), segment, gap and orientation on asymmetric fixtures. Exact optimum found
  on 360/360 brute-forced instances at n=7–9.
- In a real browser, against the pruned bundle: engine selection, the worker
  pool, progress reports, and cancellation at **74 ms**.
- **With `coi-serviceworker` 404'd** — what an iOS Safari visitor to GitHub Pages
  actually gets — `crossOriginIsolated` false, `SharedArrayBuffer` undefined, and
  a 14-node instance solved correctly. That configuration threw before M9.
- `bench:verify-seam` passes and now also asserts no OR-Tools symbols and no
  `.wasm` in production output. `or-tools-wasm` is a devDependency.
- **A worker that fails to load no longer hangs the app.** Found while auditing
  the milestone, not by a test: `worker.onerror` was empty on the assumption
  that a dead worker reports itself through its job's `failed` message. It does
  not — a worker that 404s never runs our code, so its share of `outstanding`
  was never credited and the solve promise never settled. "Optimizing route…"
  forever, no error, no timeout. The pool now drops the worker, credits every
  job in flight, and answers in-process. Verified by serving the bundle with
  every `solveWorker` chunk 404'd: both a first and a second solve return valid
  routes.
- The M1/M4/M5/M7/M8 acceptance suites still pass (42/42, 41/41, 58/58, 65/65,
  35/35). M3 is 50/52 — the drawer-dismissal defect M8 already deferred, in a
  surface M9 does not touch.

### Deferred

- 🟡 **The tier-D engine still trails on two decoy instances** (+6.3% at n=25,
  +9.2% at n=50). The shipped default is tier B, which wins or ties both; a
  single-core device gets the weaker answer. Fixing it properly means a stronger
  selection neighbourhood, which is M10 work.
- **No tier A or C engine exists.** A Turbo-capable phone runs Fast and the badge
  says so. M10 fills C, M15 fills A.
- **VRPTW is parsed and not scored.** Solomon and Gehring-Homberger have a
  hierarchical objective (vehicles first, then distance) plus windows and
  capacity; with all of that relaxed, a gap number answers a different question.
  The parser and SINTEF's best-known table are in `bench/lib/vrptw.mjs` for M11.
- **`scripts/prune-wasm.mjs` is now a no-op for production** — nothing it prunes
  reaches `dist` any more. Left in place; the bench build still uses it.
- **The OR-Tools heap leak is unchanged** — the endurance probe still dies around
  solve #12. It no longer affects users, because users no longer run OR-Tools.
- Everything M8 deferred: the move gesture, photo capture, Navigate, real-device
  FPS, `labelLinesFor` reading an unset `etaSec`.

### What the next session needs to know

1. **`SolverEngine` is the contract, and `toResult` is where every engine ends.**
   A new engine returns an order; cost, distance and arrivals are computed once,
   for everyone, so two engines cannot disagree about what a route is worth.
2. **Nothing trusts an engine's own score.** The worker pool re-validates and
   re-scores every worker's answer before letting it win, and Node re-scores
   everything the browser returns. Keep it that way.
3. **The flat matrix is the whole point.** `planRoute` converts once, at the
   boundary with the network adapter. M10 copies that buffer straight into WASM
   linear memory with one `set()`. Do not reintroduce `number[][]` below that line.
4. **The tour is an array with a position index so M11 can add Vidal's four
   labels** (duration, time warp, earliest start, latest start) to the same
   prefix arrays the 2-opt reversal term already uses. A linked list has no
   index, so it has no prefixes, and M11 would be a rewrite. The exact
   concatenation recurrences are transcribed in the M10 research notes.
5. **Cancellation latency is the yield interval** (~12 ms). M10's WASM engine
   cannot yield mid-call, so it must chunk its solve — and because M9 removed
   cross-origin isolation there is no `SharedArrayBuffer` for a shared cancel
   flag. Poll between chunks.
6. **`npm run bench` needs `npm run bench:tsplib:fetch` once**, and the TSPLIB
   cache is gitignored on purpose.

---

## M10 — The real engine: Rust, wasm32, and 45 KB instead of 16 MB

**Status: the engine is built, wired, and shipping. Two deliverables are
incomplete and listed under Deferred — the n = 1000 benchmark grid and the
real-device runs.**

### What changed

A Rust crate in `engine/`, compiled to `wasm32-unknown-unknown`, replacing the
TypeScript search as the engine every multi-core device actually runs.

```
engine/src/
  matrix.rs       flat row-major i32 cells + K-nearest candidate lists
  problem.rs      the question: costs, candidates, optional flags, cap, pins
  tour.rs         array + position index + forward/backward prefix sums,
                  exact O(1) deltas, and Vidal's four labels (unwired, for M11)
  construct.rs    cheapest insertion under the cap, restarts, greedy refill
  localsearch.rs  2-opt, Or-opt(1..3), don't-look bits, add/drop/swap
  driver.rs       ILS with double-bridge; GLS; ILS-then-GLS
  ffi.rs          eleven exported functions, zero imports
  rng.rs          mulberry32, bit-identical to solverPort.ts
```

On the TypeScript side, `wasmModule.ts` loads and instantiates it, `engineWasm.ts`
implements `SolverEngine` around it, and the worker pool became engine-agnostic
so tier B runs Rust rather than TypeScript.

### The one rule, and how it is enforced

The matrix and every working array live inside linear memory. Setup crosses the
boundary a fixed number of times regardless of n — allocate, write, create, free
— and then `engine_step` runs thousands of move evaluations per call without
returning to JS once.

This is not a claim in a comment. **The module declares no imports**, so there is
no JavaScript function for the search to call, and `scripts/build-engine.mjs`
fails the build if an import section ever appears. The import object in
`wasmModule.ts` is literally `{}`.

For contrast, verified again this session at the source level on the version we
ship — `or-tools-wasm@0.9.1`, still the newest release:

```js
// node_modules/or-tools-wasm/build/javascript/browser/routing_api.js:358
this.installMatrixEvaluator()          // ← a JS closure, called per arc
this.module._routing_solve_with_parameters_ext(
  this.handle,
  parameters.firstSolutionStrategy ?? 0,
  parameters.solution_limit ?? 0)      // ← three arguments
```

`local_search_metaheuristic` appears exactly once in the entire package, as a
TypeScript field declaration, and is never serialised.

### Why it is a state machine

A wasm call cannot yield, cannot be interrupted, cannot read a clock
(`std::time` does not work on this target), and there is no `SharedArrayBuffer`
for a cancel flag because M9 dropped cross-origin isolation to make iOS Safari
work.

So control is inverted. `Driver` holds every variable the loop would have kept on
its stack, `engine_step(budget)` runs a bounded amount of work and returns, and
the host decides between calls whether to continue. Cancellation latency is one
step; the host sizes a step to ~15 ms by measuring the last one.

The yields use `MessageChannel`, not `setTimeout(0)` — nested timeouts are
clamped to 4 ms, which against a 15 ms step throws away a fifth of the budget.

### The numbers

Real browser, headless Chromium, the pruned production bundle served without
COOP/COEP headers — the closest local reproduction of GitHub Pages. Gap on
travel cost against the best any engine found for that instance.

| instance | `ts` | `ts-workers` | `wasm` | `wasm-workers` |
|---|---|---|---|---|
| sample n107 k20 | +6.54% | +6.31% | **best** | **best** |
| sample n107 k50 | +7.09% | +0.21% | +0.03% | **best** |
| sample n107 k105 | +2.29% | **best** | +2.29% | **best** |
| uniform n25 k23 | best | best | best | best |
| uniform n25 k11 | +12.92% | **best** | **best** | **best** |
| clustered n25 k23 | best | best | best | best |
| clustered n25 k11 | best | best | best | best |
| decoy n25 k9 | +9.03% | +9.03% | **best** | **best** |
| uniform n50 k48 | best | best | best | best |
| uniform n50 k24 | best | best | best | best |
| clustered n50 k48 | best | best | best | best |
| clustered n50 k24 | +2.63% | **best** | **best** | **best** |
| decoy n50 k19 | +10.83% | +10.83% | **best** | **best** |
| uniform n107 k105 | +0.06% | **best** | +0.06% | **best** |
| uniform n107 k52 | +8.65% | +1.08% | **best** | **best** |
| clustered n107 k105 | best | best | best | best |
| clustered n107 k52 | **+30.04%** | +3.92% | **best** | **best** |
| decoy n107 k42 | +10.45% | +0.18% | **best** | **best** |
| **instances won** | 7 | 11 | 15 | **18 of 18** |

`wasm-workers` — what a multi-core device now runs — is best or tied on **every
instance in the grid**. Single-threaded `wasm` wins 15 and loses three by at most
2.29%.

The decoy family is the one M9 built specifically to break greedy selection, and
the one M9 deferred as a known tier-D weakness. The Rust engine takes all three,
by 9-11% of travel cost.

And it is not spending longer to do it. On the 107-point OSRM instance at K=20:

| engine | wall | travel cost |
|---|---|---|
| `ts` | 3023 ms | +6.54% |
| `ts-workers` | 3060 ms | +6.31% |
| **`wasm`** | **820 ms** | **best** |
| **`wasm-workers`** | **781 ms** | **best** |

Better route, in a quarter of the time. The pattern repeats wherever the K cap
binds: the TypeScript engine spends its entire 3 s budget, and the Rust engine
converges in a few hundred milliseconds to something better.

Against OR-Tools: M9 measured `ts-workers` beating it by 15.7% of travel cost on
this instance, and `wasm-workers` now beats `ts-workers`.

Node, clustered instances, equal wall-clock, against `ts`:

| n | budget | `wasm` (ILS) | `wasm` (GLS) |
|---|---|---|---|
| 100 | 1 s | 0.00%, converged in 319 ms vs 797 ms | 0.00% |
| 300 | 3 s | −0.03% | +0.53% |
| 1000 | 5 s | −1.04% | **−1.93%** |

### Artefacts

```
artefact      size      imports   max memory
scalar        48.7 KB         0    256 MB
simd          50.6 KB         0    256 MB
```

Against or-tools-wasm's ~16 MB routing runtime. Both are emitted; one is fetched.

### What surprised me

**Rust is worth about 2x, not 10x, and the honest research said so.** The blogs
promise 8-10x. Jangda et al. (USENIX ATC '19) measured WebAssembly itself at
1.45-2.5x *slower than native*, and our TypeScript engine was already monomorphic
TypedArray code that V8 compiles well. The large win on the real instance is
mostly that the Rust engine converges in a quarter of the time and then spends
the rest of the budget finding a better route — not that any individual
operation got dramatically faster.

**SIMD bought nothing, exactly as predicted.** WebAssembly's v128 deliberately
omits gather, and candidate-list local search is gather-bound: every probe is a
random `m[i*n+j]`. Scalar and SIMD produce byte-identical routes in
indistinguishable time. Both ship because the brief asked for both; whether the
second artefact earns its 50 KB is a question for the device test.

**The swap move never terminated, and the TypeScript engine has the same bug.**
It priced the incoming stop against the current route, removed the outgoing one,
then inserted — two numbers measured on two different routes. So it could apply a
move that made the route worse, report "improved", and swap straight back.
`selection_moves_respect_the_cap` exhausted a budget of a *million* node scans on
a 30-node instance without reaching a local optimum. Removing first and pricing
the insertion against the shortened route makes the delta exact; the same
instance now converges in 40 ms. `engineTs.ts` has the identical unsound test,
where a deadline hides it.

**Guided local search wants a much lighter touch than the literature suggests.**
The usual α for TSP is 0.1-0.3. Swept across five values, 0.025 beat 0.2 by 0.9%
at n = 1000, monotonically. With Or-opt, candidate lists and don't-look bits
already doing the work, a heavy penalty distorts the landscape faster than the
descent can exploit it and the search chases an increasingly fictional matrix.

**Neither ILS nor GLS wins everywhere**, which is why both shipped. ILS is the
default because it is the only one that never loses to the engine it replaces.

**RUSTFLAGS replaces `.cargo/config.toml`, it does not merge with it.** Setting it
for the SIMD build alone silently dropped that build's `--max-memory`, producing
the one configuration iOS Safari refuses to instantiate — in the only artefact a
modern iPhone would ever load, passing every desktop test. The artefact check
caught it on the first run.

**Committed binaries drift from source silently, and I did it twice.** Measuring
whether a longer budget helped meant editing a constant, rebuilding, reverting,
and committing — which put the experimental engine in git next to the restored
source. Twelve tests passed against the wrong engine. `wasmArtefact.test.ts` now
fingerprints every input that can change codegen and needs nothing but Node to
check it, because it has to run on the machine the committed artefacts exist for.

### Verified

- **44 Rust tests.** Every 2-opt reversal delta and every Or-opt
  (start, length, gap, orientation) checked against a full recompute under all
  four combinations of pinned ends — exhausted, not sampled. The optimum found on
  60 brute-forced instances at n = 6..8, and on 30 more with GLS.
- **A chunked descent is byte-identical to an uninterrupted one**, and the answer
  is identical at chunk sizes 1, 7, 64, 1000 and 100 000. If pausing could change
  the route, cancelling could too, and two phones would disagree.
- **The full benchmark grid, in a real browser, against the real bundle**:
  `wasm-workers` best or tied on 18 of 18 instances, including all three decoy
  instances M9 deferred as a known weakness.
- **610 TypeScript tests**, including the real `.wasm` driven through the real
  port: both artefacts valid and byte-identical to each other, the optimum on
  brute-forced instances, the K cap honoured, progress monotone.
- **Cancellation at 69 ms**, against a <100 ms gate.
- `bench:verify-seam` passes; production emits only our two artefacts, 48.7 KB
  and 50.6 KB.

### Deferred

- 🔴 **The n = 100/300/1000 benchmark grid was not built.** The harness tops out
  at n = 107, and the gates in the brief (2% at n=100/1s, 3% at n=300/3s, 5% at
  n=1000/5s) are stated against best-known values. The n = 1000 numbers above are
  from a scratch Node script comparing engines to each other, **not** gaps to any
  established best-known. Extending `bench/lib/instances.mjs` and adding a TSPLIB
  size ladder (proven optima at n ≈ 100/300/1000) is the first job of M11.
- 🔴 **No real-device runs.** Every number here is from a Mac.
  `DEVICE-TEST-M10.md` is the protocol; it needs a physical Android and a
  physical iPhone. Two things are unverifiable anywhere else: that iOS Safari
  instantiates the module at all, and whether the SIMD artefact is worth keeping.
- 🟡 **`engineTs.ts` still has the unsound swap move.** Left alone deliberately —
  it is the correctness oracle, and changing it in the same milestone that
  replaces it would mean the new engine was checked against a moving target.
- 🟡 **GLS is not the default anywhere** despite being ~0.9% better at n = 1000.
  It needs the proper benchmark before it can be trusted, and possibly a
  size-dependent choice.
- The M9 deferrals stand: no tier A engine, VRPTW parsed but not scored,
  OR-Tools' heap leak unchanged (the endurance probe still dies around solve #12,
  and no user reaches that code).

### What the next session needs to know

1. **`npm run engine:build` after ANY change under `engine/`.** The artefacts are
   committed so the app builds without Rust; `wasmArtefact.test.ts` fails if they
   drift. Editing a `#[cfg(test)]` block also asks for a rebuild — a known false
   positive, and the price of a one-sentence invariant.
2. **Homebrew's rustup is keg-only.** Its shims are not on PATH and not in
   `~/.cargo/bin`; they are in `/opt/homebrew/opt/rustup/bin`. Calling cargo by
   absolute path is not enough — the shim execs a cargo that resolves `rustc`
   from PATH and finds Homebrew's older `rust` formula, which has no wasm32 std
   and fails with a confusing "can't find crate for `std`".
   `scripts/build-engine.mjs` front-loads cargo's own directory.
3. **Registration order in `registry.ts` IS the tier-B policy.** Two engines sit
   at tier B and `selectEngine` takes the first supported one. Move `wasm-workers`
   below `ts-workers` and the Rust engine silently stops reaching users with
   every test still green. There is a test asserting the order.
4. **`DurationSegment` in `tour.rs` is written and tested but wired to nothing.**
   M11 populates prefix/suffix arrays of it over tour positions and adds a term
   to the delta functions. `duration` is measured from the OPTIMAL departure and
   INCLUDES the time warp — elapsed time is `duration − time_warp`. Getting that
   backwards costs 88 seconds on the test instance in `tour.rs`.
5. **The engine sees ONE matrix.** Whichever the objective is measured in.
   `toResult` computes every reported figure from the order alone, for every
   engine, so no two engines can disagree about what a route is worth. Do not
   pass it both.
6. **Threads are still not here.** M11 or M15. The scalar/SIMD split already
   exists, so a threaded artefact would be a third build, not a new mechanism.

---

## M11 — Time windows, and the difference between "cheap" and "on time"

**Status: Tasks 1, 2, 3, 4 and 6 are done and shipping. Task 5 — the SISR
batch engine — is NOT built and is listed under Deferred.**

### What changed

The solver understands everything the M7 edit form can express. Until this
milestone a driver could set an arrival window, a time at stop, First or Last,
and a break, and none of it reached the search: `planSelectiveRoute` built
default constraints and threw the real ones away.

```
engine/src/
  segtree.rs      NEW — interior subsequence labels, both directions, O(log n)
  problem.rs      + TimeData (travel seconds, service, windows, departure)
                  + pin blocks and their counts
  tour.rs         + prefix/suffix labels, Chain, warp_after_{reverse,or_opt,
                    insert,remove}, zone(), gap_range(), Insertion
  localsearch.rs  + penalised deltas, zone-confined move generation
  driver.rs       + adaptive time-window penalty, best-feasible vs best-overall
  ffi.rs          + schedule and pins across the boundary, engine_time_warp

src/lib/
  infeasibility.ts  NEW — which stop cannot be made, and by how much
  compute/          + departAtSec, scheduleFor, compareResults, resolvePins
  planRoute.ts      + per-waypoint constraints, breaks as virtual nodes
  arrivals.ts       + break durations folded into the plan

bench/
  lib/tsptw.mjs        NEW — the TSPTW library, and the referee
  fetch-tsptw.mjs      NEW — caches it, and self-checks against 370 solutions
  tsptw.mjs            NEW — feasibility first, then gap to proven optimum
  solomon-routes.mjs   NEW — Solomon best-known routes, re-sequenced
  strip-coi.mjs        NEW — the no-isolation build
```

### The benchmark had to change before the engine could

The brief said to verify against Solomon and Gehring-Homberger. Those score
vehicles first and then distance, with capacity; a single-vehicle engine cannot
compete on the first term at all, and a gap with the fleet term relaxed answers
a different question. M9 deferred them for exactly that reason and was right to.

So: the **TSPTW instance library** (López-Ibáñez) is the same problem we solve —
one vehicle, one sequence, windows, minimise travel — with 370 cached instances,
most of them proven optimal. And Solomon is kept by changing the question: each
ROUTE of SINTEF's published best-known solution has its customer set fixed, which
satisfies the fleet term and capacity by construction, and is re-solved as a
TSPTW sub-instance.

Three conventions in that library produce plausible wrong numbers if misread:
service time is baked into the distance matrix, waiting for a window to open is
free, and the return leg to the depot is scored. So both harnesses verify
themselves first — `bench:tsptw:fetch` re-scores all 370 published permutations
and requires our cost AND violation count to equal theirs, and `bench:solomon`
reproduces SINTEF's published vehicle count and distance before running anything.

### The numbers

TSPTW, 25 instances across five sets, every one **proven optimal**, 3 s budget:

| engine | feasible | mean gap | worst | exact optimum |
|---|---|---|---|---|
| M10 baseline | **1/25** | — | — | — |
| `ts-workers` (tier B fallback) | 25/25 | 0.62% | 5.35% | 17/25 |
| `wasm` (tier C) | 25/25 | 0.47% | 4.63% | 19/25 |
| **`wasm-workers`** (tier B, the default) | **25/25** | **0.27%** | **2.44%** | **20/25** |

Tier D (`ts`, single-threaded) measured separately on the 15-instance subset:
25/25 feasible, 0.82% mean, 6.93% worst.

The M10 baseline is committed as `bench/results/tsptw-baseline-m10.json` and is
worth keeping: 1/25 feasible, up to 36% "cheaper" than a proven optimum, and
claiming `feasible: true` on every late route.

Solomon best-known routes, re-sequenced (50 routes across the six classes):
**50/50 matched or beaten, zero windows missed, total distance identical to
SINTEF's.**

And the definition-of-done item, measured rather than argued —
`npm run bench:tsptw:nocoi` strips coi-serviceworker from the build and refuses
to report unless `crossOriginIsolated` is actually false on the page:

```
wasm-workers   feasible 15/15   mean gap 0.27%   crossOriginIsolated: false
```

### What surprised me

**The brief's O(1) claim is not achievable, and the reason is worth keeping.**
"Precompute labels for forward and reverse subsequences so 2-opt stays O(1)"
cannot be done with prefix arrays. `F[j] − F[i]` recovers an interior range of
arc costs because subtraction inverts addition; `DurationSegment::merge`
contains `max` and `min` and has no inverse, so no arrangement of prefix and
suffix arrays yields an arbitrary interior range in either direction. What merge
*is*, is associative — which is what a segment tree needs. Interior ranges are
therefore O(log n), about ten merges instead of one at n = 1000, and everything
else in the brief genuinely is O(1).

**The engine emptied 21 of 25 instances before anyone noticed it was allowed
to.** Pricing time-warp relief into the DROP move makes abandoning a delivery
rational: the penalty is adaptive and climbs whenever the route is late, so on a
day that cannot be done on time it eventually exceeds the skip penalty and
dropping a stop becomes the cheapest move available. The rule that fixes it is
worth stating as a rule — **lateness decides where a stop goes, never whether it
goes** — and it is why `Insertion` carries two costs. Swap keeps both, because it
preserves the number of stops and so cannot buy punctuality by abandoning
anybody.

**A 28 800-second error looked like a result.** The port defaults to an 08:00
departure; both benchmark libraries start their clock at zero. With every window
already closed before the driver left, the engine still returned 22/25 feasible
at a 3.98% mean gap — because the error is very nearly a constant offset, so the
search was still ranking orders sensibly. It looked like a solver that mostly
worked. It was a solver being asked the wrong question.

**"First" was never a pin on the route's start.** `resolveEndpoints` promoted a
stop marked First into the route's start and threw when the route already had
one, so a driver who set a start location and then marked a parcel First got
"Two different stops are pinned to the start". The two are different things: the
start is where the van sets off from, First is the earliest delivery. They no
longer interact.

**A break needed no engine support at all.** It is a mandatory stop with a
service time, a window, and zero travel cost to and from everywhere else — so the
matrix grows one row and column of zeros and the search never learns what a
break is. Its window closes at the latest START, not the latest finish, because
the engine schedules against arrival.

**Diversifying the workers made this benchmark slightly worse, and I shipped it
anyway.** Before strategy rotation, `wasm-workers` scored 0.16% mean / 2.24%
worst on the same 25 instances; with it, 0.27% / 2.44% — but 20/25 exact optima
rather than 18. Three ILS workers from three seeds beat one ILS, one GLS and one
hybrid, on THIS ladder. The justification for rotating anyway is that ILS and GLS
were measured in M10 winning at different instance sizes, so a pool of one search
is a pool that loses wherever that search is the wrong one; TSPTW instances top
out at n = 232 and are all one family. That justification is an argument, not a
measurement, and the measurement I have points the other way by 0.11%. If the
device test does not support it, rotate back — `strategyFor` is four lines.

**iOS Safari reports four cores on every iPhone ever made.** It is a
fingerprinting defence, not a core count (mdn/browser-compat-data #30063), so
`cores − 1` gives exactly three workers on an iPhone 11 and on an iPhone 17. That
plus thermal throttling under sustained load is why extra workers are now
*diversification* — different search strategies, not different seeds — rather
than a speedup we do not get.

### Verified

- **57 Rust tests.** Every interior range against a direct fold, in both
  directions, exhausted not sampled; every legal 2-opt reversal and every Or-opt
  (start, length, gap, orientation, both pin configurations) against a
  clock-walking simulation, on instances tight enough that most orderings are
  late; both pin blocks surviving a complete search across seven seeds; a
  pinned-but-optional stop kept under a binding K cap.
- **619 TypeScript tests**, including the infeasibility report and the rule that
  a route solved before M11 reports nothing — it did not fail its windows, it was
  never asked about them.
- **370 published best-known TSPTW solutions** re-scored by our referee, cost and
  violation count matching exactly, before any engine was measured against them.
- **SINTEF's c101** reproduced at 10 vehicles / 828.94 / zero violations by our
  own Solomon scorer, before any engine was measured against it.
- `bench:verify-seam` passes, and now also fails the build if production output
  ever loads coi-serviceworker again.
- Artefacts 71.0 KB scalar / 73.1 KB SIMD, no imports, bounded memory.

### Deferred

- 🔴 **Task 5, the SISR batch engine, is not built.** No `sisr.rs`, no
  `Strategy::Sisr`, no fourth "Thorough" budget tier. The research is done and
  recorded below so the next session starts from the paper rather than from a
  search engine. Nothing else depends on it — it was specified as an extra tier,
  not the default — and the four existing tiers are unaffected.
- 🔴 **No real-device runs, still.** Every number here is from a Mac.
  `DEVICE-TEST-M11.md` is the protocol. The parallel-speedup claim in particular
  is unverified on hardware that thermally throttles.
- 🟡 **Worker strategy rotation is unproven and costs 0.11% on TSPTW.** See
  "what surprised me". It should be settled by the device test or by a benchmark
  with more instance families, not left as an argument.
- 🟡 **A break is every node's nearest neighbour.** Its arcs are all zero, so it
  occupies one of the ten candidate-list slots for every stop. Measurable in
  principle; with one or two breaks against ten slots it has not been measurable
  in practice, and no fix is proposed until it is.
- 🟡 **`public/coi-serviceworker.js` is dead in production** and still copied into
  the bundle for the bench build's OR-Tools oracle. Left alone deliberately.
- The M10 deferrals that remain: GLS is still not the default anywhere, and the
  OR-Tools heap leak is unchanged (no user reaches that code).

### What the next session needs to know

1. **`npm run engine:build` after ANY change under `engine/`**, still. The
   artefacts are committed so the app builds without Rust, and
   `wasmArtefact.test.ts` fails if they drift.
2. **Time windows are gated on a CLOSING time, nowhere else.**
   `Problem::windows_bind()` is false unless some `tw_close < NEVER`, and when it
   is false no labels are built, no segment tree is allocated, and the search is
   byte-for-byte M10's. An opening time only makes the driver wait and a service
   time is constant over a fixed set of stops, so neither can change which order
   is best. Do not widen that test.
3. **The travel-time matrix is separate from the cost matrix on purpose**, even
   when both hold seconds. Guided local search writes its arc penalties into the
   cost matrix in place; a schedule read from it would drift with every penalty,
   silently.
4. **The departure time is part of the question, not a display concern.** It is
   pinned into every label composition by `Chain::new`, and the benchmark
   harnesses pass `departAtSec: 0` because their clocks start at zero.
5. **SISR, for whoever picks up Task 5.** Christiaens & Vanden Berghe,
   *Transportation Science* 54(2), 2020: c̄ = 10 average removed customers,
   Lᵐᵃˣ = 10 maximum string length, α = 10⁻³, blink rate β = 10⁻², simulated
   annealing from T₀ = 100 to T_f = 1. The reference implementation covering the
   prize-collecting (team orienteering) variants is
   `hankarudova/open-source-sisr-routing`, Apache-2.0, CPAIOR 2026 — read it for
   the orienteering adaptation. Do NOT wire in the `vrp` crate: M10 never
   recommended it (I checked), it is a multi-crate native solver, and it would
   replace a 71 KB artefact with something orders of magnitude larger.
6. **Extra cores are diversification.** `strategyFor(index)` in engineWorkers.ts
   assigns ILS to worker 0 and rotates the rest through GLS and the hybrid.
   Worker 0 is pinned so a one-core device cannot silently get a different answer
   from a two-core one.
