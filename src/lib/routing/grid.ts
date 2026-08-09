/**
 * The cost grid, assembled from what we already know plus as little as possible.
 *
 * Three sources, in this order, and the order is the milestone:
 *
 *   1. **The cache.** Whatever the last solve of this route paid for. Reopening
 *      a route, or re-optimising it after ticking off six deliveries, needs no
 *      network at all — and until M12 the plan path never once looked.
 *   2. **A sparse fetch.** Only the arcs the search can actually use, covered by
 *      as few requests as the provider's limits allow. See `cover.ts`.
 *   3. **A calibrated straight line.** Everything else, priced from the arcs we
 *      did fetch rather than from a constant. See `sparse.ts`.
 *
 * What comes out is DENSE, always: the engine takes a flat n×n Int32Array and
 * always will, because a sparse inner loop costs a branch per arc evaluation to
 * save memory a phone already has. "Sparse" describes the fetch. The mask is
 * what remembers which cells were bought and which were guessed.
 */

import type { LatLng, Objective } from '../../types.ts'
import { hilbertOrder } from '../compute/hilbert.ts'
import { planCover } from './cover.ts'
import { getRoutingService, type RoutingService } from './index.ts'
import { candidateNeeds, estimateGaps, getBit, makeBitset, setBit } from './sparse.ts'
import { UNREACHABLE_COST } from './types.ts'

/** What a previous solve of the same points already knew. */
export interface GridSeed {
  /** Row-major n×n costs. Cells whose `known` bit is unset are ignored. */
  costs: Int32Array
  /** One bit per cell: this cost came from a provider, not from a guess. */
  known: Uint8Array
}

export interface CostGrid {
  matrix: Int32Array
  known: Uint8Array
  n: number
  /** Cells the caller is about to solve on that are guesses. */
  estimatedCells: number
  /** Cost per straight-line metre used for those guesses. */
  ratio: number
  /** Requests actually made. Zero is the good case and the point of the cache. */
  requests: number
  /** Cells actually fetched, for the record. */
  fetchedCells: number
  /**
   * At least one band could not be fetched, so more of this grid is guessed
   * than was intended. In practice: no network.
   */
  degraded: boolean
}

export interface BuildGridOptions {
  points: readonly LatLng[]
  objective: Objective
  seed?: GridSeed | null
  /** Rows and columns to fetch in full — the pinned endpoints, in practice. */
  mandatory?: readonly number[]
  /** (requestsDone, requestsTotal). Total is a lower bound until the last band. */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
  /** Test seam. Defaults to the app's configured providers. */
  service?: RoutingService
}

/**
 * Which cells this grid wants to be real.
 *
 * Below the provider's cell budget the answer is "all of them": a 100-stop
 * round is one request either way, and a sparse fetch of it would be strictly
 * more code for exactly the same number of round trips. The candidate list
 * earns its keep above that line, not below it.
 */
function needsFor(
  points: readonly LatLng[],
  maxCells: number,
  mandatory: readonly number[] | undefined,
): number[][] {
  const n = points.length
  if (n * n <= maxCells) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => j).filter((j) => j !== i),
    )
  }
  return candidateNeeds(points, { mandatory })
}

/** Drop the cells a seed already answered. What is left is what we must buy. */
function outstanding(need: readonly number[][], known: Uint8Array, n: number): number[][] {
  return need.map((row, i) => row.filter((j) => !getBit(known, i * n + j)))
}

export async function buildCostGrid(options: BuildGridOptions): Promise<CostGrid> {
  const { points, objective, mandatory, onProgress, signal } = options
  const service = options.service ?? getRoutingService()
  const n = points.length
  const limits = service.limits()

  const matrix = new Int32Array(n * n)
  const known = makeBitset(n * n)
  if (options.seed && options.seed.costs.length === n * n) {
    matrix.set(options.seed.costs)
    known.set(options.seed.known.subarray(0, known.length))
  }

  const wanted = needsFor(points, limits.maxCells, mandatory)
  const missing = outstanding(wanted, known, n)

  let requests = 0
  let fetchedCells = 0
  let degraded = false

  const anyMissing = missing.some((row) => row.length > 0)
  if (anyMissing) {
    const plan = planCover(missing, Array.from(hilbertOrder(points)), limits)

    for (const [index, band] of plan.bands.entries()) {
      // A band is one request unless the provider's limits force the service to
      // split it, and only the service knows whether they did.
      let pieces = 0
      let rows: (number | null)[][]
      try {
        rows = await service.table(
          { points, sources: band.sources, destinations: band.destinations, objective, signal },
          (_done, total) => {
            pieces = total
          },
        )
      } catch (e) {
        /*
          A band we cannot fetch is a band we estimate.

          This is the whole of the app's offline story for planning. Before M12
          an unreachable matrix service failed the solve outright, so a driver
          in a dead zone who wanted to reorder four stops got an error message
          and nothing else. Now the arcs stay guesses, the route is marked
          estimated, and the day carries on.

          A cancelled solve is NOT that, and must not be swallowed into a worse
          answer: the driver asked for it to stop.
        */
        if ((e as Error).name === 'AbortError' || (e as { kind?: string }).kind === 'aborted') throw e
        degraded = true
        onProgress?.(index + 1, plan.bands.length)
        continue
      }

      requests += Math.max(1, pieces)
      band.sources.forEach((source, r) => {
        band.destinations.forEach((destination, c) => {
          const value = rows[r]?.[c]
          if (value === undefined) return
          const cell = source * n + destination
          matrix[cell] = value === null ? UNREACHABLE_COST : Math.round(value)
          setBit(known, cell)
          fetchedCells++
        })
      })
      onProgress?.(index + 1, plan.bands.length)
    }
  }

  const { ratio, estimatedCells } = estimateGaps(matrix, known, points, objective)
  return { matrix, known, n, estimatedCells, ratio, requests, fetchedCells, degraded }
}

/**
 * Write the real durations of a solved tour back into the grid.
 *
 * ── Why this is free ──────────────────────────────────────────────────────
 *
 * The pipeline already asks the road router to draw the chosen sequence, and
 * that response carries the true duration and distance of every leg it drew.
 * Those legs are exactly the arcs the solver committed to. So the most
 * important arcs in the whole matrix — the ones actually being driven — can be
 * made real for no request we were not already making.
 *
 * Which is what makes solving on estimates safe. A guess that survives into the
 * final tour is corrected before the driver ever sees a time, and the corrected
 * grid is what gets cached for next time.
 *
 * Returns how many cells changed from a guess to a fact.
 */
export function patchTourArcs(
  grid: Pick<CostGrid, 'matrix' | 'known' | 'n'>,
  tour: readonly number[],
  legCosts: readonly number[],
): number {
  if (legCosts.length !== tour.length - 1) return 0
  let corrected = 0
  for (let i = 0; i < tour.length - 1; i++) {
    const cell = tour[i] * grid.n + tour[i + 1]
    const wasGuess = !getBit(grid.known, cell)
    grid.matrix[cell] = Math.round(legCosts[i])
    setBit(grid.known, cell)
    if (wasGuess) corrected++
  }
  return corrected
}

/** True when any arc of this tour is still a guess. */
export function tourHasEstimates(
  grid: Pick<CostGrid, 'known' | 'n'>,
  tour: readonly number[],
): boolean {
  for (let i = 0; i < tour.length - 1; i++) {
    if (!getBit(grid.known, tour[i] * grid.n + tour[i + 1])) return true
  }
  return false
}
