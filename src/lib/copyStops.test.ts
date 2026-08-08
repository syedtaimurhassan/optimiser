import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import type { AddressedStop, Route, StopStatus } from '../types.ts'
import {
  buildCopyPayload,
  copySourceRoutes,
  copyableStops,
  describeSource,
  isUnfinished,
  toCopiedStop,
} from './copyStops.ts'

function stop(over: Partial<AddressedStop> & { id: string }): AddressedStop {
  return {
    stopId: over.stopId ?? 'A1',
    originalPosition: 1,
    lat: 55.7,
    lng: 12.4,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...over,
  }
}

function route(over: Partial<Route> & { id: string }): Route {
  return {
    name: 'Monday',
    dateISO: '2026-08-01',
    status: 'draft',
    start: null,
    end: null,
    endpointMode: 'open',
    stops: [],
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

describe('what crosses a route boundary', () => {
  const source = stop({
    id: 'u1',
    stopId: 'D7',
    originalPosition: 37,
    status: 'delivered',
    statusHistory: [{ status: 'delivered', atMs: 123 }],
    etaSec: 4200,
    recipient: 'Jette Kelbjørn',
    notes: 'back gate',
    accessCodes: '4471',
    packageFinder: 'back left, red crate',
    parcelCount: 2,
    address: { title: 'Løvfrøvej 6', subtitle: '2880 Bagsværd', source: 'geocoder' },
  })

  const copied = toCopiedStop(source)

  test('the place comes across', () => {
    assert.equal(copied.lat, 55.7)
    assert.equal(copied.lng, 12.4)
    assert.equal(copied.address?.title, 'Løvfrøvej 6')
  })

  test('what describes the door comes across — that is why anyone copies', () => {
    assert.equal(copied.recipient, 'Jette Kelbjørn')
    assert.equal(copied.notes, 'back gate')
    assert.equal(copied.accessCodes, '4471')
    assert.equal(copied.packageFinder, 'back left, red crate')
    assert.equal(copied.parcelCount, 2)
  })

  test('status and history do NOT — yesterday\'s delivery is not delivered today', () => {
    assert.equal('status' in copied, false)
    assert.equal('statusHistory' in copied, false)
    assert.equal('etaSec' in copied, false)
  })

  test('identity does NOT — the destination route allocates its own labels', () => {
    assert.equal('stopId' in copied, false)
    assert.equal('originalPosition' in copied, false)
    assert.equal('id' in copied, false)
    // The source uuid survives only so a checkbox list can key on it.
    assert.equal(copied.sourceId, 'u1')
  })
})

describe('filtering', () => {
  const statuses: StopStatus[] = ['pending', 'delivered', 'failed']
  const r = route({
    id: 'r1',
    status: 'completed',
    stops: statuses.map((status, i) => stop({ id: `u${i}`, status })),
  })

  test('"unfinished" means pending or failed — a route can run out of day', () => {
    assert.equal(isUnfinished(stop({ id: 'x', status: 'pending' })), true)
    assert.equal(isUnfinished(stop({ id: 'x', status: 'failed' })), true)
    assert.equal(isUnfinished(stop({ id: 'x', status: 'delivered' })), false)
  })

  test('the unfinished filter drops delivered stops', () => {
    const kept = copyableStops(r, 'unfinished').map((s) => s.status)
    assert.deepEqual(kept, ['pending', 'failed'])
  })

  test('"all" keeps everything, in route order', () => {
    assert.equal(copyableStops(r, 'all').length, 3)
  })
})

describe('buildCopyPayload', () => {
  const r = route({
    id: 'r1',
    stops: [
      stop({ id: 'a', status: 'delivered' }),
      stop({ id: 'b', status: 'failed' }),
      stop({ id: 'c', status: 'pending' }),
    ],
  })

  test('no selection means everything the filter allows', () => {
    assert.equal(buildCopyPayload(r).length, 3)
    assert.equal(buildCopyPayload(r, { filter: 'unfinished' }).length, 2)
  })

  test('a selection narrows it further', () => {
    const picked = buildCopyPayload(r, { selectedIds: ['a', 'c'] })
    assert.deepEqual(
      picked.map((s) => s.sourceId),
      ['a', 'c'],
    )
  })

  test('a selection and a filter intersect rather than either winning', () => {
    // "a" is delivered, so the unfinished filter excludes it even though it
    // was ticked. The filter is the harder constraint.
    const picked = buildCopyPayload(r, { filter: 'unfinished', selectedIds: ['a', 'b'] })
    assert.deepEqual(
      picked.map((s) => s.sourceId),
      ['b'],
    )
  })

  test('an empty selection copies nothing rather than everything', () => {
    assert.deepEqual(buildCopyPayload(r, { selectedIds: [] }), [])
  })
})

describe('choosing a source', () => {
  const routes: Route[] = [
    route({ id: 'old', dateISO: '2026-07-01', stops: [stop({ id: 'a' })] }),
    route({ id: 'new', dateISO: '2026-08-05', stops: [stop({ id: 'b' })] }),
    route({ id: 'empty', dateISO: '2026-08-06', stops: [] }),
    route({ id: 'self', dateISO: '2026-08-07', stops: [stop({ id: 'c' })] }),
  ]

  test('newest first — the useful answer is almost always the last round', () => {
    const sources = copySourceRoutes(routes, 'self')
    assert.deepEqual(
      sources.map((r) => r.id),
      ['new', 'old'],
    )
  })

  test('empty routes are not offered — copying from one is a dead end', () => {
    assert.ok(!copySourceRoutes(routes).some((r) => r.id === 'empty'))
  })

  test('the route being copied INTO is excluded', () => {
    assert.ok(!copySourceRoutes(routes, 'self').some((r) => r.id === 'self'))
  })
})

describe('describeSource', () => {
  test('a completed route with leftovers says how many', () => {
    const r = route({
      id: 'r',
      status: 'completed',
      stops: [
        stop({ id: 'a', status: 'delivered' }),
        stop({ id: 'b', status: 'failed' }),
        stop({ id: 'c', status: 'pending' }),
      ],
    })
    assert.equal(describeSource(r), '3 stops · 2 unfinished')
  })

  test('a draft route does not — every stop is pending and saying so is noise', () => {
    const r = route({ id: 'r', stops: [stop({ id: 'a' }), stop({ id: 'b' })] })
    assert.equal(describeSource(r), '2 stops')
  })

  test('singular reads correctly', () => {
    assert.equal(describeSource(route({ id: 'r', stops: [stop({ id: 'a' })] })), '1 stop')
  })
})
