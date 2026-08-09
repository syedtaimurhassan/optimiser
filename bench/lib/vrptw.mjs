/**
 * Solomon and Gehring-Homberger VRPTW instances — scored ONE ROUTE AT A TIME.
 *
 * ── What M9 deferred, and how M11 resolved it ─────────────────────────────
 *
 * M9 parked this file with a precise complaint: these benchmarks have a
 * HIERARCHICAL objective — minimise the number of vehicles first, then total
 * distance — plus vehicle capacity. Our engine is single-vehicle, so it cannot
 * compete on the first term at all, and a gap computed with the fleet term and
 * capacity relaxed answers a different question. That complaint was right and
 * still is.
 *
 * The way out is to stop asking the benchmark's question and start asking ours.
 * SINTEF publishes the best-known SOLUTIONS, not merely their costs — each one a
 * list of routes, each route a set of customers one vehicle serves in one order.
 * Fix that customer set and every difficulty M9 named disappears: the fleet is
 * one vehicle by construction, capacity is satisfied by construction (a
 * best-known solution obeys it), and what remains is exactly the problem this
 * engine exists to solve — sequence these stops, meet these windows, minimise
 * travel.
 *
 * So each published route becomes a TSPTW sub-instance, and the question is:
 * given the customers a state-of-the-art VRPTW solver assigned to this vehicle,
 * can we order them at least as well as it did? That is a fair fight, it uses
 * the geometry the milestone brief asked about, and — because our cost and
 * theirs are computed by the same function over the same customers — any
 * disagreement about Solomon's rounding conventions cancels out exactly.
 *
 * The absolute gaps live in `bench/tsptw.mjs`, against a library of
 * single-vehicle instances with proven optima. This file is the shape check.
 *
 * ── Where the numbers live ────────────────────────────────────────────────
 *
 * SINTEF's TOP pages are the maintained registry of best-known solutions:
 *   https://www.sintef.no/projectweb/top/vrptw/solomon-benchmark/
 *   https://www.sintef.no/projectweb/top/vrptw/homberger-benchmark/
 * Each instance's entry gives vehicles and distance, plus who found it and
 * when. They are BEST KNOWN, not proven optima, for all but the smallest.
 */

/** One customer row of a Solomon-format instance. */
export function parseSolomon(text) {
  const lines = text.split(/\r?\n/)
  let name = 'unnamed'
  let vehicles = null
  let capacity = null
  const customers = []

  let section = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue

    if (i === 0) {
      name = line
      continue
    }
    if (/^VEHICLE$/i.test(line)) {
      section = 'vehicle'
      continue
    }
    if (/^CUSTOMER$/i.test(line)) {
      section = 'customer'
      continue
    }
    if (/^NUMBER\s+CAPACITY$/i.test(line)) continue
    if (/^CUST\s*NO\./i.test(line) || /^CUST/i.test(line)) continue

    const numbers = line.split(/\s+/).map(Number)
    if (section === 'vehicle' && numbers.length === 2 && numbers.every(Number.isFinite)) {
      vehicles = numbers[0]
      capacity = numbers[1]
      continue
    }
    if (section === 'customer' && numbers.length >= 7 && numbers.every(Number.isFinite)) {
      const [id, x, y, demand, readyTime, dueDate, serviceTime] = numbers
      customers.push({ id, x, y, demand, readyTime, dueDate, serviceTime })
    }
  }

  if (customers.length === 0) throw new Error('no customers parsed — is this a Solomon file?')
  return { name, vehicles, capacity, customers }
}

/**
 * Euclidean travel times, the Solomon convention.
 *
 * NOT rounded. Solomon distances are real-valued, and the published best-known
 * values are computed that way — rounding them to integers, as TSPLIB's EUC_2D
 * does, shifts every total and makes the comparison meaningless. Our port takes
 * `Int32Array`, so M11 will have to decide on a fixed-point scale (×100 is the
 * usual choice) and say so out loud.
 */
export function solomonMatrix({ customers }) {
  const n = customers.length
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      matrix[i][j] = Math.hypot(customers[i].x - customers[j].x, customers[i].y - customers[j].y)
    }
  }
  return matrix
}

/** Constraints in the shape the M9 port declares but does not yet honour. */
export function solomonConstraints({ customers }) {
  const n = customers.length
  return {
    serviceTimeSec: Int32Array.from(customers, (c) => c.serviceTime),
    twOpenSec: Int32Array.from(customers, (c) => c.readyTime),
    twCloseSec: Int32Array.from(customers, (c) => c.dueDate),
    demand: Int32Array.from(customers, (c) => c.demand),
    order: new Uint8Array(n),
    optional: new Uint8Array(n), // every customer is mandatory in a VRPTW
  }
}

