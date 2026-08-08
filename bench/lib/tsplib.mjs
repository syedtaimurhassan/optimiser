import { readFileSync } from 'node:fs'

/**
 * TSPLIB instances, and the honest way to compare against their optima.
 *
 * ── Why bother, when we already have the OSRM fixture ─────────────────────
 *
 * Because "better than the other engine" is a relative claim, and every number
 * in this harness until now has been one. TSPLIB is the only place we can say
 * how far from OPTIMAL a route is, because the optima are published and proven.
 * Without it, three engines could agree on an answer 30% above optimal and the
 * comparison table would look perfectly healthy.
 *
 * ── The closed-tour problem, and the trick that solves it ─────────────────
 *
 * TSPLIB optima are for a closed TOUR — start at a city, visit all, return. Our
 * port solves an open PATH with optionally-pinned ends, and cannot express
 * "start and end at the same node" because a node may appear only once.
 *
 * So the depot is DUPLICATED. Node 0 is copied as node n, with identical costs
 * to and from every other city and a forbidden arc between the twins. Pinning
 * start = 0 and end = n turns the open path 0 → … → 0' into exactly the closed
 * tour the published optimum refers to, with the same total cost. No engine
 * needs to know, and the comparison is genuinely like-for-like.
 *
 * ── Rounding is not a detail ──────────────────────────────────────────────
 *
 * TSPLIB's EUC_2D is `nint(sqrt(xd² + yd²))` where nint rounds to the nearest
 * integer, halfway cases away from zero. Get that wrong and every distance is
 * off by up to half a unit, the optimum is no longer the optimum for YOUR
 * matrix, and the reported gap is a measurement of the rounding rather than of
 * the solver. Distances are non-negative here, so Math.round matches nint
 * exactly.
 *
 * Formats supported: EUC_2D, CEIL_2D, ATT, GEO, and EXPLICIT with the
 * FULL_MATRIX / UPPER_ROW / LOWER_DIAG_ROW variants. Anything else is rejected
 * loudly rather than silently mis-measured.
 */

const RADIANS_PER_DEGREE = Math.PI / 180

/** TSPLIB's GEO reading: DDD.MM is degrees and MINUTES, not a decimal degree. */
function geoRadians(coordinate) {
  const degrees = Math.trunc(coordinate)
  const minutes = coordinate - degrees
  return RADIANS_PER_DEGREE * (degrees + (5 * minutes) / 3)
}

const DISTANCE = {
  EUC_2D: (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y)),
  CEIL_2D: (a, b) => Math.ceil(Math.hypot(a.x - b.x, a.y - b.y)),

  /** The pseudo-Euclidean measure, verbatim from the TSPLIB specification. */
  ATT: (a, b) => {
    const rij = Math.sqrt(((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 10)
    const tij = Math.round(rij)
    return tij < rij ? tij + 1 : tij
  },

  GEO: (a, b) => {
    const RRR = 6378.388
    const latA = geoRadians(a.x)
    const lngA = geoRadians(a.y)
    const latB = geoRadians(b.x)
    const lngB = geoRadians(b.y)
    const q1 = Math.cos(lngA - lngB)
    const q2 = Math.cos(latA - latB)
    const q3 = Math.cos(latA + latB)
    return Math.trunc(RRR * Math.acos(0.5 * ((1 + q1) * q2 - (1 - q1) * q3)) + 1)
  },
}

/** Parse a .tsp file into `{ name, n, matrix }` with integer costs. */
export function parseTsplib(text) {
  const lines = text.split(/\r?\n/)
  const header = {}
  let section = null
  const coords = []
  const explicit = []

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '' || line === 'EOF') continue

    const keyed = line.match(/^([A-Z_]+)\s*:\s*(.*)$/)
    if (keyed) {
      header[keyed[1]] = keyed[2].trim()
      section = null
      continue
    }
    if (/^[A-Z_]+$/.test(line)) {
      section = line
      continue
    }

    if (section === 'NODE_COORD_SECTION') {
      const parts = line.split(/\s+/).map(Number)
      coords.push({ id: parts[0], x: parts[1], y: parts[2] })
    } else if (section === 'EDGE_WEIGHT_SECTION') {
      for (const value of line.split(/\s+/)) {
        if (value !== '') explicit.push(Number(value))
      }
    }
  }

  const n = Number(header.DIMENSION)
  const type = header.EDGE_WEIGHT_TYPE
  if (!n) throw new Error('TSPLIB file has no DIMENSION')

  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

  if (type === 'EXPLICIT') {
    fillExplicit(matrix, n, explicit, header.EDGE_WEIGHT_FORMAT)
  } else {
    const distance = DISTANCE[type]
    if (!distance) {
      throw new Error(`unsupported EDGE_WEIGHT_TYPE "${type}" — refusing to guess`)
    }
    if (coords.length !== n) {
      throw new Error(`expected ${n} coordinates, found ${coords.length}`)
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) matrix[i][j] = distance(coords[i], coords[j])
      }
    }
  }

  return { name: header.NAME ?? 'unnamed', n, matrix, type }
}

function fillExplicit(matrix, n, values, format) {
  let at = 0
  const take = () => values[at++]

  if (format === 'FULL_MATRIX') {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) matrix[i][j] = take()
    return
  }
  if (format === 'UPPER_ROW') {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = take()
        matrix[i][j] = v
        matrix[j][i] = v
      }
    }
    return
  }
  if (format === 'LOWER_DIAG_ROW') {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const v = take()
        matrix[i][j] = v
        matrix[j][i] = v
      }
    }
    return
  }
  if (format === 'UPPER_DIAG_ROW') {
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const v = take()
        matrix[i][j] = v
        matrix[j][i] = v
      }
    }
    return
  }
  throw new Error(`unsupported EDGE_WEIGHT_FORMAT "${format}" — refusing to guess`)
}

/** Cost of an arc that must never be taken. Larger than any real tour. */
const FORBIDDEN = 9_999_999

/**
 * Turn a TSP instance into the closed-tour-as-open-path form described above.
 *
 * Returns an (n+1)×(n+1) matrix where node `n` is a twin of node 0, plus the
 * pinning the harness should use. Solving it with start = 0, end = n and every
 * city mandatory yields a route whose cost equals the closed tour's.
 */
export function asClosedTour({ name, n, matrix }) {
  const size = n + 1
  const grid = Array.from({ length: size }, () => new Array(size).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) grid[i][j] = matrix[i][j]
  }
  // The twin: same costs INTO it as into node 0, from every city.
  for (let i = 0; i < n; i++) {
    grid[i][n] = matrix[i][0]
    // Nothing may leave the twin — it is the end of the path.
    grid[n][i] = FORBIDDEN
  }
  // And the twins may not be adjacent, or a two-node "tour" would cost nothing.
  grid[0][n] = FORBIDDEN
  grid[n][0] = FORBIDDEN

  return {
    id: name,
    n: size,
    matrix: grid,
    startNode: 0,
    endNode: size - 1,
    /** Every city must be visited; K counts candidates, which excludes the ends. */
    k: size - 2,
  }
}

export function loadTsplibFile(path) {
  return parseTsplib(readFileSync(path, 'utf8'))
}
