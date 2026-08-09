/**
 * Composition root for routing.
 *
 * The only file that knows WHICH services the app actually calls. Everything
 * else — the adapters, the service, the covering algorithm, the planner — is
 * written against interfaces and can be tested with no network.
 *
 * Lazy, so importing a type from here does not open a connection to anything.
 */

import { createOsrmProvider } from './osrm.ts'
import { createRoutingService, type RoutingService } from './service.ts'

export * from './types.ts'
export * from './service.ts'
export { createOsrmProvider, OSRM_ID, toIntegerCells } from './osrm.ts'

let singleton: RoutingService | null = null

export function getRoutingService(): RoutingService {
  if (!singleton) {
    singleton = createRoutingService({ primary: createOsrmProvider() })
  }
  return singleton
}

/** Test seam — drops the memoised service so a test can install its own. */
export function resetRoutingService(): void {
  singleton = null
}
