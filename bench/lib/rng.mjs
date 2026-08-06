/**
 * Deterministic PRNG (mulberry32) — the same generator the production solver
 * uses for GRASP restarts. Every benchmark instance is derived from a seed, so
 * a run is byte-for-byte reproducible across machines and across engines.
 */
export function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [lo, hi). */
export const uniform = (rng, lo, hi) => lo + rng() * (hi - lo)

/** Box–Muller normal deviate, mean 0, stddev 1. */
export function normal(rng) {
  let u = 0
  while (u === 0) u = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}
