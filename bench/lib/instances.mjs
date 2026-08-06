import { readFileSync } from 'node:fs'
import { makeRng, uniform, normal } from './rng.mjs'
import { UNREACHABLE_COST } from './objective.mjs'

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance in meters — same formula as src/lib/optimize.ts. */
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s))
}

/**
 * Turn coordinates into an integer cost matrix shaped like the one OSRM returns.
 *
 * Two properties matter and are deliberately reproduced:
 *  1. INTEGER cells — OR-Tools requires them, and rounding changes which local
 *     optima exist.
 *  2. ASYMMETRY — real driving matrices are not symmetric (one-ways, turn
 *     restrictions). A solver tuned on a symmetric matrix will look better than
 *     it is, because 2-opt's O(1) reversal delta is only valid when symmetric.
 *     Each direction gets an independent deterministic multiplier.
 */
export function matrixFromPoints(points, seed, asymmetry = 0.12) {
  const rng = makeRng(seed ^ 0x5f356495)
  const n = points.length
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const base = haversine(points[i], points[j])
      const factor = 1 + uniform(rng, -asymmetry, asymmetry)
      matrix[i][j] = Math.max(1, Math.round(base * factor))
    }
  }
  return matrix
}

/** Uniform scatter over a ~20 km box — the easy, well-conditioned case. */
function uniformPoints(n, rng) {
  const points = []
  for (let i = 0; i < n; i++) {
    points.push({ lat: uniform(rng, 55.60, 55.78), lng: uniform(rng, 12.45, 12.68) })
  }
  return points
}

/** Tight clusters with empty space between them — the realistic delivery shape. */
function clusteredPoints(n, rng, clusters = 6, spreadDeg = 0.008) {
  const centres = []
  for (let c = 0; c < clusters; c++) {
    centres.push({ lat: uniform(rng, 55.60, 55.78), lng: uniform(rng, 12.45, 12.68) })
  }
  const points = []
  for (let i = 0; i < n; i++) {
    const c = centres[i % clusters]
    points.push({
      lat: c.lat + normal(rng) * spreadDeg,
      lng: c.lng + normal(rng) * spreadDeg * 1.7,
    })
  }
  return points
}

/**
 * The adversarial family: "cheap near-decoys vs a tight far-cluster".
 *
 * A ring of individually cheap decoy stops sits close to the start, while the
 * genuinely valuable payload is a dense cluster far away. Any greedy
 * construction that always takes the cheapest next arc walks the decoy ring
 * first, burns its K budget, and never reaches the cluster. Escaping needs
 * either a real add/drop move or a diversified restart — which is exactly the
 * capability this benchmark is meant to measure.
 *
 * With K < n, the optimal play is usually to SKIP most decoys entirely.
 */
function decoyPoints(n, rng) {
  const origin = { lat: 55.6761, lng: 12.5683 }
  const decoyCount = Math.max(1, Math.round(n * 0.55))
  const points = [origin]

  // Decoys: a ring 0.5–2 km out, individually cheap to reach from the start.
  for (let i = 1; i < decoyCount; i++) {
    const angle = uniform(rng, 0, 2 * Math.PI)
    const radius = uniform(rng, 0.006, 0.02)
    points.push({
      lat: origin.lat + Math.sin(angle) * radius,
      lng: origin.lng + Math.cos(angle) * radius * 1.7,
    })
  }

  // Payload: a dense cluster ~18 km away — expensive to enter, cheap to work.
  const far = { lat: origin.lat + 0.16, lng: origin.lng + 0.10 }
  for (let i = decoyCount; i < n; i++) {
    points.push({
      lat: far.lat + normal(rng) * 0.0035,
      lng: far.lng + normal(rng) * 0.006,
    })
  }
  return points
}

/** The 107-point real-world instance shipped in samples/. */
function samplePoints() {
  const raw = JSON.parse(readFileSync(new URL('../../samples/bikes_low_battery.json', import.meta.url), 'utf8'))
  return raw.map((p) => ({ lat: p.lat, lng: p.lng }))
}

const FAMILIES = {
  uniform: (n, rng) => uniformPoints(n, rng),
  clustered: (n, rng) => clusteredPoints(n, rng),
  decoy: (n, rng) => decoyPoints(n, rng),
  sample: () => samplePoints(),
}

/**
 * Build one benchmark instance.
 *
 * Node 0 is always the fixed start and node n-1 the fixed end, matching the
 * point ordering planRoute.ts builds ([start, ...candidates, end]). `k` counts
 * candidate stops only, so it is capped at n-2.
 */
export function makeInstance({ family, n, k, seed = 1, matrix: providedMatrix }) {
  const rng = makeRng(seed)
  const points = FAMILIES[family](n, rng)
  const size = points.length
  const matrix = providedMatrix ?? matrixFromPoints(points, seed)

  const candidates = size - 2
  const cappedK = Math.min(k ?? candidates, candidates)

  return {
    id: `${family}-n${size}-k${cappedK}-s${seed}`,
    family,
    n: size,
    k: cappedK,
    seed,
    startNode: 0,
    endNode: size - 1,
    points,
    matrix,
  }
}

/**
 * Load a cached real OSRM matrix for the 107-point sample, if one has been
 * fetched (see `npm run bench:fixtures`). Returns null when absent so the
 * harness stays runnable offline — with a clearly-labelled synthetic matrix.
 */
export function loadSampleMatrix() {
  try {
    const url = new URL('../fixtures/bikes_low_battery.matrix.json', import.meta.url)
    const data = JSON.parse(readFileSync(url, 'utf8'))
    return { matrix: data.matrix, objective: data.objective, source: 'osrm' }
  } catch {
    return null
  }
}

export { UNREACHABLE_COST }
