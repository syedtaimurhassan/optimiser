import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, OptimizedRoute } from '../types.ts'
import { solvedOrder, visitOrder } from './routeOrder.ts'

function stop(id: string, patch: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id,
    stopId: id.toUpperCase(),
    originalPosition: 1,
    lat: 55.6,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...patch,
  }
}

/** An optimisation visiting `ids` in order, between two endpoints that are not stops. */
const solved = (ids: (string | null)[]): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: [null, ...ids, null],
  arrivalSec: [],
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 0,
  durationSeconds: 0,
  candidatesVisited: ids.length,
  candidatesTotal: ids.length,
})

const ids = (stops: AddressedStop[]) => stops.map((s) => s.id)

describe('solvedOrder', () => {
  test('returns the stops in the order the solve visits them', () => {
    const stops = [stop('a'), stop('b'), stop('c')]
    assert.deepEqual(ids(solvedOrder({ stops, optimized: solved(['c', 'a', 'b']) })), [
      'c',
      'a',
      'b',
    ])
  })

  test('an unsolved route has no solved order — empty, not entry order', () => {
    assert.deepEqual(solvedOrder({ stops: [stop('a')], optimized: undefined }), [])
  })

  test('drops the null endpoints, which are not stops', () => {
    const stops = [stop('a')]
    assert.equal(solvedOrder({ stops, optimized: solved(['a']) }).length, 1)
  })

  test('a stop deleted since the solve does not resurrect', () => {
    const stops = [stop('a'), stop('c')]
    assert.deepEqual(ids(solvedOrder({ stops, optimized: solved(['a', 'b', 'c']) })), ['a', 'c'])
  })
})

describe('visitOrder', () => {
  test('prefers the solved order', () => {
    const stops = [stop('a'), stop('b')]
    assert.deepEqual(ids(visitOrder({ stops, optimized: solved(['b', 'a']) })), ['b', 'a'])
  })

  test('falls back to entry order when nothing has been solved', () => {
    const stops = [stop('a'), stop('b')]
    assert.deepEqual(ids(visitOrder({ stops, optimized: undefined })), ['a', 'b'])
  })

  /**
   * The case that makes the fallback a rule rather than a convenience: a solve
   * whose every stop has since been deleted leaves an EMPTY solved order, and
   * falling through to entry order is what stops the itinerary rendering blank
   * on a route that plainly has stops in it.
   */
  test('falls back when the solve survives but none of its stops do', () => {
    const stops = [stop('x'), stop('y')]
    assert.deepEqual(ids(visitOrder({ stops, optimized: solved(['a', 'b']) })), ['x', 'y'])
  })

  test('an empty route is empty either way', () => {
    assert.deepEqual(visitOrder({ stops: [], optimized: undefined }), [])
  })
})
