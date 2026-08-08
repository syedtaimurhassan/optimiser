import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, OptimizedRoute, Route } from '../types.ts'
import {
  breakLabel,
  buildRouteRows,
  colorNameFor,
  formatSeq,
  nextStopRowIndex,
  startSubtitle,
  tagsFor,
  titleFor,
  type StopRowModel,
} from './routeList.ts'

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
    address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    ...patch,
  }
}

function route(patch: Partial<Route> = {}): Route {
  return {
    id: 'r1',
    name: 'Friday',
    dateISO: '2026-08-08',
    status: 'active',
    start: { lat: 55.67, lng: 12.56 },
    end: { lat: 55.69, lng: 12.57 },
    endpointMode: 'fixed',
    stops: [],
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  }
}

const solved = (ids: (string | null)[], arrivalSec: number[] = []): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: ids,
  arrivalSec,
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 0,
  durationSeconds: 0,
  candidatesVisited: 0,
  candidatesTotal: 0,
})

const stopRows = (rows: ReturnType<typeof buildRouteRows>): StopRowModel[] =>
  rows.filter((r): r is StopRowModel => r.kind === 'stop')

describe('the row sequence', () => {
  test('header, break, start, stops, end, footer — in that order', () => {
    const rows = buildRouteRows({ route: route({ stops: [stop('a'), stop('b')] }) })
    assert.deepEqual(rows.map((r) => r.kind), [
      'header',
      'break',
      'start',
      'stop',
      'stop',
      'end',
      'footer',
    ])
  })

  /**
   * The break is a ROUTE-level property — a constraint on the day, not a thing
   * that happens at a stop — so it sits above the start location. Putting it
   * among the stops would imply the driver takes it at one of them.
   */
  test('the break row sits above the start location', () => {
    const rows = buildRouteRows({ route: route({ stops: [stop('a')] }) })
    assert.ok(rows.findIndex((r) => r.kind === 'break') < rows.findIndex((r) => r.kind === 'start'))
  })

  test('an empty route still renders its frame, so the sheet is never blank', () => {
    const rows = buildRouteRows({ route: route() })
    assert.deepEqual(rows.map((r) => r.kind), ['header', 'break', 'start', 'end', 'footer'])
  })

  test('rows follow the solved order, not entry order', () => {
    const stops = [stop('a'), stop('b'), stop('c')]
    const rows = buildRouteRows({
      route: route({ stops, optimized: solved([null, 'c', 'a', 'b', null]) }),
    })
    assert.deepEqual(stopRows(rows).map((r) => r.id), ['c', 'a', 'b'])
  })

  test('the header carries the route name', () => {
    const rows = buildRouteRows({ route: route({ name: 'Thursday' }) })
    assert.equal(rows[0].kind === 'header' && rows[0].title, 'Thursday')
  })
})

describe('the gutter sequence', () => {
  test('zero-padded to the width of the largest position', () => {
    assert.equal(formatSeq(1, 44), '01')
    assert.equal(formatSeq(44, 44), '44')
    assert.equal(formatSeq(7, 300), '007')
    assert.equal(formatSeq(1, 9), '1')
  })

  test('numbers the route position, never the immutable stop label', () => {
    const stops = [stop('a', { stopId: 'D7' }), stop('b', { stopId: 'D3' })]
    const rows = stopRows(buildRouteRows({ route: route({ stops }) }))
    assert.deepEqual(rows.map((r) => r.seq), ['1', '2'])
    assert.deepEqual(rows.map((r) => r.stop.stopId), ['D7', 'D3'])
  })
})

describe('ETAs', () => {
  test('there is none until the pipeline produces arrivals', () => {
    const rows = stopRows(buildRouteRows({ route: route({ stops: [stop('a')] }) }))
    assert.equal(rows[0].eta, null)
  })

  /**
   * `arrivalSec` is positional against `orderedStopIds` INCLUDING its nulls.
   * Zipping it against the filtered stop list instead would shift every
   * arrival by the number of endpoints and hand each stop its neighbour's
   * time — a bug that looks like a plausible ETA, which is the worst kind.
   */
  test('arrivals are joined by index across the endpoint nulls', () => {
    const stops = [stop('a'), stop('b')]
    const rows = stopRows(
      buildRouteRows({
        route: route({
          stops,
          optimized: solved([null, 'a', 'b', null], [0, 9 * 3600, 9.5 * 3600, 10 * 3600]),
        }),
      }),
    )
    assert.deepEqual(rows.map((r) => r.eta), ['09:00', '09:30'])
  })
})

