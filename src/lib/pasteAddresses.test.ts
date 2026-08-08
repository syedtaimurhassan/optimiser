import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { isMultiAddressPaste, parsePastedAddresses } from './pasteAddresses.ts'

describe('parsePastedAddresses', () => {
  test('one address per line — the common case', () => {
    const { addresses } = parsePastedAddresses(
      'Løvfrøvej 6, 2880 Bagsværd\nNybrovej 12, 2820 Gentofte\nRundgården 34',
    )
    assert.deepEqual(addresses, [
      'Løvfrøvej 6, 2880 Bagsværd',
      'Nybrovej 12, 2820 Gentofte',
      'Rundgården 34',
    ])
  })

  test('does NOT split on commas — that would shred every address', () => {
    const { addresses } = parsePastedAddresses('Løvfrøvej 6, 2880 Bagsværd, Denmark')
    assert.deepEqual(addresses, ['Løvfrøvej 6, 2880 Bagsværd, Denmark'])
  })

  test('semicolons separate, because that is how a list survives a one-line field', () => {
    const { addresses } = parsePastedAddresses('Løvfrøvej 6; Nybrovej 12; Rundgården 34')
    assert.equal(addresses.length, 3)
  })

  test('strips list decoration', () => {
    const { addresses } = parsePastedAddresses('1. Løvfrøvej 6\n2) Nybrovej 12\n- Rundgården 34\n• Bagsværd 1')
    assert.deepEqual(addresses, ['Løvfrøvej 6', 'Nybrovej 12', 'Rundgården 34', 'Bagsværd 1'])
  })

  test('drops lines with no letters, and reports them', () => {
    const { addresses, skipped } = parsePastedAddresses('Løvfrøvej 6\n12345\nNybrovej 12')
    assert.deepEqual(addresses, ['Løvfrøvej 6', 'Nybrovej 12'])
    assert.deepEqual(skipped, ['12345'])
  })

  test('de-duplicates case-insensitively so one door does not become two stops', () => {
    const { addresses } = parsePastedAddresses('Løvfrøvej 6\nløvfrøvej 6\nNybrovej 12')
    assert.deepEqual(addresses, ['Løvfrøvej 6', 'Nybrovej 12'])
  })

  test('collapses internal whitespace and ignores blank lines', () => {
    const { addresses } = parsePastedAddresses('\n\n  Løvfrøvej    6  \n\n')
    assert.deepEqual(addresses, ['Løvfrøvej 6'])
  })

  test('caps the number of entries and reports the overflow', () => {
    const text = Array.from({ length: 8 }, (_, i) => `Street ${i}`).join('\n')
    const { addresses, skipped } = parsePastedAddresses(text, 5)
    assert.equal(addresses.length, 5)
    assert.equal(skipped.length, 3)
  })

  test('handles the five-address case from the milestone definition of done', () => {
    const { addresses } = parsePastedAddresses(
      [
        'Løvfrøvej 6, 2880 Bagsværd',
        'Nybrovej 12, 2820 Gentofte',
        'Rundgården 34, 2820 Gentofte',
        'Åboulevarden 1, 8000 Aarhus',
        'Vangede Bygade 5, 2820 Gentofte',
      ].join('\n'),
    )
    assert.equal(addresses.length, 5)
  })
})

describe('isMultiAddressPaste', () => {
  test('a single address is not a multi-paste', () => {
    assert.equal(isMultiAddressPaste('Løvfrøvej 6, 2880 Bagsværd'), false)
  })

  test('two lines are', () => {
    assert.equal(isMultiAddressPaste('Løvfrøvej 6\nNybrovej 12'), true)
  })
})