/**
 * Best-known solutions, `[vehicles, distance]`, from SINTEF's TOP registry.
 *
 * A deliberately small sample of the 56 Solomon instances — one from each of
 * the six classes — recorded so M11 has something to check its wiring against
 * before it fetches the rest. C1/C2 are clustered, R1/R2 random, RC1/RC2 mixed;
 * the "1" series has tight windows and short horizons, the "2" series wide
 * windows and long ones.
 */
export const SOLOMON_BEST_KNOWN = {
  C101: [10, 828.94],
  C201: [3, 591.56],
  R101: [19, 1650.8],
  R201: [4, 1252.37],
  RC101: [14, 1696.95],
  RC201: [4, 1406.94],
}

/** The objective these benchmarks are actually scored on. */
export function compareVrptw(a, b) {
  if (a.vehicles !== b.vehicles) return a.vehicles - b.vehicles
  return a.distance - b.distance
}

// ─────────────────────────────────── published solutions, as sub-instances

/**
 * Parse a SINTEF best-known solution file.
 *
 *   Instance name : c101
 *   …
 *   Route  1 : 81 78 76 71 70 73 77 79 80
 *
 * Customer numbers are 1-based and exclude the depot at both ends.
 */
export function parseSintefSolution(text) {
  const routes = []
  let name = 'unnamed'
  for (const line of text.split('\n')) {
    const named = /^Instance name\s*:\s*(\S+)/i.exec(line)
    if (named) {
      name = named[1]
      continue
    }
    const route = /^Route\s*\d+\s*:\s*(.*)$/i.exec(line.trim())
    if (!route) continue
    const customers = route[1]
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((c) => Number.isFinite(c) && c > 0)
    if (customers.length > 0) routes.push(customers)
  }
  return { name, routes }
}

/**
 * One published route, as the open path with pinned ends our engine solves.
 *
 * Nodes are `[depot, ...customers, depot twin]`. Two conventions matter:
 *
 *   1. SERVICE TIME IS FOLDED INTO THE ARCS, `d[i][j] = dist(i,j) + service(i)`,
 *      which is what makes the clock correct without the engine needing a
 *      separate service array. It also adds a CONSTANT to the objective —
 *      every customer is visited exactly once — so it cannot change which
 *      ordering is best. The reported cost is recomputed from distance alone.
 *   2. Values are scaled to fixed point, because the port takes `Int32Array`
 *      and Solomon coordinates are real. The engine optimises the rounded copy
 *      and is graded on the real one.
 */
export function routeAsOpenPath({ customers }, route, scale = 100) {
  const nodes = [0, ...route]
  const size = nodes.length + 1
  const at = (k) => customers[nodes[k]]
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  const matrix = Array.from({ length: size }, () => new Array(size).fill(0))
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      matrix[i][j] = Math.round((dist(at(i), at(j)) + at(i).serviceTime) * scale)
    }
    // Returning to the depot: same cost as the arc into node 0.
    matrix[i][size - 1] = Math.round((dist(at(i), customers[0]) + at(i).serviceTime) * scale)
    matrix[size - 1][i] = 9_999_999
  }
  matrix[0][size - 1] = 9_999_999
  matrix[size - 1][0] = 9_999_999

  const twOpenSec = nodes.map((c) => Math.round(customers[c].readyTime * scale))
  const twCloseSec = nodes.map((c) => Math.round(customers[c].dueDate * scale))
  twOpenSec.push(Math.round(customers[0].readyTime * scale))
  twCloseSec.push(Math.round(customers[0].dueDate * scale))

  return {
    nodes,
    n: size,
    matrix,
    twOpenSec,
    twCloseSec,
    serviceTimeSec: new Array(size).fill(0),
    startNode: 0,
    endNode: size - 1,
    k: size - 2,
  }
}

/**
 * Score a sequence of customers under Solomon's own conventions.
 *
 * Arrive, wait for the window to open if early, serve, drive on. Lateness is a
 * violation rather than something to be absorbed — this is the referee, not the
 * search, and the search's time-warp relaxation has no place in it.
 *
 * `distance` excludes service time; that is what SINTEF's published totals are.
 */
export function evaluateSolomonRoute({ customers }, sequence) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  let clock = 0
  let distance = 0
  let violations = 0
  let lateness = 0
  let worst = null
  let prev = 0

  const step = (index) => {
    const leg = dist(customers[prev], customers[index])
    distance += leg
    const arrival = clock + leg
    if (arrival > customers[index].dueDate) {
      violations++
      const late = arrival - customers[index].dueDate
      lateness += late
      if (!worst || late > worst.lateBy) worst = { customer: index, lateBy: late, arrival }
    }
    clock = Math.max(arrival, customers[index].readyTime) + customers[index].serviceTime
    prev = index
  }

  for (const index of sequence) step(index)
  step(0)

  return { distance, makespan: clock, violations, lateness, worst }
}
