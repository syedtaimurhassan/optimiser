import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, NewPendingChange, OptimizedRoute, PendingChange, Route } from '../types.ts'
import type { CostFn } from './costMatrix.ts'
import { END_KEY, START_KEY } from './costMatrix.ts'
import { buildProvisional, provisionalPoints } from './provisional.ts'

/**
 * Four stops on a line one unit apart, labelled the way a real round would be:
 * D7 is 37th, D8 is 38th, and so on. New stops sit at fractional positions so
 * the gap they belong in is never in doubt.
 */
const AT: Record<string, number> = {
  [START_KEY]: -1,
  [END_KEY]: 5,
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  n1: 1.5,
  n2: 1.6,
  far: 20,
}
const line: CostFn = (from, to) =>
  AT[from] === undefined || AT[to] === undefined ? null : Math.abs(AT[to] - AT[from]) * 60

function stop(id: string, stopId: string, originalPosition: number): AddressedStop {
  return {
    id,
    stopId,
    originalPosition,
    lat: 55.6 + AT[id] / 100,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
  }
}

const base = [stop('a', 'D6', 36), stop('b', 'D7', 37), stop('c', 'D8', 38), stop('d', 'D9', 39)]

const solved = (ids: (string | null)[]): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: ids,
  arrivalSec: [],
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 0,
  durationSeconds: 0,
  candidatesVisited: 0,
  candidatesTotal: 0,
})

let seq = 0
const change = (c: NewPendingChange): PendingChange =>
  ({ id: `c${++seq}`, at: seq, ...c }) as PendingChange

const addOf = (id: string, stopId = 'E1', originalPosition = 41) =>
  change({ kind: 'add', stopId: id, stop: stop(id, stopId, originalPosition) })

/** `stops` is the SETTLED round only — staged adds live in the change set. */
function route(changes: PendingChange[], patch: Partial<Route> = {}): Route {
  return {
    id: 'r1',
    name: 'Wednesday',
    dateISO: '2026-08-08',
    status: 'active',
    start: null,
    end: null,
    endpointMode: 'fixed',
    stops: base,
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    optimized: solved(base.map((s) => s.id)),
    pending: { changes },
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  }
}

const build = (r: Route) =>
  buildProvisional({ route: r, cost: line, durationSec: line, departSec: 8 * 3600 })

describe('provisionalPoints', () => {
  test('endpoints get their sentinels; stops get their uuids', () => {
    const r = route([addOf('n1')], { start: { lat: 1, lng: 1 }, end: { lat: 2, lng: 2 } })
    assert.deepEqual(provisionalPoints(r).map((p) => p.key), [
      START_KEY,
      'a',
      'b',
      'c',
      'd',
      'n1',
      END_KEY,
    ])
  })

  test('a stop staged for removal is not a point the plan runs over', () => {
    const r = route([change({ kind: 'remove', stopId: 'b' })])
    assert.deepEqual(provisionalPoints(r).map((p) => p.key), ['a', 'c', 'd'])
  })
})

describe('buildProvisional', () => {
  test('nothing staged has no preview', () => {
    assert.equal(build(route([])), null)
  })

  /**
   * The definition of done, in one assertion: every existing stop is exactly
   * where it was, and the new one is between the two it belongs between.
   */
  test('an added stop is inserted without moving anything else', () => {
    const result = build(route([addOf('n1')]))!
    assert.deepEqual(result.optimized.orderedStopIds, ['a', 'b', 'n1', 'c', 'd'])
  })

  test('two added stops both land, and neither displaces the round', () => {
    const result = build(route([addOf('n1'), addOf('n2', 'E2', 42)]))!
    assert.deepEqual(result.optimized.orderedStopIds, ['a', 'b', 'n1', 'n2', 'c', 'd'])
  })

  test('a removal splices out and the rest keep their order', () => {
    const result = build(route([change({ kind: 'remove', stopId: 'b' })]))!
    assert.deepEqual(result.optimized.orderedStopIds, ['a', 'c', 'd'])
  })

  test('endpoints are null entries, as they are on a real solve', () => {
    const r = route([addOf('n1')], { start: { lat: 1, lng: 1 }, end: { lat: 2, lng: 2 } })
    const result = build(r)!
    assert.equal(result.optimized.orderedStopIds[0], null)
    assert.equal(result.optimized.orderedStopIds.at(-1), null)
  })

  test('a move is honoured, and survives an insertion decided after it', () => {
    const r = route([addOf('n1'), change({ kind: 'move', stopId: 'd', toIndex: 0 })])
    assert.deepEqual(build(r)!.optimized.orderedStopIds, ['d', 'a', 'b', 'n1', 'c'])
  })

  test('arrivals are a real forward pass, and the preview says it is estimated', () => {
    const result = build(route([addOf('n1')]))!
    const { arrivalSec, legSeconds, estimated } = result.optimized
    assert.equal(estimated, true)
    assert.equal(arrivalSec.length, 5)
    assert.equal(arrivalSec[0], 0)
    // First leg is a→b: one unit, 60s. Plus a's default minute of service.
    assert.equal(arrivalSec[1], 60 + 60)
    assert.equal(legSeconds!.length, 4)
  })
})

describe('the labels an inserted stop earns', () => {
  /** Task 5, exactly: a stop inserted near D7 becomes D7.1. */
  test('a stop inserted after D7 becomes D7.1, and nothing else is renumbered', () => {
    const result = build(route([addOf('n1')]))!
    assert.equal(result.labels.n1.stopId, 'D7.1')
    // The four originals are untouched — they are not in the label map at all.
    assert.deepEqual(Object.keys(result.labels), ['n1'])
  })

  test('it inherits the position it was squeezed in beside', () => {
    assert.equal(build(route([addOf('n1')]))!.labels.n1.originalPosition, 37)
  })

  /**
   * Two adds beside each other must resolve left to right. The second anchors
   * off the label the first has just been given, not off the one it arrived
   * wearing — otherwise it takes a suffix off a provisional E1 that is about
   * to stop existing.
   */
  test('two stops inserted side by side become D7.1 and D7.2', () => {
    const result = build(route([addOf('n1'), addOf('n2', 'E2', 42)]))!
    assert.equal(result.labels.n1.stopId, 'D7.1')
    assert.equal(result.labels.n2.stopId, 'D7.2')
  })

  /**
   * A stop at the very end of the round has not been squeezed between
   * anything, so it continues the original numbering rather than taking a
   * decimal off the last stop.
   */
  test('a stop that lands last is an APPEND, and gets the next original number', () => {
    const result = build(route([addOf('far')]))!
    assert.deepEqual(result.optimized.orderedStopIds, ['a', 'b', 'c', 'd', 'far'])
    // The round's highest original position is 39, so the append is the 40th —
    // still inside the D block, which ends at D10. E1 starts at 41.
    assert.equal(result.labels.far.stopId, 'D10')
    assert.equal(result.labels.far.originalPosition, 40)
  })

  test('a stop that lands first takes its label from what it now precedes', () => {
    const head = { ...stop('n1', 'E1', 41), lat: 0, lng: 0 }
    const r = route([change({ kind: 'add', stopId: 'n1', stop: head })])
    // Force it to the head with an explicit move, so this tests the label rule
    // rather than the geometry.
    r.pending!.changes.push(change({ kind: 'move', stopId: 'n1', toIndex: 0 }))
    const result = build(r)!
    assert.equal(result.optimized.orderedStopIds[0], 'n1')
    assert.equal(result.labels.n1.stopId, 'D6.1')
  })
})
