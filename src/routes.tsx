import { lazy, Suspense } from 'react'
import { Route, Switch, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { RoutesListScreen } from './screens/RoutesListScreen'
import { RouteWorkScreen } from './screens/RouteWorkScreen'
import { StopDetailScreen } from './screens/StopDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { HelpScreen } from './screens/HelpScreen'
import { NotFoundScreen } from './screens/NotFoundScreen'

/**
 * Both flags are statically replaced by Vite, so this is a compile-time
 * constant and the branch below is dead code in production.
 *
 * Two details, both learned the hard way and both asserted by
 * `npm run bench:verify-seam`:
 *
 *  - `__DEV_ROUTES__` is a `define`, not `import.meta.env.VITE_BENCH_SEAM`.
 *    Vite only inlines a VITE_ variable when it is set, so in a normal
 *    production build that expression stayed a runtime lookup, the guard never
 *    folded to a constant, and the route's strings shipped.
 *  - The screen is reached through a dynamic import so it lands in its own
 *    chunk, which is dropped when the guard is false. A plain top-level
 *    component referenced from a dead branch was not eliminated.
 */
const DEV_ROUTES_ENABLED = import.meta.env.DEV || __DEV_ROUTES__
const CrashScreen = DEV_ROUTES_ENABLED ? lazy(() => import('./screens/CrashScreen')) : null
const UiGalleryScreen = DEV_ROUTES_ENABLED ? lazy(() => import('./screens/UiGalleryScreen')) : null

/**
 * Route table. Screens are stubs in M1 — later milestones fill them in.
 *
 *   /                             routes list
 *   /route/:routeId               route working screen (map + sheet)
 *   /route/:routeId/stop/:stopId  stop detail (deep-linkable)
 *   /settings
 *   /help
 *
 * ── Why HASH routing ──────────────────────────────────────────────────────
 *
 * GitHub Pages has no server-side rewrites, so a real path like
 * /optimiser/route/abc is a genuine 404 on cold load. The three options:
 *
 *  1. HASH (chosen). The server only ever sees /optimiser/, which always
 *     returns 200 with our index.html; everything after `#` is client-side and
 *     never leaves the browser.
 *  2. 404.html redirect trick. Keeps clean URLs, but the first response is a
 *     real HTTP 404 — Brave shows an error banner, link previews break, and for
 *     an offline-capable PWA the service worker has to special-case a document
 *     the server calls missing. It also fights the redirect dance on every cold
 *     deep link.
 *  3. Memory routing. Fine inside an installed PWA, but it throws away deep
 *     links and back-button behaviour in a browser tab, which is most of the
 *     value of having a router at all.
 *
 * Consequences we accept:
 *  - URLs look like /optimiser/#/route/abc/stop/xyz. Uglier; nobody is
 *    searching for a personal delivery route, so the SEO cost is irrelevant.
 *  - The fragment is never sent to the server. Irrelevant — there is no server.
 *  - PWA `start_url` (M5) becomes "/optimiser/#/", which is the safest possible
 *    value: it is the one URL guaranteed to resolve offline and on a cold start.
 *  - Deep links survive cold loads, offline launches, and installed-app launches
 *    identically, because they all resolve to the same cached document.
 *
 * No `base` prop is needed: the hash hook only ever reads the fragment, so
 * Vite's '/optimiser/' base path is already accounted for by the document URL.
 */
export function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={RoutesListScreen} />

        {/* Order matters: the more specific stop route must be tried first. */}
        <Route path="/route/:routeId/stop/:stopId" component={StopDetailScreen} />
        <Route path="/route/:routeId" component={RouteWorkScreen} />

        <Route path="/settings" component={SettingsScreen} />
        <Route path="/help" component={HelpScreen} />

        {/*
          Dev/bench only: a route that throws during render, so the error
          boundary can be exercised for real — in the smoke test, and by hand on
          a physical phone. An untested recovery path is not a recovery path.
          Absent from production builds; asserted by `npm run bench:verify-seam`.
        */}
        {CrashScreen && (
          <Route path="/__crash">
            <Suspense fallback={null}>
              <CrashScreen />
            </Suspense>
          </Route>
        )}

        {/*
          Dev/bench only: every design-system primitive on one page, so the
          ones M3 builds but doesn't yet use can be checked with a thumb on a
          real phone. Dropped from production by the same guard.
        */}
        {UiGalleryScreen && (
          <Route path="/__ui">
            <Suspense fallback={null}>
              <UiGalleryScreen />
            </Suspense>
          </Route>
        )}

        {/*
          There is deliberately no `path=""` route for a bare "#":
          useHashLocation already normalises an empty fragment to "/", and an
          explicit empty path matches EVERY location — it silently swallowed
          /nonsense and redirected it to the working screen instead of showing
          not-found. Caught by bench/m1-smoke.mjs.
        */}
        <Route component={NotFoundScreen} />
      </Switch>
    </Router>
  )
}
