import { readFileSync } from 'node:fs'

/**
 * The TSPTW instance library — parser, open-path transform, and the referee.
 *
 * ── Why this replaced the Solomon plan ────────────────────────────────────
 *
 * M11's brief said to verify time windows against Solomon and Gehring-Homberger.
 * Those are scored on a HIERARCHICAL objective — minimise the number of vehicles
 * first, then distance — and carry vehicle capacity as well. Our engine is
 * single-vehicle, so it cannot compete on the first term of that objective at
 * all, and a gap computed with the fleet term and capacity relaxed is an answer
 * to a different question. M9 deferred them for exactly this reason and was
 * right to.
 *
 * The TSPTW library is the same problem we actually solve: ONE vehicle, a start,
 * a sequence, time windows, minimise travel. 467 instances across seven sets,
 * 435 of them with a PROVEN OPTIMUM, maintained with sources and bounds:
 *
 *   https://lopez-ibanez.eu/tsptw-instances
 *
 * Solomon and Gehring-Homberger are not abandoned — see `bench/solomon-routes.mjs`,
 * which takes SINTEF's published best-known SOLUTIONS and re-solves each of their
 * individual routes as a TSPTW sub-instance. That is a question our engine can
 * answer honestly, and it is the one a driver actually asks.
 *
 * ── The objective is not ours to define ───────────────────────────────────
 *
 * `evaluate` below is a transcription of the authors' own `check_solution.cpp`
 * (Lopez-Ibanez & Blum, 2009, GPL-2.0+), fetched alongside the instances:
 *
 *   https://lopez-ibanez.eu/files/TSPTW/check_solution.cpp
 *
 * Transcribed rather than imported because it is C++, and re-derived rather than
 * guessed because three details are load-bearing and none of them is obvious:
 *
 *   1. SERVICE TIME IS BAKED INTO THE MATRIX. `d[i][j]` is travel plus the
 *      service at `i`, which is why the diagonal is non-zero. There is no
 *      separate service array to pass, and adding one would double-count.
 *   2. The clock is `max(clock + d[prev][node], open[node])` — waiting for a
 *      window to open is free and does not count against the tour cost.
 *   3. The tour is CLOSED and the return to the depot is scored, against the
 *      depot's own window. A solver that stops at the last customer is cheaper
 *      than the published optimum by exactly one arc.
 *
 * Getting any of them wrong produces a plausible number that means nothing, so
 * `verifyAgainstPublished` re-evaluates every published best-known PERMUTATION
 * and requires the cost we compute to be the cost they published. The harness is
 * checked against the library before the library is used to check the engine.
 *
 * ── Fixed point ───────────────────────────────────────────────────────────
 *
 * Distances are real-valued (`45.1774`), the port takes `Int32Array`, so
 * everything crossing into an engine is scaled by `SCALE` and everything
 * REPORTED is computed in the original domain from the raw order. The engine
 * therefore optimises a rounded instance and is graded on the real one, which is
 * the honest way round: it can only lose from the rounding, never gain.
 */

/**
 * Fixed-point multiplier for the crossing into `Int32Array`.
 *
 * 100 keeps four significant figures on a Solomon coordinate and leaves the
 * largest instance (n=200, arcs ~200 units) at ~4e6 — three orders of magnitude
 * inside i32, and well below `SKIP_PENALTY`, which never applies here anyway
 * because every customer is mandatory.
 */
export const SCALE = 100

/** Same sentinel the TSPLIB transform uses for an arc that must never be taken. */
const FORBIDDEN = 9_999_999

/**
 * Parse the library's format:
 *
 *   n                     — customers INCLUDING the depot, which is node 0
 *   n rows of n numbers   — the cost matrix, service time included
 *   n rows of `open close`
 *
 * Comment lines (`#`) and blank lines are skipped. Numbers are read as a flat
 * stream rather than line-by-line, because AFG wraps its longer rows.
 */
export function parseTsptw(text, name = 'unnamed') {
  const tokens = text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map(Number)

  if (tokens.length === 0 || !Number.isFinite(tokens[0])) {
    throw new Error(`${name}: could not read the node count`)
  }
  const n = tokens[0]
  const expected = 1 + n * n + 2 * n
  if (tokens.length < expected) {
    throw new Error(`${name}: expected ${expected} numbers, found ${tokens.length}`)
  }
  if (tokens.some((t) => !Number.isFinite(t))) {
    throw new Error(`${name}: file contains a non-numeric field`)
  }

  let at = 1
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) matrix[i][j] = tokens[at++]
  }

  const open = new Array(n)
  const close = new Array(n)
  for (let i = 0; i < n; i++) {
    open[i] = tokens[at++]
    close[i] = tokens[at++]
  }

  return { name, n, matrix, open, close }
}

export function loadTsptwFile(path, name) {
  return parseTsptw(readFileSync(path, 'utf8'), name)
}

/**
 * The closed tour, as the open path with pinned ends that our engine solves.
 *
 * Identical trick to `asClosedTour` in tsplib.mjs: the depot is duplicated as
 * node `n`, arcs INTO the twin cost what arcs into the depot cost, nothing may
 * leave it, and the twins may not be adjacent. The twin inherits the depot's
 * time window, which is what makes "be back before the depot closes" a
 * constraint the engine can see rather than a rule the referee applies
 * afterwards.
 *
 * Every value crossing into an engine is scaled; `instance` keeps the originals
 * so the referee can score in the real domain.
 */
