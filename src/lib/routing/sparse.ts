/**
 * Which arcs are worth asking about, and what the rest are worth.
 *
 * ── The candidate list, and the padding the road makes necessary ──────────
 *
 * The local search only ever considers each stop's nearest neighbours, so only
 * those arcs need to be real. The obvious implementation — take each stop's ten
 * nearest by straight line — is measurably wrong. Against the real OSRM matrix
 * in `bench/fixtures/`, of each stop's true ten nearest BY ROAD:
 *
 *   haversine's top 10 recovers  73.4%
 *   haversine's top 15 recovers  90.5%
 *   haversine's top 20 recovers  96.5%
 *   haversine's top 30 recovers  99.4%
 *
 * A straight line does not know about rivers, one-way systems or motorway
 * junctions, so a quarter of the real neighbour list is missed at K=10. Hence
 * `CANDIDATE_PADDING`: fetch 2K straight-line neighbours to recover K road
 * ones. The fetch stays linear in n either way; the padding costs a constant
 * factor and buys back a quarter of the search's own inputs.
 *
 * ── What an unfetched arc is worth ────────────────────────────────────────
 *
 * Something, and it must not be optimistic. The codebase's long-standing
 * straight-line fallback is 8 m/s, and on that same real instance the median
 * arc is **6.69 m/s** — so every estimate was ~20% too fast, which is the
 * dangerous direction: an underestimated arc is a shortcut the solver will
 * take. So the ratio is calibrated from the arcs we DID fetch, at a high
 * quantile. An overestimate costs a missed improvement; an underestimate causes
 * a chosen mistake.
 *
 * Pure module: no network, no store, no I/O.
 */

import type { LatLng, Objective } from '../../types.ts'
import { haversine } from '../optimize.ts'

/** Neighbours the engine's own candidate list uses. Matches the Rust engine. */
export const CANDIDATE_K = 10

/**
 * Straight-line neighbours fetched per road neighbour wanted.
 *
 * 2 is where the measured recall curve flattens: 96.5% at 2×, 99.4% at 3× for
 * half as much again. The last 3% is not worth a third of the request budget.
 */
export const CANDIDATE_PADDING = 2

/**
 * Seconds per straight-line metre when nothing has been measured yet.
 *
 * 1/8 — the same 8 m/s the offline paths in `planRoute` and `costMatrix` have
 * always used. Kept as the no-data default so a route with no real arcs at all
 * behaves exactly as it did before this module existed, rather than differently
 * for a reason nobody would think to look for.
 */
export const DEFAULT_SECONDS_PER_METRE = 1 / 8

/** Road metres per straight-line metre when nothing has been measured yet. */
export const DEFAULT_DETOUR_FACTOR = 1.3

/**
 * Quantile of the observed ratio used for unmeasured arcs.
 *
 * Not the median. See the module note: pessimistic estimates lose improvements,
 * optimistic ones cause mistakes, and only one of those is recoverable by the
 * refinement pass.
 */
export const ESTIMATE_QUANTILE = 0.75

// ────────────────────────────────────────────────────────────────── bitset

/**
 * One bit per cell, packed.
 *
 * A `Uint8Array` per cell would be 1 MB on a thousand-stop route and all of it
 * would be persisted to IndexedDB with the matrix. Packed it is 125 KB.
 */
export const makeBitset = (bits: number): Uint8Array => new Uint8Array((bits + 7) >> 3)

export const setBit = (bits: Uint8Array, i: number): void => {
  bits[i >> 3] |= 1 << (i & 7)
}

export const getBit = (bits: Uint8Array, i: number): boolean => (bits[i >> 3] & (1 << (i & 7))) !== 0

export function countBits(bits: Uint8Array): number {
  let total = 0
  for (const byte of bits) {
    let b = byte
    while (b) {
      b &= b - 1
      total++
    }
  }
  return total
}

// ─────────────────────────────────────────────────────────────── candidates

export interface CandidateOptions {
  /** Road neighbours the search wants. */
  k?: number
  /** Straight-line neighbours fetched per road neighbour. */
  padding?: number
  /**
   * Rows and columns to fetch in full.
   *
   * In practice the pinned start and end. There are at most two of them, every
   * tour uses both, and 2n cells is cheap insurance against the first and last
   * legs of a round being guesses.
   */
  mandatory?: readonly number[]
}

