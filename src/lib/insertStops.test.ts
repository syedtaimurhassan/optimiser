import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { CostFn } from './costMatrix.ts'
import {
  applyMove,
  arrivalsAlong,
  cheapestInsertion,
  insertAll,
  insertionCost,
  type InsertContext,
  type StopTiming,
} from './insertStops.ts'

/**
 * Four stops on a line, one unit apart: A(0) B(1) C(2) D(3). A fifth point X
 * sits at 1.5 — between B and C — so the cheapest gap is unambiguous and a
 * wrong answer cannot look right by luck.
 */
const AT: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, X: 1.5, Y: 10, S: -1, E: 4 }
const line: CostFn = (from, to) =>
  AT[from] === undefined || AT[to] === undefined ? null : Math.abs(AT[to] - AT[from]) * 60

const noTiming = (): StopTiming => ({ serviceSec: 0 })

function ctx(patch: Partial<InsertContext> = {}): InsertContext {
  return {
    sequence: ['A', 'B', 'C', 'D'],
    cost: line,
    durationSec: line,
    timing: noTiming,
    pinnedFirst: false,
    pinnedLast: false,
    departSec: 8 * 3600,
    ...patch,
  }
}

describe('insertionCost', () => {
  test('is the DETOUR, not the two new legs', () => {
    // B→X→C is 30 + 30 where B→C was 60, so the detour costs nothing at all.
    assert.equal(insertionCost(line, 'B', 'C', 'X'), 0)
    // A→X→B is 90 + 30 where A→B was 60: a 60-second detour.
    assert.equal(insertionCost(line, 'A', 'B', 'X'), 60)
  })

  /**
   * At an open end there is no displaced leg to subtract. Subtracting one that
   * does not exist would make an open end cost nothing and win every gap.
   */
  test('an open end is priced as one leg, not as a detour', () => {
    assert.equal(insertionCost(line, undefined, 'A', 'X'), 90)
    assert.equal(insertionCost(line, 'D', undefined, 'X'), 90)
  })

  test('an unpriceable pair is null, never zero', () => {
    assert.equal(insertionCost(line, 'A', 'B', 'unknown'), null)
  })
})

describe('cheapestInsertion', () => {
  test('finds the gap the geometry says it should', () => {
    assert.equal(cheapestInsertion(ctx(), 'X').index, 2)
  })

  test('a far-away stop goes on an open end rather than into the middle', () => {
    // Y is at 10, past D. Appending costs one leg; splicing it inside costs a
    // there-and-back detour.
    assert.equal(cheapestInsertion(ctx(), 'Y').index, 4)
  })

  /** Ties go to the earlier gap: same driving either way, parcel out sooner. */
  test('ties go to the earlier gap', () => {
    const flat: CostFn = () => 100
    assert.equal(cheapestInsertion(ctx({ cost: flat, durationSec: flat }), 'X').index, 0)
  })

  test('a pinned start and end are never displaced', () => {
    const pinned = ctx({
      sequence: ['S', 'A', 'B', 'C', 'D', 'E'],
      pinnedFirst: true,
      pinnedLast: true,
    })
    // S is at -1 and E at 4, so an unpinned run would happily put Y (at 10)
    // after E. Index 5 is the gap immediately before E, which is as late as
    // this route allows.
    assert.equal(cheapestInsertion(pinned, 'Y').index, 5)
  })
})

