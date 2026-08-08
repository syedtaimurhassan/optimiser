/**
 * Solomon and Gehring-Homberger VRPTW instances — PARSED, NOT SCORED.
 *
 * ── Why nothing here runs yet ─────────────────────────────────────────────
 *
 * Because a gap number we could produce today would be fiction, and it is worth
 * being precise about why rather than leaving a TODO.
 *
 * These benchmarks have a HIERARCHICAL objective: minimise the number of
 * vehicles first, then total distance. A solution using one fewer vehicle beats
 * any solution using more, whatever the distance. Our engine is single-vehicle,
 * so the first term of the published objective is not something it can compete
 * on at all.
 *
 * On top of that they carry two constraints M9's port declares and ignores:
 * time windows (M11) and vehicle capacity (unscheduled). Solving them with both
 * relaxed does not produce a worse answer to the same question — it produces an
 * answer to a different one, and comparing it to a published best-known would
 * be comparing a route that is allowed to arrive at midnight against one that
 * is not.
 *
 * So this file exists to be READY. The parser is written and tested, the
 * best-known table is recorded with its source, and M11 can start measuring the
 * day time windows exist instead of starting by writing a parser.
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