/**
 * Which columns each row needs, as a symmetric closure of the candidate lists.
 *
 * Symmetric because the cost matrix is not: 98.3% of pairs disagree with their
 * reverse on a real road network, and the local search evaluates arcs in both
 * directions. Knowing i→j while guessing j→i would make a move's cost depend on
 * which way round the search happened to consider it.
 */
export function candidateNeeds(
  points: readonly LatLng[],
  options: CandidateOptions = {},
): number[][] {
  const n = points.length
  const k = options.k ?? CANDIDATE_K
  const padding = options.padding ?? CANDIDATE_PADDING
  const width = Math.min(n - 1, Math.max(1, Math.round(k * padding)))

  const needs: Set<number>[] = Array.from({ length: n }, () => new Set<number>())

  for (const i of options.mandatory ?? []) {
    if (i < 0 || i >= n) continue
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      needs[i].add(j)
      needs[j].add(i)
    }
  }

  const scratch: { j: number; d: number }[] = []
  for (let i = 0; i < n; i++) {
    scratch.length = 0
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      scratch.push({ j, d: haversine(points[i], points[j]) })
    }
    scratch.sort((a, b) => a.d - b.d)
    for (let t = 0; t < width && t < scratch.length; t++) {
      const j = scratch[t].j
      needs[i].add(j)
      // The reverse arc, deliberately. See the note above.
      needs[j].add(i)
    }
  }

  return needs.map((set) => [...set].sort((a, b) => a - b))
}

// ─────────────────────────────────────────────────────────────── estimates

/**
 * The cost-per-straight-line-metre this particular round actually exhibits.
 *
 * Derived from the arcs already fetched, so a dense city round and a rural one
 * get different numbers instead of sharing a constant that suits neither. Falls
 * back to the historical default when there is not enough evidence — eight
 * samples, below which a quantile is just the largest of a handful of numbers.
 */
export function calibrateRatio(
  matrix: Int32Array,
  known: Uint8Array,
  points: readonly LatLng[],
  objective: Objective,
  quantile = ESTIMATE_QUANTILE,
): number {
  const n = points.length
  const ratios: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || !getBit(known, i * n + j)) continue
      const metres = haversine(points[i], points[j])
      // Sub-50 m pairs are dominated by where the router snapped them, not by
      // the road between them, and they skew the ratio hard.
      if (metres < 50) continue
      const cost = matrix[i * n + j]
      if (!Number.isFinite(cost) || cost <= 0 || cost >= 9_000_000) continue
      ratios.push(cost / metres)
    }
  }

  if (ratios.length < 8) {
    return objective === 'distance' ? DEFAULT_DETOUR_FACTOR : DEFAULT_SECONDS_PER_METRE
  }
  ratios.sort((a, b) => a - b)
  return ratios[Math.min(ratios.length - 1, Math.floor(quantile * (ratios.length - 1)))]
}

export interface GapFill {
  /** The ratio used, so the caller can report and cache it. */
  ratio: number
  /** How many cells were filled with a guess. */
  estimatedCells: number
}

/**
 * Fill every unknown cell with a calibrated straight-line estimate, in place.
 *
 * The engine consumes a DENSE grid and always will — a sparse inner loop would
 * cost a branch on every arc evaluation to save memory that a phone has. So
 * "sparse" here describes what we FETCH, never what we solve on. The mask is
 * what remembers the difference.
 */
export function estimateGaps(
  matrix: Int32Array,
  known: Uint8Array,
  points: readonly LatLng[],
  objective: Objective,
): GapFill {
  const n = points.length
  const ratio = calibrateRatio(matrix, known, points, objective)

  let estimatedCells = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cell = i * n + j
      if (i === j) {
        matrix[cell] = 0
        setBit(known, cell)
        continue
      }
      if (getBit(known, cell)) continue
      matrix[cell] = Math.round(haversine(points[i], points[j]) * ratio)
      estimatedCells++
    }
  }
  return { ratio, estimatedCells }
}
