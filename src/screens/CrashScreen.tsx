/**
 * A screen that throws during render. Dev/bench builds only.
 *
 * Exists so the error boundary can be exercised for real — by the smoke test,
 * and by hand on a physical phone via #/__crash. An untested recovery path is
 * not a recovery path; the boundary shipped broken once already (it returned a
 * null error from getDerivedStateFromError, which blanked the whole tree) and
 * only this route caught it.
 *
 * Lives in its own module and is reached ONLY through a dynamic import behind a
 * statically-false guard, so Rolldown drops the entire chunk from production.
 * A plain top-level function referenced from a dead branch was NOT eliminated —
 * the marker string survived into the production bundle. `npm run
 * bench:verify-seam` asserts this file's strings never ship.
 */
export default function CrashScreen(): never {
  throw new Error('__crash route: deliberate render failure (dev/bench only)')
}
