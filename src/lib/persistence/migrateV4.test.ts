import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { migrateSessionToV4, migrateStop, type LegacySessionV3 } from './migrateV4.ts'

let counter = 0
const makeId = () => `id-${++counter}`
const NOW = 1_700_000_000_000

const opts = () => ({
  routeId: 'route-1',
  dateISO: '2026-08-07',
  nowMs: NOW,
  makeId,
  name: 'Imported session',
})

/** A realistic v2/v3 payload. */
const SESSION: LegacySessionV3 = {
  startLocation: { lat: 55.6761, lng: 12.5683 },
  endLocation: { lat: 55.6867, lng: 12.5701 },
  waypoints: [
    { id: 'a1', num: 1, lat: 55.6801, lng: 12.5903, delivered: false },
    { id: 'a2', num: 2, lat: 55.68139, lng: 12.5757, delivered: true },
    { id: 'a3', num: 37, lat: 55.6789, lng: 12.5984, delivered: false },
  ],
  targetK: 2,
  objective: 'duration',
  optimizedRoute: null,
  favorites: [{ id: 'f1', name: 'Monday loop', startLocation: null, endLocation: null, waypoints: [] }],
  routeMode: 'fixed',
  searchQuality: 'deep',
}

describe('migrateStop', () => {
  test('synthesises the stop id from num through the block allocator', () => {
    const s = migrateStop({ num: 37, lat: 1, lng: 2 }, 99, 'letterBlock', NOW, makeId)
    assert.equal(s.stopId, 'D7')
    assert.equal(s.originalPosition, 37)
  })

  test('delivered becomes a status with a history entry, so undo works', () => {
    const s = migrateStop({ num: 1, lat: 1, lng: 2, delivered: true }, 1, 'letterBlock', NOW, makeId)
    assert.equal(s.status, 'delivered')
    assert.deepEqual(s.statusHistory, [{ status: 'delivered', atMs: NOW }])
  })

  test('undelivered stops start pending with empty history', () => {
    const s = migrateStop({ num: 1, lat: 1, lng: 2 }, 1, 'letterBlock', NOW, makeId)
    assert.equal(s.status, 'pending')
    assert.deepEqual(s.statusHistory, [])
  })

  test('address stays undefined — geocoding is M6', () => {
    assert.equal(migrateStop({ num: 1, lat: 1, lng: 2 }, 1, 'letterBlock', NOW, makeId).address, undefined)
  })

  test('preserves the existing internal id so nothing else breaks', () => {
    assert.equal(migrateStop({ id: 'keep-me', num: 1, lat: 1, lng: 2 }, 1, 'letterBlock', NOW, makeId).id, 'keep-me')
  })

  test('falls back to list position when num is missing or nonsense', () => {
    assert.equal(migrateStop({ lat: 1, lng: 2 }, 5, 'letterBlock', NOW, makeId).originalPosition, 5)
    assert.equal(migrateStop({ num: 0, lat: 1, lng: 2 }, 5, 'letterBlock', NOW, makeId).originalPosition, 5)
    assert.equal(migrateStop({ num: -2, lat: 1, lng: 2 }, 5, 'letterBlock', NOW, makeId).originalPosition, 5)
  })

  test('defaults kind and order', () => {
    const s = migrateStop({ num: 1, lat: 1, lng: 2 }, 1, 'letterBlock', NOW, makeId)
    assert.equal(s.kind, 'delivery')
    assert.equal(s.order, 'auto')
  })
})

describe('migrateSessionToV4', () => {
  test('produces exactly one route, active', () => {
    const out = migrateSessionToV4(SESSION, opts())
    assert.equal(Object.keys(out.routes).length, 1)
    assert.equal(out.activeRouteId, 'route-1')
    assert.equal(out.routes['route-1'].status, 'active')
  })

  test('carries every stop across with no loss', () => {
    const route = migrateSessionToV4(SESSION, opts()).routes['route-1']
    assert.equal(route.stops.length, 3)
    assert.deepEqual(route.stops.map((s) => s.stopId), ['A1', 'A2', 'D7'])
    assert.deepEqual(route.stops.map((s) => s.originalPosition), [1, 2, 37])
    assert.deepEqual(route.stops.map((s) => s.status), ['pending', 'delivered', 'pending'])
  })

  test('carries endpoints and settings', () => {
    const route = migrateSessionToV4(SESSION, opts()).routes['route-1']
    assert.deepEqual(route.start, { lat: 55.6761, lng: 12.5683 })
    assert.deepEqual(route.end, { lat: 55.6867, lng: 12.5701 })
    assert.equal(route.endpointMode, 'fixed')
    assert.equal(route.optimizeBy, 'duration')
    assert.equal(route.targetK, 2)
    assert.equal(route.searchTierSec, 3)
  })

  test('maps the old search-quality names to seconds', () => {
    const tier = (q: string) =>
      migrateSessionToV4({ ...SESSION, searchQuality: q }, opts()).routes['route-1'].searchTierSec
    assert.equal(tier('fast'), 1)
    assert.equal(tier('deep'), 3)
    assert.equal(tier('maximum'), 5)
    assert.equal(tier('nonsense'), 3) // unknown falls back to the default tier
  })

  test('an open route clears both endpoints', () => {
    const route = migrateSessionToV4({ ...SESSION, routeMode: 'open' }, opts()).routes['route-1']
    assert.equal(route.endpointMode, 'open')
    assert.equal(route.start, null)
    assert.equal(route.end, null)
  })

  test('carries favorites', () => {
    const out = migrateSessionToV4(SESSION, opts())
    assert.equal(out.favorites.length, 1)
    assert.equal(out.favorites[0].name, 'Monday loop')
  })

  test('distance objective survives', () => {
    assert.equal(
      migrateSessionToV4({ ...SESSION, objective: 'distance' }, opts()).routes['route-1'].optimizeBy,
      'distance',
    )
  })
})

