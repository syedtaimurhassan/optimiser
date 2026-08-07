import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, OptimizedRoute, StopStatus } from '../../types.ts'
import {
  buildStopFeatures,
  collectChipSpecs,
  formatEta,
  labelLinesFor,
  lastHandledStop,
  nextStopId,
} from './features.ts'

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

const base = { groups: [], selectedStopId: null, nextStopId: null }

/** An optimisation that visits the given stops in order, between two endpoints. */
const solved = (ids: string[]): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: [null, ...ids, null],
  arrivalSec: [],
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 0,
  durationSeconds: 0,
  candidatesVisited: ids.length,
  candidatesTotal: ids.length,
})

describe('buildStopFeatures', () => {
  test('one feature per stop, carrying the uuid for click handling', () => {
    const fc = buildStopFeatures({ ...base, stops: [stop('a'), stop('b')] })
    assert.equal(fc.features.length, 2)
    assert.equal(fc.features[0].properties.id, 'a')
    assert.equal(fc.features[0].id, 'a')
  })

  test('coordinates are GeoJSON order — lng first', () => {
    const fc = buildStopFeatures({ ...base, stops: [stop('a', { lat: 55.6, lng: 12.5 })] })
    assert.deepEqual(fc.features[0].geometry.coordinates, [12.5, 55.6])
  })

  test('an empty route produces an empty collection, not a null source', () => {
    assert.deepEqual(buildStopFeatures({ ...base, stops: [] }).features, [])
  })

  test('the label arrives as two separate lines for the layer to style', () => {
    const withEta = stop('a', {
      address: { title: 'Løvfrøvej 6', subtitle: '', source: 'geocoder' },
      etaSec: 9 * 3600 + 42 * 60,
    })
    const props = buildStopFeatures({ ...base, stops: [withEta] }).features[0].properties
    assert.equal(props.line1, 'Løvfrøvej 6')
    assert.equal(props.line2, '09:42')
  })

  test('no ETA yields an empty line2, which the layer uses to drop the break', () => {
    const props = buildStopFeatures({ ...base, stops: [stop('a')] }).features[0].properties
    assert.equal(props.line2, '', 'must be empty string, not undefined — the style compares to ""')
  })

  test('the selected stop carries the winning sort key', () => {
    const fc = buildStopFeatures({
      ...base,
      stops: [stop('a'), stop('b')],
      selectedStopId: 'b',
    })
    const [a, b] = fc.features
    assert.ok(b.properties.sortKey < a.properties.sortKey)
  })
})

describe('label lines', () => {
  test('an addressed stop shows its street line', () => {
    const s = stop('a', {
      address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    })
    assert.deepEqual(labelLinesFor(s), ['Løvfrøvej 6'])
  })

  test('a coordinate-only stop shows coordinates rather than a blank line', () => {
    assert.deepEqual(labelLinesFor(stop('a', { lat: 55.6, lng: 12.5 })), ['55.60000, 12.50000'])
  })

  test('an ETA becomes the second line', () => {
    const s = stop('a', {
      address: { title: 'Løvfrøvej 6', subtitle: '', source: 'manual' },
      etaSec: 9 * 3600 + 42 * 60,
    })
    assert.deepEqual(labelLinesFor(s), ['Løvfrøvej 6', '09:42'])
  })

  test('a whitespace-only address title falls back to coordinates', () => {
    const s = stop('a', { address: { title: '   ', subtitle: '', source: 'import' } })
    assert.deepEqual(labelLinesFor(s), ['55.60000, 12.50000'])
  })

  test('formatEta rejects what it cannot render honestly', () => {
    assert.equal(formatEta(undefined), null)
    assert.equal(formatEta(-1), null)
    assert.equal(formatEta(NaN), null)
    assert.equal(formatEta(0), '00:00')
    // Past midnight wraps rather than printing "25:10".
    assert.equal(formatEta(25 * 3600 + 10 * 60), '01:10')
  })
})

describe('collectChipSpecs', () => {
  test('deduplicates identical chips so 300 stops are not 300 textures', () => {
    const stops = Array.from({ length: 50 }, (_, i) => stop(`s${i}`, { stopId: 'D7' }))
    assert.equal(collectChipSpecs({ ...base, stops }).size, 1)
  })

  test('distinct labels and states each get their own', () => {
    const specs = collectChipSpecs({
      ...base,
      stops: [
        stop('a', { stopId: 'D7' }),
        stop('b', { stopId: 'D8' }),
        stop('c', { stopId: 'D8', status: 'failed' }),
      ],
    })
    assert.equal(specs.size, 3)
  })
})

describe('nextStopId', () => {
  test('follows the solved order, not entry order', () => {
    const stops = [stop('a'), stop('b'), stop('c')]
    assert.equal(nextStopId({ stops, optimized: solved(['c', 'a', 'b']) }), 'c')
  })

  test('falls back to entry order on an unsolved route', () => {
    assert.equal(nextStopId({ stops: [stop('a'), stop('b')], optimized: undefined }), 'a')
  })

  test('skips stops already dealt with, including failures', () => {
    const stops = [stop('a', { status: 'delivered' }), stop('b', { status: 'failed' }), stop('c')]
    assert.equal(nextStopId({ stops, optimized: solved(['a', 'b', 'c']) }), 'c')
  })

  test('a finished route has no next stop', () => {
    const stops = [stop('a', { status: 'delivered' }), stop('b', { status: 'failed' })]
    assert.equal(nextStopId({ stops, optimized: solved(['a', 'b']) }), null)
  })

  test('a stop deleted since the solve does not resurrect as the next stop', () => {
    const stops = [stop('b')]
    assert.equal(nextStopId({ stops, optimized: solved(['a', 'b']) }), 'b')
  })
})

describe('lastHandledStop', () => {
  test('is where the grey line ends — the last non-pending stop in route order', () => {
    const stops = [
      stop('a', { status: 'delivered' }),
      stop('b', { status: 'failed' }),
      stop('c'),
    ]
    assert.equal(lastHandledStop({ stops, optimized: solved(['a', 'b', 'c']) })?.id, 'b')
  })

  test('a failure counts as handled — the van has been and gone', () => {
    const stops = [stop('a', { status: 'failed' }), stop('b')]
    assert.equal(lastHandledStop({ stops, optimized: solved(['a', 'b']) })?.id, 'a')
  })

  test('nothing done yet means no split point', () => {
    const stops = [stop('a'), stop('b')]
    assert.equal(lastHandledStop({ stops, optimized: solved(['a', 'b']) }), null)
  })

  test('an out-of-order completion still reports the last one in ROUTE order', () => {
    // The driver delivered stop c early. The grey line must still end at c,
    // because that is how far along the driven path they actually are.
    const statuses: StopStatus[] = ['pending', 'pending', 'delivered']
    const stops = ['a', 'b', 'c'].map((id, i) => stop(id, { status: statuses[i] }))
    assert.equal(lastHandledStop({ stops, optimized: solved(['a', 'b', 'c']) })?.id, 'c')
  })
})
