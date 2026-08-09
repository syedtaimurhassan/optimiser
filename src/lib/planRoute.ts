import type { LineString } from 'geojson'
import type { LatLng, OptimizedRoute, OrderConstraint } from '../types'
import { fetchRouteGeometry, type Objective } from './routingService'
import {
  buildCostGrid,
  patchTourArcs,
  tourHasEstimates,
  type GridSeed,
} from './routing/grid.ts'
import { getBit } from './routing/sparse.ts'
import { activeSelection } from './compute/active.ts'
import { hilbertOrder } from './compute/hilbert.ts'
import {
  DEFAULT_DEPART_SEC,
  ORDER_NAMES,
  SKIP_PENALTY,
  makeConstraints,
  type SolveMatrix,
  type SolveProgress,
  type SolverEngine,
} from './compute/solverPort.ts'
import { DEFAULT_SERVICE_SEC } from './stopSettings.ts'
import { haversine } from './optimize'

/** Human-readable status of the current pipeline stage, for UI feedback. */
export type PlanStatus = (message: string) => void

export interface PlanInput {
  /** Fixed start, or null to let the optimizer choose where to begin. */
  startLocation: LatLng | null
  /** Fixed end, or null to let the optimizer choose where to finish. */
  endLocation: LatLng | null
  /** All candidate stops. */
  waypoints: LatLng[]
  /** Max candidate stops to visit, or null for "all". */
  targetK: number | null
  /** Minimize driving time or road distance. */
  objective: Objective
  /** Wall-clock ceiling (ms) for the search. */
  timeBudgetMs?: number
  onStatus?: PlanStatus
  /**
   * Which engine to solve with. Defaults to whatever the registry picked for
   * this device.
   *
   * An argument rather than a lookup so the benchmark can run two engines over
   * one instance without reaching into module state, and so a test can pass a
   * stub without a browser.
   */
  engine?: SolverEngine
  /** Live search progress, for a status line that means something. */
  onProgress?: (progress: SolveProgress) => void
  /** Cancels the solve. The returned promise rejects with an `AbortError`. */
  signal?: AbortSignal
  /**
   * Per-waypoint constraints, positionally aligned with `waypoints`.
   *
   * A PARALLEL ARRAY rather than fields on the waypoints, because this module's
   * contract is that it never learns what a stop is — it is handed coordinates
   * and hands back an order. Only the caller knows that entry 7 is a delivery to
   * a shop that closes at two.
   */
  stopConstraints?: PlanStopConstraint[]
  /** Rest breaks to fit into the day. See `augmentWithBreaks`. */
  breaks?: PlanBreak[]
  /** When the driver leaves, seconds from local midnight. */
  departAtSec?: number
  /**
   * What a previous solve of these points already paid for, in MATRIX index
   * space — see `matrixLayout`, which is exported so the caller can build one.
   *
   * Positional, like `stopConstraints`, and for the same reason: the cache is
   * keyed by stop identity and this module is not allowed to know what a stop
   * is. The caller translates keys to positions; this module only ever sees a
   * grid and a mask saying which of its cells are real.
   */
  seed?: GridSeed | null
}

/**
 * Where each point sits in the matrix.
 *
 * The rule is [start?, ...candidates, end?], where a candidate that coincides
 * with a chosen endpoint is dropped so it is not visited twice. That
 * de-duplication used to live inside the solve, which meant the caller could
 * not label a matrix row until after the solve had finished — fine when the
 * matrix was an output, useless now that it is also an input. Exported so the
 * cache lookup and the solve agree on what row 7 is, by construction rather
 * than by both implementing the same rule.
 */
export function matrixLayout(input: {
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: readonly LatLng[]
}): { points: LatLng[]; matrixWaypointIndex: (number | null)[]; candidateIndices: number[] } {
  const { startLocation, endLocation, waypoints } = input
  const candidateIndices = waypoints
    .map((w, i) =>
      (startLocation && sameCoord(w, startLocation)) || (endLocation && sameCoord(w, endLocation))
        ? -1
        : i,
    )
    .filter((i) => i >= 0)

  return {
    points: [
      ...(startLocation ? [startLocation] : []),
      ...candidateIndices.map((i) => waypoints[i]),
      ...(endLocation ? [endLocation] : []),
    ],
    matrixWaypointIndex: [
      ...(startLocation ? [null] : []),
      ...candidateIndices,
      ...(endLocation ? [null] : []),
    ],
    candidateIndices,
  }
}

