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
