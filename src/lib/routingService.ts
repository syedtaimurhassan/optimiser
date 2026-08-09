/**
 * The old routing entry point, now a facade over `lib/routing/`.
 *
 * M12 split this file into a provider seam — types, adapters, a service that
 * paces and fails over — because the app had grown a second reason to care
 * about a provider's limits: `cover.ts` has to plan its requests against them,
 * and it cannot do that against a function that hides everything behind
 * "fetch me a matrix".
 *
 * The three functions below are kept, with their original signatures, because
 * five call sites use them and rewriting those in the same commit that moves
 * the network layer would mean no commit where only one thing changed.
 * Everything here delegates; nothing here decides.
 */

import type { LatLng } from '../types'
import { getRoutingService } from './routing/index.ts'
import { toIntegerCells } from './routing/osrm.ts'
import type { MatrixProgress } from './routing/service.ts'

export { UNREACHABLE_COST, type Objective, type RouteGeometry } from './routing/types.ts'
export type { MatrixProgress } from './routing/service.ts'

import type { Objective } from './routing/types.ts'

/**
 * The most points one plan may cover.
 *
 * ── What used to bind, and does not any more ──────────────────────────────
 *
 * 300 was a guess against URL length, and the guess was in the right place:
 * 450 coordinates at 5 dp is 8,179 URL characters and succeeds, 454 is 8,251
 * and returns nginx's 414. A dense fetch could not even reach 450, because
 * every tiled request has to name all of the coordinates plus its own source
 * list.
 *
 * Three things removed that ceiling. Bands name only the coordinates they
 * reference, so a request is sized by the band and not by the route. The
 * covering makes the number of requests linear in n rather than quadratic —
 * 18 requests at a thousand stops against a dense fetch's 100. And route
 * drawing chunks, so the last step of the pipeline no longer 414s either.
 *
 * ── What binds now: memory, not the API ───────────────────────────────────
 *
 * The engine takes a dense grid and every worker gets its own copy of it (see
 * `transferables` in engineWorkers.ts — transferring neuters the buffer, so N
 * workers need N copies). On a distance objective there are two grids. So the
 * peak is roughly `n² × 4 bytes × 2 × workers`:
 *
 *     600 stops    2.9 MB × 4 workers ≈  12 MB
 *   1,000 stops    8.0 MB × 4 workers ≈  32 MB
 *   1,500 stops   18.0 MB × 4 workers ≈  72 MB
 *
 * A thousand is where that is still defensible on a phone, and it happens to
 * be about where the network cost lands too: ~18 matrix requests at 1.1 s of
 * pacing plus three route chunks, so half a minute for a cold thousand-stop
 * route and nothing at all for a warm one.
 *
 * Above this the honest answer is not a bigger number — it is a sparse grid in
 * the engine, which is a milestone of its own.
 */
export const MAX_TABLE_POINTS = 1_000

const indices = (n: number) => Array.from({ length: n }, (_, i) => i)

/**
 * A full N×N cost grid over the point list.
 *
 * Still dense, still the fallback path. `planSelectiveRoute` now prefers the
 * sparse candidate fetch; this remains for callers that genuinely want every
 * pair, and for the benchmark that has to measure the thing being replaced.
 */
export async function fetchCostMatrix(
  points: LatLng[],
  objective: Objective,
  onProgress?: MatrixProgress,
): Promise<number[][]> {
  const n = points.length
  if (n < 2) throw new Error('Need at least two points to build a route.')
  if (n > MAX_TABLE_POINTS) {
    throw new Error(`Too many points (${n}). This client supports up to ${MAX_TABLE_POINTS}.`)
  }

  const all = indices(n)
  const rows = await getRoutingService().table(
    { points, sources: all, destinations: all, objective },
    onProgress,
  )
  return toIntegerCells(rows)
}

/**
 * A BAND of the cost matrix: some rows against some columns.
 *
 * `sources` and `destinations` are indices into `points`; both default to all
 * of them. M8 added this so inserting a stop into a solved route could cost one
 * row and one column instead of a fresh N×N.
 */
export async function fetchCostBand(
  points: LatLng[],
  objective: Objective,
  band: { sources?: number[]; destinations?: number[] } = {},
): Promise<number[][]> {
  const n = points.length
  if (n < 2) throw new Error('Need at least two points to build a route.')
  if (n > MAX_TABLE_POINTS) {
    throw new Error(`Too many points (${n}). This client supports up to ${MAX_TABLE_POINTS}.`)
  }

  const all = indices(n)
  const rows = await getRoutingService().table({
    points,
    sources: band.sources ?? all,
    destinations: band.destinations ?? all,
    objective,
  })
  return toIntegerCells(rows)
}

/**
 * Real road geometry + totals for a fixed, already-ordered sequence.
 *
 * The sequence is preserved, not re-optimised — the solver has already decided
 * the order and this only draws it.
 */
export async function fetchRouteGeometry(points: LatLng[]) {
  if (points.length < 2) throw new Error('A route needs at least two points.')
  return getRoutingService().route(points)
}