/** What the caller knows about one waypoint that the geometry does not. */
export interface PlanStopConstraint {
  serviceTimeSec?: number
  twOpenSec?: number
  twCloseSec?: number
  order?: OrderConstraint
}

/**
 * A rest break: a duration to be taken somewhere inside a window.
 *
 * Deliberately not a fixed time. A break is "45 minutes between 11:30 and
 * 14:00"; pinning it to a clock time would make it a stop.
 */
export interface PlanBreak {
  earliestSec: number
  latestSec: number
  durationSec: number
}

/** Where a break landed in the solved sequence. */
export interface PlannedBreak {
  /** Index in `orderedWaypoints` the break follows. -1 means before the first. */
  afterIndex: number
  durationSec: number
  /** When it starts, seconds from route start. */
  startSec: number
}

const sameCoord = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng

/**
 * How much the road router's real leg times must move the tour's cost before
 * the search is asked to look again.
 *
 * Two per cent. Below that the correction is noise against a search that only
 * ever claimed to be within a fraction of a per cent of best-known anyway, and
 * re-running it would spend seconds of a driver's morning to reshuffle nothing.
 */
const REFINE_DRIFT = 0.02

/**
 * Ceiling on the refinement search, in ms.
 *
 * It is warm-started from the order the first search produced, so it is a
 * polish pass rather than a fresh attempt. A driver asked for a five-second
 * search once, not twice.
 */
const REFINE_BUDGET_MS = 2_000

const tourCost = (matrix: Int32Array, n: number, tour: readonly number[]): number => {
  let total = 0
  for (let i = 0; i < tour.length - 1; i++) total += matrix[tour[i] * n + tour[i + 1]]
  return total
}

const sameOrder = (a: Int32Array, b: Int32Array): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i])

/**
 * Join a solved point order back to the stops it came from.
 *
 * The planner is coordinate-only by design, so the caller has to do this — and
 * doing it twice, slightly differently, in two places is how the two ends of
 * an itinerary quietly disagree. Hence one function.
 *
 * ── Two stops at one door ────────────────────────────────────────────────
 *
 * Coordinates cannot identify a stop: two deliveries to one building share one
 * exactly. A plain `Map<"lat,lng", id>` therefore maps both ordered points to
 * the FIRST stop and drops the second from the itinerary entirely. Consuming
 * each match as it is used is what keeps the join one-to-one.
 */
export function joinOrderedStopIds<T extends LatLng & { id: string }>(
  orderedWaypoints: readonly LatLng[],
  candidates: readonly T[],
): (string | null)[] {
  const queued = new Map<string, string[]>()
  for (const stop of candidates) {
    const key = `${stop.lat},${stop.lng}`
    const list = queued.get(key)
    if (list) list.push(stop.id)
    else queued.set(key, [stop.id])
  }
  return orderedWaypoints.map((point) => queued.get(`${point.lat},${point.lng}`)?.shift() ?? null)
}

/**
 * What the pipeline can produce on its own.
 *
 * `orderedStopIds` and `arrivalSec` are the two fields it cannot fill: it is
 * handed bare coordinates and never sees stop identity, and an arrival time
 * needs the service time at each stop. The caller joins the result back to
 * stops and supplies both.
 *
 * `legSeconds` and `legMeters` ARE produced here — M7 stopped throwing away
 * what OSRM already returns, because per-leg times are what make an arrival
 * real rather than a share of a total.
 *
 * `matrix` and `matrixWaypointIndex` are M8's addition, and they keep this
 * module's coordinate-only contract intact: the index list says which of the
 * CALLER'S OWN `waypoints` each matrix row came from, positionally, with null
 * for an endpoint that is not one of them. The caller can therefore label the
 * matrix with its own stop ids without this module ever learning what a stop
 * is. Handing back the point coordinates instead would invite a join on
 * `lat,lng`, which is the identity bug M2 spent a milestone removing.
 */
