import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, OptimizedRoute, StopStatus } from '../types.ts'
import { clockAt, formatKm, formatRemainingSummary, remainingRoute } from './routeSummary.ts'

function stop(id: string, status: StopStatus = 'pending'): AddressedStop {
  return {
    id,
    stopId: id.toUpperCase(),
    originalPosition: 1,
    lat: 55.6,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status,
    statusHistory: [],
  }
}

const solve = (patch: Partial<OptimizedRoute> = {}): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: [],
  arrivalSec: [],
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 10_000,
  durationSeconds: 3600,
  candidatesVisited: 0,
  candidatesTotal: 0,
  ...patch,
})

/** A fixed local noon, so the expected clock strings are not timezone-dependent. */
const NOON = new Date(2026, 7, 8, 12, 0, 0).getTime()

describe('remainingRoute', () => {
  test('counts only pending stops — a failure is finished with', () => {
    const stops = [stop('a'), stop('b', 'delivered'), stop('c', 'failed')]
    assert.equal(remainingRoute({ stops, optimized: solve(), nowMs: NOON }).stopsLeft, 1)
  })

  test('scales the solved total by the share still pending', () => {
    const stops = [stop('a'), stop('b'), stop('c'), stop('d')]
    stops[0].status = 'delivered'
    stops[1].status = 'delivered'
    const out = remainingRoute({ stops, optimized: solve(), nowMs: NOON })
    // Half the stops left → half the distance and half the hour.
    assert.equal(out.metresLeft, 5000)
    assert.equal(out.finishClock, '12:30')
  })

  test('a finished route finishes now', () => {
    const stops = [stop('a', 'delivered'), stop('b', 'failed')]
    const out = remainingRoute({ stops, optimized: solve(), nowMs: NOON })
    assert.equal(out.stopsLeft, 0)
    assert.equal(out.metresLeft, 0)
    assert.equal(out.finishClock, '12:00')
  })

  test('an unsolved route reports no finish time and no distance, but still counts stops', () => {
    const out = remainingRoute({ stops: [stop('a')], optimized: undefined, nowMs: NOON })
    assert.equal(out.finishClock, null)
    assert.equal(out.metresLeft, null)
    assert.equal(out.stopsLeft, 1)
  })

  /**
   * A solve carrying NaN or Infinity must read as unsolved rather than
   * rendering "Finish NaN:NaN". The pipeline's haversine fallback is one bad
   * coordinate away from producing exactly that.
   */
  test('a non-finite solve is treated as no solve', () => {
    const out = remainingRoute({
      stops: [stop('a')],
      optimized: solve({ durationSeconds: Number.NaN }),
      nowMs: NOON,
    })
    assert.equal(out.finishClock, null)
  })

  test('a solved route with no stops has all of itself left, not none', () => {
    const out = remainingRoute({ stops: [], optimized: solve(), nowMs: NOON })
    assert.equal(out.metresLeft, 10_000)
    assert.equal(out.finishClock, '13:00')
  })

  test('carries the estimated flag through, so the UI can hedge', () => {
    const out = remainingRoute({
      stops: [stop('a')],
      optimized: solve({ estimated: true }),
      nowMs: NOON,
    })
    assert.equal(out.estimated, true)
  })
})

describe('clockAt', () => {
  test('zero-pads to 24-hour local time', () => {
    assert.equal(clockAt(new Date(2026, 7, 8, 9, 5).getTime()), '09:05')
    assert.equal(clockAt(new Date(2026, 7, 8, 17, 7).getTime()), '17:07')
  })

  test('a finish time past midnight shows the wall clock, not 25:00', () => {
    assert.equal(clockAt(new Date(2026, 7, 9, 0, 30).getTime()), '00:30')
  })
})

describe('formatKm', () => {
  test('keeps one decimal under 10 km, where rounding to zero would look broken', () => {
    assert.equal(formatKm(400), '0.4 km')
    assert.equal(formatKm(7300), '7.3 km')
  })

  test('drops the decimal above 10 km, where it is noise', () => {
    assert.equal(formatKm(11_400), '11 km')
  })

  test('nothing to say about an unsolved route', () => {
    assert.equal(formatKm(null), null)
    assert.equal(formatKm(Number.NaN), null)
  })
})

describe('formatRemainingSummary', () => {
  test('three facts, bullet-separated', () => {
    const stops = [stop('a'), stop('b')]
    const out = formatRemainingSummary(remainingRoute({ stops, optimized: solve(), nowMs: NOON }))
    assert.equal(out, 'Finish 13:00 · 2 stops · 10 km')
  })

  test('drops the finish and the distance on an unsolved route', () => {
    const out = formatRemainingSummary(
      remainingRoute({ stops: [stop('a')], optimized: undefined, nowMs: NOON }),
    )
    assert.equal(out, '1 stop')
  })
})
