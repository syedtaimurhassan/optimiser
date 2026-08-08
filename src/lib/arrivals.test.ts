import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cumulativeArrivals, liveEta, serviceSecFor } from './arrivals.ts'
import { DEFAULT_SERVICE_SEC } from './stopSettings.ts'
import type { AddressedStop, OptimizedRoute, StopStatus } from '../types.ts'

const stop = (id: string, status: StopStatus = 'pending', serviceTimeSec?: number): AddressedStop => ({
  id,
  stopId: id.toUpperCase(),
  originalPosition: 1,
  lat: 0,
  lng: 0,
  kind: 'delivery',
  order: 'auto',
  status,
  statusHistory: [],
  serviceTimeSec,
})

/**
 * Start → a → b → c → end. Five ordered points, four legs of 600s, one minute
 * at each of the three stops.
 */
function fixture(statuses: [StopStatus, StopStatus, StopStatus]) {
  const stops = [stop('a', statuses[0]), stop('b', statuses[1]), stop('c', statuses[2])]
  const legSeconds = [600, 600, 600, 600]
  const serviceSeconds = [0, 60, 60, 60, 0]
  const optimized: Pick<OptimizedRoute, 'orderedStopIds' | 'arrivalSec'> & {
    legSeconds: number[]
    legMeters: number[]
  } = {
    orderedStopIds: [null, 'a', 'b', 'c', null],
    arrivalSec: cumulativeArrivals({ legSeconds, serviceSeconds }),
    legSeconds,
    legMeters: [1000, 1000, 1000, 1000],
  }
  return { stops, optimized }
}

test('arrivals accumulate the drive AND the time spent at each stop', () => {
  const arrivals = cumulativeArrivals({
    legSeconds: [600, 600, 600, 600],
    serviceSeconds: [0, 60, 60, 60, 0],
  })
  //          leave  →a          →b               →c                    →end
  assert.deepEqual(arrivals, [0, 600, 600 + 60 + 600, 1260 + 60 + 600, 1920 + 60 + 600])
})

test('an arrival array is one longer than the legs', () => {
  assert.equal(cumulativeArrivals({ legSeconds: [1, 2, 3], serviceSeconds: [0, 0, 0, 0] }).length, 4)
  assert.deepEqual(cumulativeArrivals({ legSeconds: [], serviceSeconds: [0] }), [0])
})

test('an unset service time is the documented default, not zero', () => {
  assert.equal(serviceSecFor(stop('a')), DEFAULT_SERVICE_SEC)
  assert.equal(serviceSecFor(stop('a', 'pending', 300)), 300)
})

const NOW = Date.parse('2026-08-08T12:00:00Z')

test('the NEXT pending stop is reached in the time the leg into it takes', () => {
  const { stops, optimized } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  // Nothing done yet: "a" is 600s of driving away, starting now.
  assert.equal(eta.byStopId.get('a'), NOW + 600_000)
})

test('…and it is NOT "you are there now"', () => {
  const { stops, optimized } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  assert.notEqual(eta.byStopId.get('a'), NOW)
})

test('later stops follow the plan from the anchor', () => {
  const { stops, optimized } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  // b is a minute at "a" plus another leg after it.
  assert.equal(eta.byStopId.get('b'), NOW + (600 + 60 + 600) * 1000)
})

test('a stop already handled gets NO eta — a time for a door you have left is noise', () => {
  const { stops, optimized } = fixture(['delivered', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  assert.equal(eta.byStopId.has('a'), false)
  assert.equal(eta.byStopId.get('b'), NOW + 600_000)
})

test('a FAILED stop counts as handled — the van has been there and left', () => {
  const { stops, optimized } = fixture(['failed', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  assert.equal(eta.byStopId.has('a'), false)
  assert.equal(eta.byStopId.get('b'), NOW + 600_000)
})

test('the service time already spent at the previous stop is not charged again', () => {
  const { stops, optimized } = fixture(['delivered', 'pending', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  // 600 of driving, not 660 — the minute at "a" is behind the driver.
  assert.equal(eta.byStopId.get('b'), NOW + 600_000)
})

test('the finish is the last ordered point, anchored to the same instant', () => {
  const { stops, optimized } = fixture(['delivered', 'delivered', 'pending'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  // 600s to "c", a minute there, 600s to the end.
  assert.equal(eta.finishMs, NOW + (600 + 60 + 600) * 1000)
})

test('a round with nothing left finishes as soon as the last leg is driven', () => {
  const { stops, optimized } = fixture(['delivered', 'delivered', 'delivered'])
  const eta = liveEta({ optimized, stops, nowMs: NOW })
  assert.equal(eta.byStopId.size, 0)
  assert.equal(eta.finishMs, NOW + 600_000)
})

test('metres left counts the leg into the next stop and everything after', () => {
  const { stops, optimized } = fixture(['delivered', 'pending', 'pending'])
  // legs into b, into c, into the end.
  assert.equal(liveEta({ optimized, stops, nowMs: NOW }).metresLeft, 3000)
})

test('a route solved before M7 has no arrivals, and says so rather than guessing', () => {
  const { stops } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({
    optimized: { orderedStopIds: [null, 'a', 'b', 'c', null], arrivalSec: [] },
    stops,
    nowMs: NOW,
  })
  assert.equal(eta.finishMs, null)
  assert.equal(eta.byStopId.size, 0)
})

test('a mismatched arrival array is refused rather than shifting every stop by one', () => {
  const { stops } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({
    optimized: { orderedStopIds: [null, 'a', 'b', 'c', null], arrivalSec: [0, 600, 1260] },
    stops,
    nowMs: NOW,
  })
  assert.equal(eta.finishMs, null)
})

test('a stop deleted since the solve is skipped rather than resurrected', () => {
  const { optimized } = fixture(['pending', 'pending', 'pending'])
  const eta = liveEta({
    optimized,
    stops: [stop('b'), stop('c')],
    nowMs: NOW,
  })
  assert.equal(eta.byStopId.has('a'), false)
  // "b" is now the next pending one, and is anchored as such.
  assert.equal(eta.byStopId.get('b'), NOW + 600_000)
})
