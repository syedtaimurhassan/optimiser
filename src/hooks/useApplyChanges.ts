import { useCallback, useState } from 'react'
import type { AddressedStop, OptimizedRoute, Route } from '../types'
import { cumulativeArrivals, serviceSecFor } from '../lib/arrivals'
import { END_KEY, START_KEY, matrixCacheKey, saveMatrix, toCachedMatrixFlat } from '../lib/costMatrix'
import { fetchRouteGeometry } from '../lib/routingService'
import { joinOrderedStopIds, planSelectiveRoute } from '../lib/planRoute'
import { addedStops, removedStopIds, stagedStops } from '../lib/staging'
import { useRoutesStore } from '../store/routesStore'
import { useSolverStore } from '../store/solverStore'

/**
 * The commit: a choice between two models.
 *
 * ── The whole trade-off, in fourteen words ────────────────────────────────
 *
 *   Update route      Reorder only changed stops
 *   Reoptimise route  Reorder all stops for optimal efficiency
 *
 * ── UPDATE ────────────────────────────────────────────────────────────────
 *
 * The preview already IS the answer. `lib/provisional.ts` froze the sequence
 * and cheapest-inserted the new stops into it; committing takes that exact
 * order and makes it real. No solver call and no second insertion pass —
 * re-running the arithmetic here would let the committed route differ from the
 * one the driver read and agreed to, which is the one thing this screen exists
 * to prevent.
 *
 * The only network is one OSRM route request for the real road geometry and
 * real per-leg times, replacing the preview's straight lines.
 *
 * ── REOPTIMISE ───────────────────────────────────────────────────────────
 *
 * The staged changes are applied to the stops, and the existing pipeline runs
 * over the result exactly as "Calculate" does. Nothing about the solver
 * changes — M9–M11 own that.
 *
 * ── Why a hook ───────────────────────────────────────────────────────────
 *
 * Both paths are asynchronous and both can fail at the network. "In flight"
 * and "that did not work" are properties of one attempt, not of the route, so
 * they live here; the store only ever receives a finished commit, in one write.
 */

export type CommitModel = 'update' | 'reoptimise'

export interface ApplyState {
  running: CommitModel | null
  error: string | null
}

const IDLE: ApplyState = { running: null, error: null }

/**
 * The stops as they will be once the change set is applied: adds in, removals
 * out, edits merged. The provisional labels are already on the added stops —
 * `setProvisional` wrote them there when the preview was computed, so the ID
 * the driver read on the review screen is the ID that gets committed.
 */
function committedStops(route: Route): AddressedStop[] {
  const removed = removedStopIds(route.pending)
  return stagedStops(route).filter((s) => !removed.has(s.id))
}

export function useApplyChanges(route: Route | null) {
  const [state, setState] = useState<ApplyState>(IDLE)
  const applyStagedChanges = useRoutesStore((s) => s.applyStagedChanges)
  const setMatrixCacheKey = useRoutesStore((s) => s.setMatrixCacheKey)

  /**
   * Update: keep the order the preview showed, and make it real.
   */
  const update = useCallback(async () => {
    const provisional = route?.pending?.provisional
    if (!route || !provisional) return false
    setState({ running: 'update', error: null })

    const stops = committedStops(route)
    const byId = new Map(stops.map((s) => [s.id, s]))
    const serviceSeconds = provisional.orderedStopIds.map((id) => {
      const stop = id ? byId.get(id) : undefined
      return stop ? serviceSecFor(stop) : 0
    })

    let optimized: OptimizedRoute
    try {
      const road = await fetchRouteGeometry(provisional.orderedWaypoints)
      optimized = {
        ...provisional,
        geometry: road.geometry,
        distanceMeters: road.distanceMeters,
        durationSeconds: road.durationSeconds,
        legSeconds: road.legSeconds,
        legMeters: road.legMeters,
        arrivalSec: cumulativeArrivals({ legSeconds: road.legSeconds, serviceSeconds }),
        estimated: false,
      }
    } catch {
      /*
        The order is still right — it came from the cached matrix, which is
        real. Only the polyline and the per-leg times are estimates, and the
        route already carries `estimated` for exactly this case.

        Failing the commit here would be the wrong trade: the driver has
        agreed to a sequence, and refusing to save it because a drawing
        request timed out leaves them holding a parcel and a diff.
      */
      optimized = { ...provisional, estimated: true }
    }

    applyStagedChanges({ stops, optimized })
    setState(IDLE)
    return true
  }, [route, applyStagedChanges])

  /**
   * Reoptimise: apply the changes, then solve the result from scratch.
   */
  const reoptimise = useCallback(async () => {
    if (!route) return false
    const solver = useSolverStore.getState()
    setState({ running: 'reoptimise', error: null })
    solver.begin()
    const controller = new AbortController()
    solver.setAbortController(controller)

    const stops = committedStops(route)
    const pending = stops.filter((s) => s.status === 'pending')

    try {
      const result = await planSelectiveRoute({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
        targetK: route.targetK,
        objective: route.optimizeBy,
        timeBudgetMs: route.searchTierSec * 1000,
        onStatus: (message) => solver.setStatus(message),
        signal: controller.signal,
      })

      const { matrix, matrixN, matrixWaypointIndex, ...planned } = result
      // The matrix's rows are labelled from the planner's POSITIONAL index
      // list, so a row knows which stop it is without the planner ever having
      // seen one.
      const matrixKeys = matrixWaypointIndex.map((waypoint, i) =>
        waypoint === null
          ? i === 0 && route.start
            ? START_KEY
            : END_KEY
          : (pending[waypoint]?.id ?? END_KEY),
      )
      const orderedStopIds = joinOrderedStopIds(result.orderedWaypoints, pending)

      const byId = new Map(pending.map((s) => [s.id, s]))
      const serviceSeconds = orderedStopIds.map((id) => {
        const stop = id ? byId.get(id) : undefined
        return stop ? serviceSecFor(stop) : 0
      })

      const optimized: OptimizedRoute = {
        ...planned,
        orderedStopIds,
        arrivalSec: cumulativeArrivals({ legSeconds: result.legSeconds, serviceSeconds }),
      }

      const cacheKey = matrixCacheKey(route.id, route.optimizeBy)
      await saveMatrix(cacheKey, toCachedMatrixFlat(matrix, matrixN, matrixKeys, route.optimizeBy)).catch(
        (e: unknown) => console.warn('[routes] could not cache the cost matrix', e),
      )

      applyStagedChanges({ stops, optimized })
      setMatrixCacheKey(cacheKey)
      solver.succeed()
      setState(IDLE)
      return true
    } catch (e) {
      // Cancelling leaves the staged changes staged, so the driver can commit
      // them again rather than having to re-stage what they already reviewed.
      if ((e as Error).name === 'AbortError') {
        solver.cancelled()
        setState(IDLE)
        return false
      }
      const message = (e as Error).message
      solver.fail(message)
      setState({ running: null, error: message })
      return false
    }
  }, [route, applyStagedChanges, setMatrixCacheKey])

  const apply = useCallback(
    (model: CommitModel) => (model === 'update' ? update() : reoptimise()),
    [update, reoptimise],
  )

  return { ...state, apply, addedCount: route ? addedStops(route.pending).length : 0 }
}