describe('arrivalsAlong and feasibility', () => {
  const service = (key: string): StopTiming => ({ serviceSec: key === 'B' ? 600 : 60 })

  test('service time at each stop pushes everything downstream out', () => {
    const { arrivalSec } = arrivalsAlong(ctx({ timing: service }), ['A', 'B', 'C'])
    // 08:00 at A, +60s service +60s drive → B, +600s service +60s drive → C.
    assert.deepEqual(arrivalSec, [28800, 28920, 29580])
  })

  /** Early is not late. The driver waits, and the wait propagates. */
  test('arriving before a window opens waits rather than failing', () => {
    const windowed = (key: string): StopTiming =>
      key === 'B' ? { serviceSec: 0, twOpenSec: 10 * 3600 } : { serviceSec: 0 }
    const { arrivalSec, feasible } = arrivalsAlong(ctx({ timing: windowed }), ['A', 'B', 'C'])
    assert.equal(feasible, true)
    assert.equal(arrivalSec[1], 10 * 3600)
    // The wait pushes C out too — it is not reached at its unwaited time.
    assert.equal(arrivalSec[2], 10 * 3600 + 60)
  })

  test('arriving after a window closes is infeasible — no waiting fixes late', () => {
    const windowed = (key: string): StopTiming =>
      key === 'C' ? { serviceSec: 0, twCloseSec: 7 * 3600 } : { serviceSec: 0 }
    assert.equal(arrivalsAlong(ctx({ timing: windowed }), ['A', 'B', 'C']).feasible, false)
  })

  test('the cheapest gap is skipped when it breaks a window', () => {
    /*
      X sits exactly between B and C, so gap 2 is a free detour and would win
      on cost alone. But X takes ten minutes at the door, and D closes at
      08:03:20 — so every gap ahead of D pushes D past its window and the only
      feasible placement is after it, at nearly five times the cost.
    */
    const windowed = (key: string): StopTiming => {
      if (key === 'X') return { serviceSec: 600 }
      if (key === 'D') return { serviceSec: 0, twCloseSec: 8 * 3600 + 200 }
      return { serviceSec: 0 }
    }
    const insertion = cheapestInsertion(ctx({ timing: windowed }), 'X')
    assert.equal(insertion.feasible, true)
    assert.equal(insertion.index, 4)
    assert.equal(insertion.cost, 90)
  })

  /**
   * A parcel with nowhere to go is worse than a route that admits one window
   * will be missed. It is placed, and the result says so out loud.
   */
  test('when no gap is feasible the stop is still placed, and flagged', () => {
    const impossible = (): StopTiming => ({ serviceSec: 0, twCloseSec: 0 })
    const insertion = cheapestInsertion(ctx({ timing: impossible }), 'X')
    assert.equal(insertion.feasible, false)
    assert.ok(insertion.index >= 0)
  })
})

describe('insertAll', () => {
  /**
   * The reason this is sequential. Pricing both against the ORIGINAL sequence
   * lets two stops claim the same gap, each charged as though the other were
   * not there.
   */
  test('each stop is priced against the sequence as it now stands', () => {
    const result = insertAll(ctx(), ['X', 'Y'])
    assert.deepEqual(result.sequence, ['A', 'B', 'X', 'C', 'D', 'Y'])
    assert.equal(result.placedAt.X, 2)
  })

  test('nothing to insert leaves the sequence untouched', () => {
    assert.deepEqual(insertAll(ctx(), []).sequence, ['A', 'B', 'C', 'D'])
  })

  test('one infeasible placement makes the whole result infeasible', () => {
    const impossible = (): StopTiming => ({ serviceSec: 0, twCloseSec: 0 })
    assert.equal(insertAll(ctx({ timing: impossible }), ['X']).feasible, false)
  })
})

describe('applyMove', () => {
  test('a move is a remove plus an insert at the pinned position', () => {
    assert.deepEqual(applyMove(['A', 'B', 'C', 'D'], 'D', 0, false, false), ['D', 'A', 'B', 'C'])
  })

  test('positions are counted among the STOPS, past a pinned start', () => {
    assert.deepEqual(applyMove(['S', 'A', 'B', 'C'], 'C', 0, true, false), ['S', 'C', 'A', 'B'])
  })

  test('a pinned end cannot be overtaken', () => {
    assert.deepEqual(applyMove(['A', 'B', 'E'], 'A', 9, false, true), ['B', 'A', 'E'])
  })

  test('a key that is not in the sequence changes nothing', () => {
    assert.deepEqual(applyMove(['A', 'B'], 'Z', 0, false, false), ['A', 'B'])
  })
})