export type PlannedRoute = Omit<OptimizedRoute, 'orderedStopIds' | 'arrivalSec'> & {
  legSeconds: number[]
  legMeters: number[]
  /**
   * The N×N cost grid the solve ran on, flat and row-major (`m[i * n + j]`),
   * worth caching rather than refetching.
   *
   * Flat rather than `number[][]` because M9 put the compute path on typed
   * arrays end to end: the grid is converted once, here, at the boundary with
   * the network adapter, and nothing downstream of that conversion ever sees a
   * jagged array again.
   */
  matrix: Int32Array
  /** Side of `matrix`. Carried because a flat buffer cannot report its own. */
  matrixN: number
  /**
   * One bit per cell of `matrix`: this cost came from a provider, not a guess.
   *
   * Cached alongside the costs, because a cache that cannot tell the two apart
   * would harden this solve's estimates into next solve's facts — and nothing
   * downstream would ever ask again.
   */
  matrixKnown: Uint8Array
  /** Arcs of the SOLVED TOUR that were still guesses when it was chosen. */
  estimatedArcs: number
  /** Provider requests this plan cost. Zero means the cache answered. */
  matrixRequests: number
  /** Per matrix index: which `waypoints` entry it is, or null for an endpoint. */
  matrixWaypointIndex: (number | null)[]
  /** True when every time window along the solved order is met. */
  feasible: boolean
  /** Total lateness in seconds. Zero when `feasible`. */
  timeWarpSec: number
  /**
   * How late each entry of `orderedWaypoints` is against its own closing time.
   * Zero where the window is met, and zero everywhere when there are none.
   */
  lateBySec: number[]
  /** Where the breaks landed. Empty when none were asked for. */
  breaks: PlannedBreak[]
}

/**
 * A break, as a node the solver already knows how to handle.
 *
 * ── Why this is a matrix transformation and not an engine feature ─────────
 *
 * A rest break is a thing that takes 45 minutes, must happen inside a window,
 * and can be taken anywhere. That is EXACTLY a mandatory stop with a service
 * time, a time window, and zero travel cost to and from everywhere else. So the
 * matrix grows one row and one column of zeros per break and the engine never
 * learns what a break is — no new move, no special case in the local search, no
 * second way for the schedule to be wrong.
 *
 * Three consequences worth stating:
 *
 *   - The arc objective is indifferent to where a break goes, because all its
 *     arcs are free. Only the windows position it, which is correct: a break
 *     costs time, not distance.
 *   - Skipping a break is not a solver decision. The caller either includes the
 *     node or does not, and every downstream arrival shifts accordingly because
 *     arrivals are recomputed from the order.
 *   - A break is every node's nearest neighbour, since it is zero away from all
 *     of them, so it occupies one of the ten candidate-list slots for every
 *     stop. Measurable in principle; with one or two breaks against ten slots
 *     it has not been measurable in practice.
 */
export function augmentWithBreaks(
  matrix: Int32Array,
  n: number,
  breaks: readonly PlanBreak[],
): { matrix: Int32Array; n: number } {
  if (breaks.length === 0) return { matrix, n }
  const size = n + breaks.length
  const grown = new Int32Array(size * size)
  for (let i = 0; i < n; i++) {
    grown.set(matrix.subarray(i * n, i * n + n), i * size)
  }
  // Every other cell is already zero, which is the whole trick.
  return { matrix: grown, n: size }
}

/**
 * Full pipeline (all in-browser):
 *   1. OSRM Table -> integer cost matrix (time or distance) over the point list
 *   2. OR-Tools   -> pick the best K candidates + order them, with fixed OR free
 *                    start/end
 *   3. OSRM Route -> real road geometry + totals for the chosen sequence
 *
 * Start/end may be null (open route) and may be chosen from the uploaded list —
 * a list-selected endpoint is de-duplicated out of the candidate set so it isn't
 * visited twice.
 */
