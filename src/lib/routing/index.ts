/**
 * Composition root for routing.
 *
 * The only file that knows WHICH services the app actually calls. Everything
 * else — the adapters, the service, the covering algorithm, the planner — is
 * written against interfaces and can be tested with no network.
 *
 * Lazy, so importing a type from here does not open a connection to anything.
 */

import { getReachability } from '../net/reachability.ts'
import { createOsrmProvider } from './osrm.ts'
import { createValhallaProvider } from './valhalla.ts'
import { createRoutingService, type RoutingService } from './service.ts'

export * from './types.ts'
export * from './service.ts'
export { createOsrmProvider, OSRM_ID, toIntegerCells } from './osrm.ts'
export { createValhallaProvider, VALHALLA_ID } from './valhalla.ts'

let singleton: RoutingService | null = null

/**
 * OSRM primary, Valhalla fallback.
 *
 * Not a close call. OSRM answers a 100×100 table in 0.3 s and takes 10,000
 * cells per request; Valhalla takes 2,500 and needs eight seconds for them.
 * But OSRM is a demo server that says out loud it may be withdrawn without
 * notice, and the fallback needs no key, which is what makes it a real one.
 */
export function getRoutingService(): RoutingService {
  if (!singleton) {
    singleton = createRoutingService({
      primary: createOsrmProvider(),
      fallback: createValhallaProvider(),
      // Every request that leaves the app comes through here, so this is the
      // one place that can tell the difference between "the OS says there is a
      // network" and "something answered".
      onOutcome: (reached) => getReachability().report(reached),
    })
  }
  return singleton
}

/** Test seam — drops the memoised service so a test can install its own. */
export function resetRoutingService(): void {
  singleton = null
}
