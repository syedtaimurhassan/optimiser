import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import type { AddressedStop } from '../types.ts'
import type { RouteRow, StopRowModel } from './routeList.ts'
import {
  existingSectionLabel,
  findStopsInRoute,
  foldForSearch,
  matchesStop,
  queryTokens,
  searchPlaceholder,
  shouldQueryProvider,
} from './searchScreen.ts'

function stopRow(over: Partial<AddressedStop> & { title: string; subtitle?: string }): StopRowModel {
  const stop: AddressedStop = {
    id: over.id ?? 'uuid-1',
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
  return {
    kind: 'stop',
    id: stop.id,
    stop,
    seq: '01',
    eta: null,
    title: over.title,
    subtitle: over.subtitle ?? '',
    color: 'blue',
    tags: [],
    note: null,
  }
}

describe('foldForSearch', () => {
  test('folds letters that decompose under NFD', () => {
    assert.equal(foldForSearch('Åboulevarden'), 'aboulevarden')
    assert.equal(foldForSearch('Café'), 'cafe')
  })

  test('folds the Danish letters that do NOT decompose — the whole reason the map exists', () => {
    // These are single codepoints; NFD leaves them untouched, so without the
    // explicit map a Danish route is unsearchable from an ASCII keyboard.
    assert.equal(foldForSearch('Løvfrøvej'), 'lovfrovej')
    assert.equal(foldForSearch('Bagsværd'), 'bagsvaerd')
  })

  test('"å" and "aa" spellings of the same sound meet at the same fold', () => {
    // Århus and Aarhus are the same city, and a driver types whichever their
    // keyboard makes easy. All three must land on one string or the search
    // silently depends on which key they reached for.
    assert.equal(foldForSearch('Århus'), 'arhus')
    assert.equal(foldForSearch('Aarhus'), 'arhus')
    assert.equal(foldForSearch('arhus'), 'arhus')
    assert.equal(foldForSearch('Rundgården'), 'rundgarden')
  })

  test('collapses case and whitespace', () => {
    assert.equal(foldForSearch('  LØVFRØVEJ   6 '), 'lovfrovej 6')
  })
})

describe('queryTokens', () => {
  test('an empty or whitespace-only query yields no tokens', () => {
    assert.deepEqual(queryTokens(''), [])
    assert.deepEqual(queryTokens('   '), [])
  })

  test('splits on whitespace after folding', () => {
    assert.deepEqual(queryTokens('Løvfrøvej 6'), ['lovfrovej', '6'])
  })
})

describe('matchesStop', () => {
  const row = stopRow({
    title: 'Løvfrøvej 6',
    subtitle: '2880 Bagsværd, Denmark',
    stopId: 'D7',
    recipient: 'Jette Kelbjørn',
    notes: 'back gate',
  })

  test('an ASCII query finds a Danish address', () => {
    assert.equal(matchesStop(row, queryTokens('lovfrovej')), true)
  })

  test('the stop ID is searchable — the label written on the parcel', () => {
    assert.equal(matchesStop(row, queryTokens('D7')), true)
    assert.equal(matchesStop(row, queryTokens('d7')), true)
  })

  test('tokens may arrive in any order', () => {
    assert.equal(matchesStop(row, queryTokens('6 løvfrøvej')), true)
  })

  test('every token must match, not just one', () => {
    assert.equal(matchesStop(row, queryTokens('løvfrøvej 99')), false)
  })

  test('the recipient and notes are searchable too', () => {
    assert.equal(matchesStop(row, queryTokens('jette')), true)
    assert.equal(matchesStop(row, queryTokens('back gate')), true)
  })

  test('an empty token list never matches — an empty field shows no stops', () => {
    assert.equal(matchesStop(row, []), false)
  })
})

describe('findStopsInRoute', () => {
  const rows: RouteRow[] = [
    { kind: 'header', id: 'row-header', title: 'Monday' },
    stopRow({ id: 'a', stopId: 'A1', title: 'Løvfrøvej 6' }),
    stopRow({ id: 'b', stopId: 'A2', title: 'Nybrovej 12' }),
    stopRow({ id: 'c', stopId: 'A3', title: 'Løvfrøvej 8' }),
    { kind: 'footer', id: 'row-footer', completed: false },
  ]

  test('returns only stop rows, never headers or footers', () => {
    const found = findStopsInRoute(rows, 'løvfrøvej')
    assert.equal(found.length, 2)
    assert.ok(found.every((r) => r.kind === 'stop'))
  })

  test('preserves route order rather than reordering by relevance', () => {
    const found = findStopsInRoute(rows, 'lovfrovej')
    assert.deepEqual(
      found.map((r) => r.id),
      ['a', 'c'],
    )
  })

  test('an empty query matches nothing', () => {
    assert.deepEqual(findStopsInRoute(rows, ''), [])
  })
})

describe('presentation rules', () => {
  test('the placeholder changes with the route state', () => {
    assert.equal(searchPlaceholder(0), 'Tap to add stops')
    assert.equal(searchPlaceholder(12), 'Add or find stops')
  })

  test('the section label carries its count', () => {
    assert.equal(existingSectionLabel(3), 'From this route (3)')
  })

  test('the provider is not asked below the minimum length', () => {
    assert.equal(shouldQueryProvider('Lø', 3), false)
    assert.equal(shouldQueryProvider('Løv', 3), true)
    // Folding expands "æ", so a two-character query can legitimately clear a
    // three-character floor. Checked because the alternative — measuring the
    // raw string — would disagree with the service's own guard.
    assert.equal(shouldQueryProvider('væ', 3), true)
  })
})
