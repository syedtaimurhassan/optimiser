import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coordinatesIn, matchScan, nativeIsSufficient } from './scan.ts'
import type { AddressedStop } from '../types.ts'

const stop = (over: Partial<AddressedStop> & { id: string; stopId: string }): AddressedStop => ({
  lat: 55.7,
  lng: 12.5,
  originalPosition: 1,
  kind: 'delivery',
  order: 'auto',
  status: 'pending',
  statusHistory: [],
  ...over,
})

const D7 = stop({ id: 'uuid-d7', stopId: 'D7' })
const D8 = stop({ id: 'uuid-d8', stopId: 'D8' })
const AD73 = stop({ id: 'uuid-ad73', stopId: 'AD73' })

// ------------------------------------------------------------------ formats

test('a native detector without the label formats is not sufficient', () => {
  // Android without the Play Services barcode module, and every consumer-only
  // implementation: QR and EANs, nothing a courier prints.
  assert.equal(nativeIsSufficient(['qr_code', 'ean_13', 'upc_a']), false)
})

test('a native detector that reads shipping labels is', () => {
  assert.equal(
    nativeIsSufficient(['aztec', 'code_128', 'data_matrix', 'pdf417', 'qr_code', 'ean_13']),
    true,
  )
})

test('an empty or absent format list is never sufficient', () => {
  // The constructor exists, the module is missing. This is the case that looks
  // like support and reads nothing.
  assert.equal(nativeIsSufficient([]), false)
  assert.equal(nativeIsSufficient(null), false)
  assert.equal(nativeIsSufficient(undefined), false)
})

// ----------------------------------------------------------------- matching

test('a linked barcode wins, and it wins over a label in the same payload', () => {
  const linked = stop({ id: 'uuid-x', stopId: 'D1', barcodes: ['D7'] })
  const match = matchScan('D7', [D7, linked])
  assert.deepEqual(match, { kind: 'stop', stopId: 'uuid-x', via: 'barcode' })
})

test('a stop label written on the box finds the stop', () => {
  assert.deepEqual(matchScan('D7', [D7, D8]), { kind: 'stop', stopId: 'uuid-d7', via: 'label' })
})

test('a label embedded in a carrier payload still matches, as a whole token', () => {
  assert.deepEqual(matchScan('PKG-D7/2026', [D7, D8]), {
    kind: 'stop',
    stopId: 'uuid-d7',
    via: 'label',
  })
})

test('D7 does not match AD73, and AD73 does not match D7', () => {
  // A substring match would send the driver to the wrong parcel. Tokens only.
  assert.equal(matchScan('AD73', [D7]).kind, 'unknown')
  assert.deepEqual(matchScan('AD73', [D7, AD73]), {
    kind: 'stop',
    stopId: 'uuid-ad73',
    via: 'label',
  })
})

test('two stops sharing a label is a question, not a coin toss', () => {
  // "Reset Stop IDs" can leave duplicates — types.ts says the label is a
  // display string, not an identity. Picking the first would be wrong half
  // the time it mattered.
  const twin = stop({ id: 'uuid-twin', stopId: 'D7' })
  assert.deepEqual(matchScan('D7', [D7, twin]), {
    kind: 'ambiguous',
    stopIds: ['uuid-d7', 'uuid-twin'],
    text: 'D7',
  })
})

test('a tracking number nobody has linked is simply unknown', () => {
  assert.deepEqual(matchScan('JJD000390009123456789', [D7, D8]), {
    kind: 'unknown',
    text: 'JJD000390009123456789',
  })
})

test('an empty scan is not a match for the first stop in the list', () => {
  assert.equal(matchScan('   ', [D7]).kind, 'unknown')
})

// -------------------------------------------------------------- coordinates

test('a geo URI is a place, and becomes a stop', () => {
  const match = matchScan('geo:55.6761,12.5683', [D7])
  assert.deepEqual(match, {
    kind: 'coordinates',
    point: { lat: 55.6761, lng: 12.5683 },
    text: 'geo:55.6761,12.5683',
  })
})

test('a geo URI keeps its coordinates when it carries hints', () => {
  assert.deepEqual(coordinatesIn('geo:55.6761,12.5683;u=35'), { lat: 55.6761, lng: 12.5683 })
  assert.deepEqual(coordinatesIn('geo:55.6761,12.5683?q=Depot'), { lat: 55.6761, lng: 12.5683 })
})

test('a bare pair is a place too', () => {
  assert.deepEqual(coordinatesIn('55.6761, 12.5683'), { lat: 55.6761, lng: 12.5683 })
})

test('a tracking number of digits is not a coordinate', () => {
  assert.equal(coordinatesIn('JJD000390009123456789'), null)
  assert.equal(coordinatesIn('1234567890'), null)
})

test('an out-of-range pair is rejected rather than clamped', () => {
  assert.equal(coordinatesIn('991.0,12.5'), null)
})
