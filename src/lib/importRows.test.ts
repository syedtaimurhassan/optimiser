import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { addressFromRow, buildQuery, classifyRow, classifyRows, normalizeRow } from './importRows.ts'

describe('column detection', () => {
  test('is case- and whitespace-insensitive about headers', () => {
    const row = normalizeRow({ '  Lat ': '55.7', 'LNG': ' 12.4 ' })
    assert.equal(row['lat'], '55.7')
    assert.equal(row['lng'], '12.4')
  })

  test('finds coordinates through common aliases', () => {
    const r = classifyRow({ latitude: 55.7, longitude: 12.4 }, 1)
    assert.deepEqual(r.point, { lat: 55.7, lng: 12.4 })
  })

  test('understands Danish headers, because that is what the files say', () => {
    const r = classifyRow({ adresse: 'Løvfrøvej 6', postnummer: '2880', by: 'Bagsværd' }, 1)
    assert.equal(r.query, 'Løvfrøvej 6, 2880 Bagsværd')
  })
})

describe('buildQuery', () => {
  test('uses a single address column when there is one', () => {
    assert.equal(buildQuery(normalizeRow({ address: 'Løvfrøvej 6, 2880 Bagsværd' })), 'Løvfrøvej 6, 2880 Bagsværd')
  })

  test('assembles one from parts when there is not', () => {
    const q = buildQuery(
      normalizeRow({ street: 'Løvfrøvej', housenumber: '6', postcode: '2880', city: 'Bagsværd', country: 'Denmark' }),
    )
    assert.equal(q, 'Løvfrøvej 6, 2880 Bagsværd, Denmark')
  })

  test('degrades rather than emitting stray punctuation', () => {
    assert.equal(buildQuery(normalizeRow({ city: 'Bagsværd' })), 'Bagsværd')
  })

  test('a row with nothing address-like yields nothing', () => {
    assert.equal(buildQuery(normalizeRow({ colour: 'red' })), undefined)
  })
})

describe('coordinates win over an address when both are present', () => {
  const row = { lat: '55.7', lng: '12.4', address: 'Løvfrøvej 6', city: 'Bagsværd' }

  test('the point is used, so no request is spent', () => {
    const r = classifyRow(row, 1)
    assert.deepEqual(r.point, { lat: 55.7, lng: 12.4 })
    assert.equal(r.query, undefined)
  })

  test('but the address is kept, so the row does not render as a coordinate', () => {
    const r = classifyRow(row, 1)
    assert.equal(r.address?.title, 'Løvfrøvej 6')
  })
})

describe('bad coordinates', () => {
  test('a row with unusable coordinates AND an address falls back to the address', () => {
    const r = classifyRow({ lat: 'n/a', lng: '', address: 'Løvfrøvej 6' }, 4)
    assert.equal(r.error, undefined)
    assert.equal(r.query, 'Løvfrøvej 6')
  })

  test('a row with unusable coordinates and nothing else names its line', () => {
    const r = classifyRow({ lat: 'n/a', lng: '' }, 4)
    assert.match(r.error ?? '', /Row 4/)
  })

  test('out-of-range coordinates say so specifically', () => {
    const r = classifyRow({ lat: '955', lng: '12.4' }, 2)
    assert.match(r.error ?? '', /out of range/)
  })
})

describe('the extra columns that used to be thrown away', () => {
  test('recipient and notes come across', () => {
    const r = classifyRow({ address: 'Løvfrøvej 6', modtager: 'Jette', note: 'back gate' }, 1)
    assert.equal(r.recipient, 'Jette')
    assert.equal(r.notes, 'back gate')
  })

  test('a phone number is appended to notes rather than dropped', () => {
    const r = classifyRow({ address: 'Løvfrøvej 6', note: 'back gate', tlf: '12345678' }, 1)
    assert.equal(r.notes, 'back gate · 12345678')
  })

  test('a phone with no note still survives', () => {
    const r = classifyRow({ address: 'Løvfrøvej 6', phone: '12345678' }, 1)
    assert.equal(r.notes, '12345678')
  })
})

describe('the file-level report', () => {
  test('counts what still needs geocoding', () => {
    const out = classifyRows([
      { lat: '55.7', lng: '12.4' },
      { address: 'Løvfrøvej 6' },
      { address: 'Nybrovej 12' },
    ])
    assert.equal(out.rows.length, 3)
    assert.equal(out.needsGeocoding, 2)
  })

  test('keeps the good rows and reports the bad ones — never a silent drop', () => {
    const out = classifyRows([{ address: 'Løvfrøvej 6' }, { colour: 'red' }, { address: 'Nybrovej 12' }])
    assert.equal(out.rows.length, 2)
    assert.equal(out.errors.length, 1)
    assert.match(out.errors[0], /Row 2/)
  })

  test('a file with nothing usable explains what was expected', () => {
    const out = classifyRows([{ colour: 'red' }])
    assert.match(out.errors[0], /Expected columns/)
  })

  test('an empty file is not an error, it is just empty', () => {
    assert.deepEqual(classifyRows([]), { rows: [], needsGeocoding: 0, errors: [] })
  })
})

describe('addressFromRow', () => {
  test('marks its provenance as the file, not a geocoder', () => {
    const a = addressFromRow(normalizeRow({ address: 'Løvfrøvej 6', postcode: '2880', city: 'Bagsværd' }))
    assert.equal(a?.source, 'import')
    assert.equal(a?.title, 'Løvfrøvej 6')
    assert.equal(a?.subtitle, '2880 Bagsværd')
  })
})
