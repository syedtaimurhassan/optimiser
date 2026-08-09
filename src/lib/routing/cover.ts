/**
 * Covering a sparse pattern with rectangles.
 *
 * ── The problem, stated once ──────────────────────────────────────────────
 *
 * The local search only ever needs each stop's nearest neighbours, so we only
 * need O(n·K) of the n² arcs. But a matrix API cannot be asked for an arbitrary
 * set of pairs — it takes `sources × destinations`, a rectangle. So the real
 * question is not "which arcs do we need" but "which rectangles cover them,
 * given what this provider will accept in one request".
 *
 * ── Why the obvious answer is wrong ───────────────────────────────────────
 *
 * The obvious answer is to slice the Hilbert order into blocks and ask for each
 * block against itself. Measured on a real delivery-shaped instance, blocks of
 * 100 catch only **77.5%** of the arcs each stop actually needs, and blocks of
 * 50 catch 71.2% — the misses are all at block boundaries, where a stop's
 * nearest neighbour is three positions away on the curve but in the next block.
 * A cover that needs a repair pass for a quarter of its arcs is not a cover.
 *
 * So the block is built from the NEEDS rather than from the curve: walk the
 * Hilbert order, and grow a band whose destination set is the union of its
 * members' candidate lists. Every member's needs are covered by construction,
 * there is no repair pass, and the curve is used only for what it is good at —
 * putting stops with overlapping neighbourhoods next to each other, so the
 * union grows slowly.
 *
 * ── What it costs ─────────────────────────────────────────────────────────
 *
 * A band is |members| × |union| cells with |members| ≤ |union|, so a band never
 * exceeds |union|² and the union cap is √maxCells — 100 for OSRM. On a 300-stop
 * round that is ~4 requests against a dense fetch's 10, and the total cell count
 * stops being quadratic: it grows as n·(K + boundary), which is what makes a
 * thousand-stop route arithmetically possible at all.
 *
 * Pure module: no network, no I/O, no provider.
 */

import type { ProviderLimits } from './types.ts'

/**
 * Which columns each row needs. `need[i]` is the list of j for which the cost
 * i→j must be real. May be empty for a stop nothing needs to reach.
 */
export type NeedSet = readonly (readonly number[])[]

export interface CoverBand {
  sources: number[]
  destinations: number[]
}

export interface CoverPlan {
  bands: CoverBand[]
  /** Distinct (i,j) pairs the plan will learn. Includes ones nobody asked for. */
  cells: number
  /** Distinct (i,j) pairs that were actually needed. `cells` minus this is waste. */
  needed: number
}

/**
 * Plan the requests for a need set.
 *
 * `order` should be a spatially coherent ordering of the node indices — a
 * Hilbert order in practice. Correctness does not depend on it; only the number
 * of requests does, and badly.
 */
export function planCover(need: NeedSet, order: readonly number[], limits: ProviderLimits): CoverPlan {
  const bands: CoverBand[] = []

  /*
    ── Deferral, and why it is not just "flush and start again" ─────────────

    A row that will not fit the open band is NOT used to seed the next one. It
    is put back, and tried again on a later pass.

    That one choice is what batches the awkward rows together. The pinned start
    and end need a full row each; seeding a band with one of them produces a
    1×n request, and doing it twice produces two. Deferred, they meet each other
    on the last pass and share a single 2×n request instead — without this
    module ever learning what an endpoint is.

    Each pass emits at least one band containing at least one row, so the
    pending list strictly shrinks and this terminates.
  */
  let pending = order.filter((i) => (need[i]?.length ?? 0) > 0)

  while (pending.length > 0) {
    let members: number[] = []
    let union = new Set<number>()
    const deferred: number[] = []

    for (const i of pending) {
      const wants = need[i] as readonly number[]
      /*
        The union is the destinations we NEED, and deliberately does not include
        the sources themselves. Adding each member as a destination looks free —
        it buys the intra-band arcs for nothing — but it is what turns "forty
        stops all need one new column" into a forty-by-forty request. The
        arithmetic has to serve the smallest useful band, not the tidiest one.
      */
      const grown = new Set(union)
      for (const j of wants) grown.add(j)

      // The real constraint, not a square-root approximation of it. Sources are
      // a subset of the union, so a band is |members| × |union| cells and the
      // budget is spent on whichever shape actually fills it.
      const fits =
        (members.length + 1) * grown.size <= limits.maxCells && grown.size <= limits.maxPoints

      if (fits) {
        members.push(i)
        union = grown
        continue
      }

      // Nothing to share with: this row's own needs exceed a whole request. A
      // stop that must reach everywhere on a route bigger than the provider's
      // point cap. Emit it anyway — the service is the only thing that knows
      // how to split a band, and it will.
      if (members.length === 0) {
        members = [i]
        union = grown
        continue
      }

      deferred.push(i)
    }

    bands.push({ sources: members, destinations: [...union].sort((a, b) => a - b) })
    pending = deferred
  }

  const covered = new Set<string>()
  for (const b of bands) {
    for (const s of b.sources) for (const d of b.destinations) covered.add(`${s},${d}`)
  }
  const wanted = new Set<string>()
  for (let i = 0; i < need.length; i++) {
    for (const j of need[i] ?? []) wanted.add(`${i},${j}`)
  }

  return { bands, cells: covered.size, needed: wanted.size }
}

/**
 * The pairs a plan will NOT learn.
 *
 * Should always be empty — coverage is by construction — and exists so a test
 * can say so rather than trust the paragraph above. Cheap enough to call in a
 * test, too expensive to call in the app.
 */
export function uncovered(need: NeedSet, plan: CoverPlan): [number, number][] {
  const covered = new Set<string>()
  for (const b of plan.bands) {
    for (const s of b.sources) for (const d of b.destinations) covered.add(`${s},${d}`)
  }
  const missing: [number, number][] = []
  for (let i = 0; i < need.length; i++) {
    for (const j of need[i] ?? []) {
      if (!covered.has(`${i},${j}`)) missing.push([i, j])
    }
  }
  return missing
}
