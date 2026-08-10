import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bestAddress,
  hasPostcode,
  looksLikeStreet,
  manifestCandidates,
  scoreLines,
} from './parseAddress.ts'

/** What a courier label actually looks like once OCR has flattened it. */
const LABEL = [
  'GLS',
  'TRACKING 04215771234567',
  'Anna Jensen',
  'Løvfrøvej 6',
  '2880 Bagsværd',
  'Weight 1.2 kg',
  '04215771234567',
]

test('a street line is recognised by having words and a small number', () => {
  assert.equal(looksLikeStreet('Løvfrøvej 6'), true)
  assert.equal(looksLikeStreet('6 Acacia Avenue'), true)
  assert.equal(looksLikeStreet('Flat 2B, Hill Road'), true)
})

test('a tracking number is not a street, however many digits it has', () => {
  assert.equal(looksLikeStreet('04215771234567'), false)
  assert.equal(looksLikeStreet('TRACKING 04215771234567'), false)
})

test('postcodes are found in the three shapes we meet', () => {
  assert.equal(hasPostcode('2880 Bagsværd'), true)
  assert.equal(hasPostcode('DK-2880 Bagsværd'), true)
  assert.equal(hasPostcode('London SW1A 1AA'), true)
  assert.equal(hasPostcode('Anna Jensen'), false)
})

test('label furniture is dropped and the address survives', () => {
  const kept = scoreLines(LABEL).map((l) => l.text)
  assert.ok(kept.includes('Løvfrøvej 6'))
  assert.ok(kept.includes('2880 Bagsværd'))
  assert.ok(!kept.includes('TRACKING 04215771234567'))
  assert.ok(!kept.includes('04215771234567'))
  assert.ok(!kept.some((l) => l.includes('Weight')))
})

test('the recipient survives, because a name is not furniture', () => {
  // It is not an address, but it belongs on the stop, and the driver decides.
  assert.ok(scoreLines(LABEL).some((l) => l.text === 'Anna Jensen'))
})

test('the street outranks the name', () => {
  const scored = scoreLines(LABEL)
  const street = scored.findIndex((l) => l.text === 'Løvfrøvej 6')
  const name = scored.findIndex((l) => l.text === 'Anna Jensen')
  assert.ok(street < name, 'the street line should rank above the recipient')
})

test('the best guess is the street and the postcode, in reading order', () => {
  // Not score order: "2880 Bagsværd, Løvfrøvej 6" is a worse geocoder query
  // than the same two lines the right way round.
  assert.equal(bestAddress(LABEL), 'Løvfrøvej 6, 2880 Bagsværd')
})

test('a label with only a street still produces a guess', () => {
  assert.equal(bestAddress(['DHL', 'Acacia Avenue 66']), 'Acacia Avenue 66')
})

test('a label with nothing address-shaped produces nothing', () => {
  assert.equal(bestAddress(['GLS', 'TRACKING 04215771234567']), null)
  assert.equal(bestAddress([]), null)
})

test('a manifest yields one candidate per delivery', () => {
  const sheet = [
    'Round 12 — Wednesday',
    'Løvfrøvej 6',
    '2880 Bagsværd',
    'Hovedgaden 41',
    '2970 Hørsholm',
    'Total 2 stops',
  ]
  assert.deepEqual(manifestCandidates(sheet), [
    'Løvfrøvej 6, 2880 Bagsværd',
    'Hovedgaden 41, 2970 Hørsholm',
  ])
})

test('a manifest with no postcodes still lists its streets', () => {
  // Degrades to a list the driver ticks through rather than to a failure.
  assert.deepEqual(manifestCandidates(['Løvfrøvej 6', 'Hovedgaden 41']), [
    'Løvfrøvej 6',
    'Hovedgaden 41',
  ])
})

test('nothing in a manifest is invented from a header', () => {
  assert.deepEqual(manifestCandidates(['Round 12 — Wednesday', 'Total 2 stops']), [])
})
