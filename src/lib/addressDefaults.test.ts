import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addressKey, applyDefault, defaultsFromStop, matchesDefault } from './addressDefaults.ts'
import type { AddressedStop } from '../types.ts'

const stop = (over: Partial<AddressedStop> = {}): AddressedStop => ({
  id: 's',
  stopId: 'D7',
  originalPosition: 7,
  lat: 55.68123,
  lng: 12.53456,
  address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', postcode: '2880', source: 'geocoder' },
  kind: 'delivery',
  order: 'auto',
  status: 'pending',
  statusHistory: [],
  ...over,
})

test('the key folds Danish characters, so an ASCII entry still matches', () => {
  const geocoded = addressKey(
    { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', postcode: '2880', source: 'geocoder' },
    { lat: 0, lng: 0 },
  )
  const typed = addressKey(
    { title: 'Lovfrovej 6', subtitle: 'Bagsvard, 2880', postcode: '2880', source: 'manual' },
    { lat: 0, lng: 0 },
  )
  assert.equal(geocoded, typed)
})

test('the same street in two postcodes is two doors', () => {
  const a = addressKey({ title: 'Station Road 1', postcode: '2880', subtitle: '', source: 'manual' }, { lat: 0, lng: 0 })
  const b = addressKey({ title: 'Station Road 1', postcode: '2100', subtitle: '', source: 'manual' }, { lat: 0, lng: 0 })
  assert.notEqual(a, b)
})

test('a coordinate-only stop is keyed on its position, to about a metre', () => {
  const key = addressKey(undefined, { lat: 55.681234, lng: 12.534567 })
  assert.equal(key, 'coord:55.68123,12.53457')
  // A metre away is the same door.
  assert.equal(addressKey(undefined, { lat: 55.6812344, lng: 12.5345671 }), key)
})

test('a nonsense coordinate has no key rather than a broken one', () => {
  assert.equal(addressKey(undefined, { lat: Number.NaN, lng: 0 }), null)
})

test('what is saved is about the door, not about the delivery', () => {
  const saved = defaultsFromStop(
    stop({
      accessCodes: '1234#',
      packageFinder: 'back left, red crate',
      parcelCount: 2,
      serviceTimeSec: 300,
      notes: 'leave with next door',
      recipient: 'Jette',
      groupId: 'g-1',
    }),
    5,
  )
  assert.equal(saved.accessCodes, '1234#')
  assert.equal(saved.packageFinder, 'back left, red crate')
  assert.equal(saved.parcelCount, 2)
  assert.ok(!('notes' in saved), 'a delivery note must not become an address default')
  assert.ok(!('recipient' in saved), 'a recipient must not become an address default')
  assert.ok(!('groupId' in saved), 'groups are route-scoped and cannot travel')
})

test('a blank access code is not saved as an empty string', () => {
  assert.equal(defaultsFromStop(stop({ accessCodes: '   ' }), 1).accessCodes, undefined)
})

test('applying a default fills the gaps', () => {
  const saved = defaultsFromStop(stop({ accessCodes: '1234#', parcelCount: 2 }), 1)
  const applied = applyDefault({ lat: 1, lng: 2 } as Partial<AddressedStop>, saved)
  assert.equal(applied.accessCodes, '1234#')
  assert.equal(applied.parcelCount, 2)
})

test("…but never overwrites what today's import already knew", () => {
  const saved = defaultsFromStop(stop({ parcelCount: 2 }), 1)
  const applied = applyDefault({ parcelCount: 7 } as Partial<AddressedStop>, saved)
  assert.equal(applied.parcelCount, 7)
})

test('applying nothing is a no-op, not a wipe', () => {
  const input = { parcelCount: 3 } as Partial<AddressedStop>
  assert.equal(applyDefault(input, undefined), input)
})

test('the star hollows out the moment the stop stops matching', () => {
  const base = stop({ accessCodes: '1234#', parcelCount: 2 })
  const saved = defaultsFromStop(base, 1)
  assert.equal(matchesDefault(base, saved), true)
  assert.equal(matchesDefault(stop({ accessCodes: '1234#', parcelCount: 3 }), saved), false)
  assert.equal(matchesDefault(base, undefined), false)
})