export async function planSelectiveRoute(input: PlanInput): Promise<PlannedRoute> {
  const {
    startLocation,
    endLocation,
    waypoints,
    targetK,
    objective,
    timeBudgetMs,
    onStatus,
    engine,
    onProgress,
    signal,
  } = input
  // Candidates = uploaded stops, minus any that coincide with a chosen
  // endpoint. Their positions in the caller's array are carried alongside, so
  // the caller can name the matrix's rows without this module seeing an id.
  const { points, matrixWaypointIndex, candidateIndices } = matrixLayout(input)
  const candidates = candidateIndices.map((i) => waypoints[i])
  if (points.length < 2) {
    throw new Error('Add at least two points (upload a file, or set start/end).')
  }

  const startNode = startLocation ? 0 : null
  const endNode = endLocation ? points.length - 1 : null
  // Clamp K to a sensible range: blank = visit all; otherwise 1..candidates
  // (so K>N caps at N and K<1 becomes 1 — never a degenerate empty route).
  const k =
    targetK == null
      ? candidates.length
      : Math.min(Math.max(Math.floor(targetK), 1), candidates.length)
  // Fixed endpoints occupy slots in the ordered route but aren't candidate stops.
  const fixedCount = (startNode !== null ? 1 : 0) + (endNode !== null ? 1 : 0)

  /*
    1) The cost grid: cache first, then as few requests as the search needs,
       then a calibrated straight line for everything else.

    The pinned endpoints are fetched in full. There are at most two of them,
    every tour uses both, and 2n cells is cheap insurance against the first and
    last legs of a round being guesses.
  */
  const n = points.length
  onStatus?.('Fetching cost matrix…')
  const grid = await buildCostGrid({
    points,
    objective,
    seed: input.seed,
    mandatory: [startNode, endNode].filter((i): i is number => i !== null),
    signal,
    onProgress: (done, total) => {
      onStatus?.(total > 1 ? `Fetching cost matrix… ${done}/${total}` : 'Fetching cost matrix…')
    },
  })
  const matrix = grid.matrix

  /*
    The matrix holds SECONDS on a duration objective and METRES on a distance
    one, because only one OSRM table is fetched per solve and fetching two would
    double the traffic for a number the driver never sees.

    The port wants both, so the missing one is derived at the 8 m/s this
    codebase already uses everywhere it has metres and needs seconds — see
    `haversineCost` in costMatrix.ts and the offline branch below. The
    alternative is passing metres in a field named `durations`, which would be
    a lie that M11's time windows would then act on.
  */
  /*
    Breaks become extra nodes, so everything below works in the AUGMENTED index
    space while `matrix`/`matrixWaypointIndex` — which are handed back for
    caching — stay in the original one. Mixing the two is the obvious way to
    cache a grid whose last two columns are fiction.
  */
  const breaks = input.breaks ?? []
  const total = n + breaks.length
  const breakNodeAt = (b: number) => n + b

  /**
   * The grid the engine sees, built fresh on every solve.
   *
   * It used to be a constant. It cannot be any more: the refinement pass writes
   * the road router's real leg times into `matrix` between solves, and a
   * pre-built augmented copy would hand the second solve the first solve's
   * guesses back.
   */
  const solveMatrix = (): SolveMatrix => {
    const augmented = augmentWithBreaks(matrix, n, breaks)
    return objective === 'distance'
      ? {
          n: augmented.n,
          durations: Int32Array.from(augmented.matrix, (metres) => Math.round(metres / 8)),
          distances: augmented.matrix,
        }
      : { n: augmented.n, durations: augmented.matrix }
  }

  const constraints = makeConstraints(total)
  // A pinned endpoint is not a stop the optimiser may decline to visit.
  if (startNode !== null) constraints.optional[startNode] = 0
  if (endNode !== null) constraints.optional[endNode] = 0

  /*
    The caller's per-stop constraints, mapped from ITS waypoint indices onto the
    matrix's. `candidateIndices[c]` is which of the caller's waypoints matrix row
    `c + (start?1:0)` came from, which is the only join this module is allowed to
    make — it never sees a stop, only a position.
  */
  const perStop = input.stopConstraints
  if (perStop) {
    for (let c = 0; c < candidateIndices.length; c++) {
      const constraint = perStop[candidateIndices[c]]
      if (!constraint) continue
      const node = (startNode !== null ? 1 : 0) + c
      constraints.serviceTimeSec[node] = constraint.serviceTimeSec ?? DEFAULT_SERVICE_SEC
      if (constraint.twOpenSec !== undefined) constraints.twOpenSec[node] = constraint.twOpenSec
      if (constraint.twCloseSec !== undefined) constraints.twCloseSec[node] = constraint.twCloseSec
      const pin = ORDER_NAMES.indexOf(constraint.order ?? 'auto')
      if (pin > 0) constraints.order[node] = pin
    }
  }

  // Each break: mandatory, unpinned, its own window, its own duration.
  breaks.forEach((rest, b) => {
    const node = breakNodeAt(b)
    constraints.optional[node] = 0
    constraints.serviceTimeSec[node] = rest.durationSec
    constraints.twOpenSec[node] = rest.earliestSec
    /*
      The window closes at the LATEST START, not the latest finish, and the
      engine schedules against arrival — so a break that may begin no later than
      14:00 has `twCloseSec = 14:00`. Using the finish would let a 45-minute
      break start at 14:00 and still be called on time.
    */
    constraints.twCloseSec[node] = rest.latestSec
  })

  // 2) Optimize (order, and which candidates to visit) — in-browser, on the
  //    engine the registry picked for this device.
  const solver = engine ?? activeSelection().engine
  const runSolve = (seedOrder: Int32Array, budgetMs: number) =>
    solver.solve(
      {
        // Rebuilt each time, because the refinement pass writes real costs into
        // `matrix` and the augmented copy has to see them.
        matrix: solveMatrix(),
        constraints,
        endpoints: { start: startNode, end: endNode },
        selectK: targetK == null ? null : k,
        skipPenalty: SKIP_PENALTY,
        objective,
        budgetMs,
        departAtSec: input.departAtSec ?? DEFAULT_DEPART_SEC,
        seedOrder,
      },
      onProgress,
      signal,
    )

  onStatus?.('Optimizing route…')
  // A space-filling-curve sort is the only thing in this pipeline that knows
  // where the stops physically are; the matrix does not. Breaks have no
  // position, so they are not in it — the hint is a hint.
  let solved = await runSolve(hilbertOrder(points), timeBudgetMs ?? 3000)

  /*
    Split the solved order back into real points and breaks.

    A break has no coordinate, so it cannot appear in `orderedWaypoints` — but it
    does occupy time, and dropping it silently would make every arrival after it
    optimistic by its whole duration. So it comes back as a `PlannedBreak`
    carrying where it sits and when it starts.
  */
  const readSolution = (result: typeof solved) => {
    const visited: number[] = []
    const lateBySec: number[] = []
    const plannedBreaks: PlannedBreak[] = []
    for (const [i, node] of Array.from(result.order).entries()) {
      if (node >= n) {
        plannedBreaks.push({
          afterIndex: visited.length - 1,
          durationSec: breaks[node - n].durationSec,
          startSec: result.arrivalSec[i],
        })
        continue
      }
      visited.push(node)
      lateBySec.push(result.lateBySec[i])
    }
    return { visited, lateBySec, plannedBreaks, orderedWaypoints: visited.map((i) => points[i]) }
  }

  let plan = readSolution(solved)

  // 3) Best-effort real road geometry for the chosen sequence.
  onStatus?.('Building road route…')
  let road: Awaited<ReturnType<typeof fetchRouteGeometry>> | null = null
  try {
    road = await fetchRouteGeometry(plan.orderedWaypoints)
  } catch {
    road = null
  }

  /*
    4) The refinement, which costs nothing.

    The road router just told us the true duration and distance of every leg it
    drew, and those legs ARE the arcs the solver committed to. So the most
    important cells in the whole grid — the ones actually being driven — become
    facts for no request we were not already making, and the corrected grid is
    what gets cached.

    That is what makes solving on estimates safe. But a corrected arc can also
    change the answer, so if the correction moved the tour cost more than a
    little, the search gets a second, short look at it — warm-started from the
    order it just produced, because this is a polish pass and not a fresh
    search. Capped, because a driver asked for a five-second search once, not
    twice.
  */
  const legCosts = objective === 'distance' ? road?.legMeters : road?.legSeconds
  if (road && legCosts?.length && tourHasEstimates(grid, plan.visited)) {
    const before = tourCost(matrix, n, plan.visited)
    patchTourArcs(grid, plan.visited, legCosts)
    const after = tourCost(matrix, n, plan.visited)
    const drift = before > 0 ? Math.abs(after - before) / before : 0

    if (drift >= REFINE_DRIFT) {
      onStatus?.('Refining with real road times…')
      const refined = await runSolve(
        Int32Array.from(solved.order),
        Math.min(timeBudgetMs ?? 3000, REFINE_BUDGET_MS),
      )
      const changed = !sameOrder(refined.order, solved.order)
      solved = refined
      plan = readSolution(refined)
      if (changed) {
        // A different order needs a different polyline. Best-effort again: the
        // order is right either way, and the old geometry would draw a route
        // nobody is going to drive.
        try {
          road = await fetchRouteGeometry(plan.orderedWaypoints)
        } catch {
          road = null
        }
      }
    }
  }

  const { visited, lateBySec, plannedBreaks, orderedWaypoints } = plan

  // Real cost along the chosen route (sum of matrix cells), and the per-leg
  // costs it is made of — which are the fallback for arrival times when the
  // road router is unreachable.
  let matrixCost = 0
  let estimatedArcs = 0
  const matrixLegs: number[] = []
  for (let i = 0; i < visited.length - 1; i++) {
    const cell = matrix[visited[i] * n + visited[i + 1]]
    matrixLegs.push(cell)
    matrixCost += cell
    if (!getBit(grid.known, visited[i] * n + visited[i + 1])) estimatedArcs++
  }

  /** Everything both return paths carry that describes the GRID, not the tour. */
  const gridFields = {
    matrix,
    matrixN: n,
    matrixKnown: grid.known,
    matrixWaypointIndex,
    estimatedArcs,
    matrixRequests: grid.requests,
  }

  if (road) {
    return {
      orderedWaypoints,
      geometry: road.geometry,
      distanceMeters: road.distanceMeters,
      durationSeconds: road.durationSeconds,
      legSeconds: road.legSeconds,
      legMeters: road.legMeters,
      ...gridFields,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: false,
      feasible: solved.feasible,
      timeWarpSec: solved.timeWarpSec,
      lateBySec,
      breaks: plannedBreaks,
    }
  }

  {
    // Fallback: straight-line geometry + haversine distance. Duration is the
    // real matrix sum only when we optimized on duration; otherwise estimate.
    const straightLegs: number[] = []
    let straightMeters = 0
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      const metres = haversine(orderedWaypoints[i], orderedWaypoints[i + 1])
      straightLegs.push(metres)
      straightMeters += metres
    }
    const geometry: LineString = {
      type: 'LineString',
      coordinates: orderedWaypoints.map((p) => [p.lng, p.lat]),
    }
    return {
      orderedWaypoints,
      geometry,
      distanceMeters: objective === 'distance' ? matrixCost : straightMeters,
      durationSeconds: objective === 'duration' ? matrixCost : straightMeters / 8,
      // The matrix legs ARE seconds when we optimised on duration — that is
      // what the matrix holds. Optimising on distance leaves no time source at
      // all, so the arrival times fall back to a crude 8 m/s rather than
      // pretending metres are seconds.
      legSeconds: objective === 'duration' ? matrixLegs : straightLegs.map((m) => m / 8),
      legMeters: objective === 'distance' ? matrixLegs : straightLegs,
      // Still worth caching: whatever the grid did fetch is real, and the mask
      // says which cells those were. Only the GEOMETRY leg of the pipeline
      // failed.
      ...gridFields,
      candidatesVisited: orderedWaypoints.length - fixedCount,
      candidatesTotal: candidates.length,
      estimated: true,
      feasible: solved.feasible,
      timeWarpSec: solved.timeWarpSec,
      lateBySec,
      breaks: plannedBreaks,
    }
  }
}