describe('inline tags — quiet until something needs attention', () => {
  test('an ordinary delivery earns none', () => {
    assert.deepEqual(tagsFor(stop('a')), [])
  })

  test('a forced position and a pickup each earn one', () => {
    assert.deepEqual(tagsFor(stop('a', { order: 'first' })), ['first'])
    assert.deepEqual(tagsFor(stop('a', { order: 'last' })), ['last'])
    assert.deepEqual(tagsFor(stop('a', { kind: 'pickup' })), ['pickup'])
  })

  test('both at once, order first', () => {
    assert.deepEqual(tagsFor(stop('a', { order: 'first', kind: 'pickup' })), ['first', 'pickup'])
  })

  test('a route of ordinary stops produces no tags at all', () => {
    const rows = stopRows(buildRouteRows({ route: route({ stops: [stop('a'), stop('b')] }) }))
    assert.ok(rows.every((r) => r.tags.length === 0))
  })
})

describe('titles and notes', () => {
  test('a recipient is appended to the address, on the same line', () => {
    assert.equal(
      titleFor(
        stop('a', {
          address: { title: 'Rundgården 34, st. th.', subtitle: '', source: 'geocoder' },
          recipient: 'Jette Kelbjørn',
        }),
      ),
      'Rundgården 34, st. th. Jette Kelbjørn',
    )
  })

  test('a coordinate-only stop shows coordinates rather than a blank row', () => {
    assert.equal(titleFor(stop('a', { address: undefined })), '55.60000, 12.50000')
  })

  test('a blank note is no note, not an empty line', () => {
    const rows = stopRows(
      buildRouteRows({ route: route({ stops: [stop('a', { notes: '   ' }), stop('b', { notes: 'mazda' })] }) }),
    )
    assert.equal(rows[0].note, null)
    assert.equal(rows[1].note, 'mazda')
  })
})

describe('group colour', () => {
  const groups = [{ id: 'g1', name: 'Green run', colorHex: '#12823c' }]

  test('resolves the palette name for the pastel chip', () => {
    assert.equal(colorNameFor(stop('a', { groupId: 'g1' }), groups), 'green')
  })

  test('no group means the default group, which is blue', () => {
    assert.equal(colorNameFor(stop('a'), groups), 'blue')
  })

  test('a deleted group or an off-palette colour falls back rather than rendering unstyled', () => {
    assert.equal(colorNameFor(stop('a', { groupId: 'gone' }), groups), 'blue')
    assert.equal(
      colorNameFor(stop('a', { groupId: 'g2' }), [{ id: 'g2', name: 'x', colorHex: '#abc123' }]),
      'blue',
    )
  })
})

describe('the break row', () => {
  test('offers to plan one when there is none', () => {
    const { label, planned } = breakLabel([])
    assert.match(label, /No break/)
    assert.equal(planned, false)
  })

  test('states the planned total', () => {
    const { label, planned } = breakLabel([
      { id: 'b1', earliestSec: 0, latestSec: 0, durationSec: 1800 },
    ])
    assert.equal(label, 'Break · 30 min')
    assert.equal(planned, true)
  })

  test('sums several breaks', () => {
    const { label } = breakLabel([
      { id: 'b1', earliestSec: 0, latestSec: 0, durationSec: 900 },
      { id: 'b2', earliestSec: 0, latestSec: 0, durationSec: 900 },
    ])
    assert.equal(label, '2 breaks · 30 min')
  })
})

describe('start provenance', () => {
  test('says where the anchor came from', () => {
    assert.equal(startSubtitle(route()), 'Used GPS position when optimising')
  })

  test('an open route says the optimiser chose', () => {
    assert.equal(startSubtitle(route({ endpointMode: 'open', start: null })), 'Chosen by the optimiser')
  })

  test('an unset start says so rather than implying one exists', () => {
    assert.equal(startSubtitle(route({ start: null })), 'No start location set')
  })
})

describe('nextStopRowIndex — where the jump FAB goes', () => {
  test('the first pending stop, skipping what is already done', () => {
    const stops = [
      stop('a', { status: 'delivered' }),
      stop('b', { status: 'failed' }),
      stop('c'),
      stop('d'),
    ]
    const rows = buildRouteRows({ route: route({ stops }) })
    assert.equal(rows[nextStopRowIndex(rows)!].kind, 'stop')
    assert.equal((rows[nextStopRowIndex(rows)!] as StopRowModel).id, 'c')
  })

  test('a finished route has nowhere to jump to', () => {
    const rows = buildRouteRows({ route: route({ stops: [stop('a', { status: 'delivered' })] }) })
    assert.equal(nextStopRowIndex(rows), null)
  })
})