describe('migrateSessionToV4 — malformed input never throws', () => {
  const cases: Array<[string, LegacySessionV3]> = [
    ['empty object', {}],
    ['waypoints not an array', { waypoints: 'nope' as unknown as [] }],
    ['null endpoints', { startLocation: null, endLocation: null }],
    ['garbage endpoints', { startLocation: { lat: 'x' } as unknown as null }],
    ['stops missing coordinates', { waypoints: [{ num: 1 } as unknown as { lat: number; lng: number }] }],
    ['favorites not an array', { favorites: 'nope' as unknown as [] }],
    ['favorite without an id', { favorites: [{ name: 'x' }] }],
    ['NaN targetK', { targetK: Number.NaN }],
  ]

  for (const [name, session] of cases) {
    test(name, () => {
      const out = migrateSessionToV4(session, opts())
      assert.equal(Object.keys(out.routes).length, 1)
      assert.ok(Array.isArray(out.routes['route-1'].stops))
      assert.ok(Array.isArray(out.favorites))
    })
  }

  test('drops coordinate-less stops rather than importing junk', () => {
    const out = migrateSessionToV4(
      { waypoints: [{ num: 1, lat: 1, lng: 2 }, { num: 2 } as unknown as { lat: number; lng: number }] },
      opts(),
    )
    assert.equal(out.routes['route-1'].stops.length, 1)
  })

  test('NaN targetK becomes null, not NaN', () => {
    assert.equal(migrateSessionToV4({ targetK: Number.NaN }, opts()).routes['route-1'].targetK, null)
  })
})

describe('migrateSessionToV4 — idempotence of the shape', () => {
  test('running twice on the same input yields identical stop identities', () => {
    const a = migrateSessionToV4(SESSION, opts()).routes['route-1']
    const b = migrateSessionToV4(SESSION, opts()).routes['route-1']
    assert.deepEqual(
      a.stops.map((s) => [s.stopId, s.originalPosition, s.status]),
      b.stops.map((s) => [s.stopId, s.originalPosition, s.status]),
    )
  })
})

describe('migrateSessionToV4 — optimised route', () => {
  test('reconstructs orderedStopIds by coordinate lookup', () => {
    const out = migrateSessionToV4(
      {
        ...SESSION,
        optimizedRoute: {
          orderedWaypoints: [
            { lat: 55.6801, lng: 12.5903 },
            { lat: 55.6789, lng: 12.5984 },
          ],
          geometry: { type: 'LineString', coordinates: [] },
          distanceMeters: 100,
          durationSeconds: 60,
          candidatesVisited: 2,
          candidatesTotal: 3,
        },
      },
      opts(),
    )
    const route = out.routes['route-1']
    assert.ok(route.optimized)
    assert.equal(route.optimized.orderedStopIds.length, 2)
    // Both coordinates match real stops, so neither resolves to null.
    assert.ok(route.optimized.orderedStopIds.every((id) => id !== null))
    assert.deepEqual(route.optimized.arrivalSec, [])
  })

  test('a coordinate with no matching stop resolves to null, not a wrong stop', () => {
    const out = migrateSessionToV4(
      {
        ...SESSION,
        optimizedRoute: {
          orderedWaypoints: [{ lat: 0, lng: 0 }],
          geometry: { type: 'LineString', coordinates: [] },
          distanceMeters: 0,
          durationSeconds: 0,
          candidatesVisited: 0,
          candidatesTotal: 0,
        },
      },
      opts(),
    )
    assert.deepEqual(out.routes['route-1'].optimized?.orderedStopIds, [null])
  })

  test('an unusable optimised route is dropped rather than half-migrated', () => {
    assert.equal(migrateSessionToV4({ ...SESSION, optimizedRoute: {} }, opts()).routes['route-1'].optimized, undefined)
    assert.equal(migrateSessionToV4({ ...SESSION, optimizedRoute: null }, opts()).routes['route-1'].optimized, undefined)
  })
})
