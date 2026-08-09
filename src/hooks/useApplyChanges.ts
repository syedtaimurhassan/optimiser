import { useCallback, useState } from 'react'
import type { AddressedStop, OptimizedRoute, Route } from '../types'
import { cumulativeArrivals, serviceSecFor } from '../lib/arrivals'
import {
  loadMatrix,
  matrixCacheKey,
  matrixKeysFor,
  saveMatrix,
  seedFromCache,
  toCachedMatrixFlat,
} from '../lib/costMatrix'
import { fetchRouteGeometry } from '../lib/routingService'
import { joinOrderedStopIds, matrixLayout, planSelectiveRoute } from '../lib/planRoute'
import { DEFAULT_DEPART_SEC } from '../lib/compute/solverPort'
import { addedStops, removedStopIds, stagedStops } from '../lib/staging'
import { useRoutesStore } from '../store/routesStore'
import { useSolverStore } from '../store/solverStore'
import { useSyncStore } from '../store/syncStore'

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
      // The grid this route already paid for, re-indexed onto the new stop set.
      // Stops that were removed drop out; stops that were added come back unset,
      // which is exactly what tells the fetch what it still has to buy.
      const cacheKey = matrixCacheKey(route.id, route.optimizeBy)
      const layout = matrixLayout({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
      })
      const matrixKeys = matrixKeysFor(
        layout.matrixWaypointIndex,
        pending.map((s) => s.id),
        Boolean(route.start),
      )
      const cached = await loadMatrix(cacheKey).catch(() => null)
      const seed = seedFromCache(cached, matrixKeys, route.optimizeBy)

      const result = await planSelectiveRoute({
        startLocation: route.start,
        endLocation: route.end,
        waypoints: pending,
        seed,
        targetK: route.targetK,
        objective: route.optimizeBy,
        timeBudgetMs: route.searchTierSec * 1000,
        // Everything the edit form can express, as a parallel array. The planner
        // never learns what a stop is; it is handed positions.
        stopConstraints: pending.map((stop) => ({
          serviceTimeSec: serviceSecFor(stop),
          twOpenSec: stop.twOpenSec,
          twCloseSec: stop.twCloseSec,
          order: stop.order,
        })),
        // A break already taken is not one to plan for.
        breaks: route.breaks
          .filter((rest) => !rest.taken)
          .map((rest) => ({
            earliestSec: rest.earliestSec,
            latestSec: rest.latestSec,
            durationSec: rest.durationSec,
          })),
        departAtSec: route.startSec ?? DEFAULT_DEPART_SEC,
        onStatus: (message) => solver.setStatus(message),
        signal: controller.signal,
      })

      const {
        matrix,
        matrixN,
        matrixKnown,
        estimatedArcs,
        matrixWaypointIndex: _index,
        matrixRequests: _requests,
        ...planned
      } = result
      const orderedStopIds = joinOrderedStopIds(result.orderedWaypoints, pending)

      const byId = new Map(pending.map((s) => [s.id, s]))
      const serviceSeconds = orderedStopIds.map((id) => {
        const stop = id ? byId.get(id) : undefined
        return stop ? serviceSecFor(stop) : 0
      })

      const optimized: OptimizedRoute = {
        ...planned,
        orderedStopIds,
        arrivalSec: cumulativeArrivals({
          legSeconds: result.legSeconds,
          serviceSeconds,
          breaks: result.breaks,
        }),
      }

      await saveMatrix(
        cacheKey,
        toCachedMatrixFlat(matrix, matrixN, matrixKeys, route.optimizeBy, matrixKnown),
      ).catch((e: unknown) => console.warn('[routes] could not cache the cost matrix', e))

      // Same note as the Calculate path: a plan built on straight lines looks
      // identical on a map, and only one of the two is a promise.
      useSyncStore
        .getState()
        .markEstimated(route.id, estimatedArcs > 0 || planned.estimated === true)

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