export function asOpenPath(instance) {
  const { n, matrix, open, close } = instance
  const size = n + 1
  const grid = Array.from({ length: size }, () => new Array(size).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) grid[i][j] = Math.round(matrix[i][j] * SCALE)
  }
  for (let i = 0; i < n; i++) {
    grid[i][n] = Math.round(matrix[i][0] * SCALE)
    grid[n][i] = FORBIDDEN
  }
  grid[0][n] = FORBIDDEN
  grid[n][0] = FORBIDDEN

  const twOpenSec = new Array(size)
  const twCloseSec = new Array(size)
  for (let i = 0; i < n; i++) {
    twOpenSec[i] = Math.round(open[i] * SCALE)
    twCloseSec[i] = Math.round(close[i] * SCALE)
  }
  twOpenSec[n] = Math.round(open[0] * SCALE)
  twCloseSec[n] = Math.round(close[0] * SCALE)

  return {
    id: instance.name,
    n: size,
    matrix: grid,
    twOpenSec,
    twCloseSec,
    // Service time is already inside the matrix — see the header. Passing it
    // again here is the single easiest way to get a wrong answer that looks
    // right, so the array is explicitly zero rather than absent.
    serviceTimeSec: new Array(size).fill(0),
    startNode: 0,
    endNode: size - 1,
    k: size - 2,
  }
}

/**
 * Map an open-path order back to the customer permutation the library scores.
 *
 * Drops the leading depot and the trailing twin. Returns null when the order is
 * not a well-formed path over this instance, because a permutation that is
 * missing a customer must be reported as invalid rather than scored cheaply.
 */
export function toPermutation(instance, order) {
  const n = instance.n
  if (!Array.isArray(order) || order.length !== n + 1) return null
  if (order[0] !== 0 || order[order.length - 1] !== n) return null

  const seen = new Set()
  const permutation = []
  for (let i = 1; i < order.length - 1; i++) {
    const node = order[i]
    if (!Number.isInteger(node) || node < 1 || node >= n) return null
    if (seen.has(node)) return null
    seen.add(node)
    permutation.push(node)
  }
  return permutation.length === n - 1 ? permutation : null
}

/**
 * The referee. A transcription of the authors' `check_solution.cpp`.
 *
 * `permutation` is the customers only, without the depot at either end — the
 * same shape the published `.best` files use, which is what lets those files
 * check this function.
 */
export function evaluate(instance, permutation) {
  const { matrix, open, close, n } = instance
  if (permutation.length !== n - 1) {
    throw new Error(`${instance.name}: permutation has ${permutation.length}, expected ${n - 1}`)
  }

  let clock = 0
  let tourCost = 0
  let violations = 0
  let lateness = 0
  let worst = null
  let prev = 0
  const arrivals = [0]

  const step = (node) => {
    tourCost += matrix[prev][node]
    clock = Math.max(clock + matrix[prev][node], open[node])
    arrivals.push(clock)
    if (clock > close[node]) {
      violations++
      const late = clock - close[node]
      lateness += late
      if (!worst || late > worst.lateBy) worst = { node, lateBy: late, arrival: clock }
    }
    prev = node
  }

  for (const node of permutation) step(node)
  // The return leg is part of the tour and is scored against the depot's own
  // window. Omitting it is worth one whole arc and would flatter every result.
  step(0)

  return { tourCost, makespan: clock, violations, lateness, worst, arrivals }
}

/** Parse a `.best` file: `instance  cost  violations  permutation…`. */
export function parseBestKnownSolutions(text) {
  const out = new Map()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const fields = trimmed.split(/\s+/)
    if (fields.length < 4) continue
    const [name, cost, violations, ...permutation] = fields
    out.set(name, {
      cost: Number(cost),
      violations: Number(violations),
      permutation: permutation.map(Number),
    })
  }
  return out
}

/**
 * Parse `Traveltime_Bounds.csv` — the maintained best-known table.
 *
 * A `*` in the optimality-gap column means the bound and the best-known meet,
 * i.e. the value is a PROVEN OPTIMUM. That distinction is the reason to read
 * this file at all: a gap to a proven optimum is an absolute statement about our
 * engine, and a gap to a best-known is only a statement about the state of the
 * literature.
 */
export function parseBounds(text) {
  const out = new Map()
  const lines = text.split('\n')
  for (const line of lines.slice(1)) {
    const fields = line.split(',')
    if (fields.length < 5) continue
    const [set, instance, best, , gap] = fields.map((f) => f.trim())
    if (!set || !instance) continue
    const value = Number(best)
    if (!Number.isFinite(value)) continue
    out.set(`${set}/${instance}`, { set, instance, best: value, proven: gap === '*' })
  }
  return out
}

/**
 * Re-evaluate every published best-known permutation and require our arithmetic
 * to agree with theirs.
 *
 * This is the harness checking ITSELF, and it has to happen before any number
 * the harness produces about an engine can be believed. Returns the mismatches;
 * empty means the parser, the matrix convention, the clock and the closing leg
 * are all right.
 */
export function verifyAgainstPublished(instances, published) {
  const problems = []
  for (const [name, expected] of published) {
    const instance = instances.get(name)
    if (!instance) continue
    let actual
    try {
      actual = evaluate(instance, expected.permutation)
    } catch (e) {
      problems.push(`${name}: ${e.message}`)
      continue
    }
    // The published files carry two decimals, so compare at that resolution
    // rather than exactly — the instances themselves hold four.
    if (Math.abs(actual.tourCost - expected.cost) > 0.005) {
      problems.push(
        `${name}: we score the published permutation at ${actual.tourCost.toFixed(2)}, ` +
          `they published ${expected.cost.toFixed(2)}`,
      )
    }
    if (actual.violations !== expected.violations) {
      problems.push(
        `${name}: we count ${actual.violations} window violations, they published ${expected.violations}`,
      )
    }
  }
  return problems
}
