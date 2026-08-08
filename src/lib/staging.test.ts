import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, NewPendingChange, OptimizedRoute, PendingChange, Route } from '../types.ts'
import {
  addedStops,
  changeCount,
  describeChangeCount,
  dropChange,
  foldChange,
  frozenOrder,
  plannedStops,
  removedStopIds,
  splitPatch,
  stagedKindByStopId,
  stagedStops,
  stagesPlan,
} from './staging.ts'

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

const solved = (ids: (string | null)[]): OptimizedRoute => ({
  orderedWaypoints: [],
  orderedStopIds: ids,
  arrivalSec: [],
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 0,
  durationSeconds: 0,
  candidatesVisited: ids.length,
  candidatesTotal: ids.length,
})

function route(stops: AddressedStop[], changes: PendingChange[] = [], order?: string[]): Route {
  return {
    id: 'r1',
    name: 'Wednesday',
    dateISO: '2026-08-08',
    status: 'active',
    start: null,
    end: null,
    endpointMode: 'fixed',
    stops,
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    optimized: solved(order ?? stops.map((s) => s.id)),
    pending: changes.length > 0 ? { changes } : undefined,
    createdAt: 0,
    updatedAt: 0,
  }
}

let seq = 0
const change = (c: NewPendingChange | PendingChange): PendingChange =>
  ({ id: `c${++seq}`, at: seq, ...c }) as PendingChange

const add = (id: string) => change({ kind: 'add', stopId: id, stop: stop(id) })
const remove = (id: string) => change({ kind: 'remove', stopId: id })
const edit = (id: string, patch: Partial<AddressedStop>) => change({ kind: 'edit', stopId: id, patch })

describe('stagesPlan', () => {
  test('a time window changes the plan', () => {
    assert.equal(stagesPlan({ twOpenSec: 32400 }), true)
  })

  test('so do the coordinates, the service time and the order constraint', () => {
    assert.equal(stagesPlan({ lat: 55.7 }), true)
    assert.equal(stagesPlan({ serviceTimeSec: 300 }), true)
    assert.equal(stagesPlan({ order: 'first' }), true)
  })

  /**
   * The restraint that makes the review screen worth reading. A door code
   * cannot move a stop or shift an ETA, and a diff full of them would train
   * the driver to apply without looking.
   */
  test('a door code, a note and a recipient do not', () => {
    assert.equal(stagesPlan({ accessCodes: '1234#' }), false)
    assert.equal(stagesPlan({ notes: 'bike + boks' }), false)
    assert.equal(stagesPlan({ recipient: 'Jette' }), false)
    assert.equal(stagesPlan({ parcelCount: 3 }), false)
  })
})

describe('splitPatch', () => {
  test('one patch, two destinations', () => {
    const { planned, direct } = splitPatch({ twOpenSec: 32400, accessCodes: '1234#' })
    assert.deepEqual(planned, { twOpenSec: 32400 })
    assert.deepEqual(direct, { accessCodes: '1234#' })
  })
})

describe('foldChange', () => {
  test('two edits to one stop are ONE change, patches merged', () => {
    const changes = foldChange(
      foldChange([], edit('a', { twOpenSec: 32400 })),
      edit('a', { twCloseSec: 43200 }),
    )
    assert.equal(changes.length, 1)
    assert.deepEqual(
      changes[0].kind === 'edit' ? changes[0].patch : null,
      { twOpenSec: 32400, twCloseSec: 43200 },
    )
  })

  test('editing a staged stop folds into its add rather than becoming a second change', () => {
    const changes = foldChange(foldChange([], add('n1')), edit('n1', { serviceTimeSec: 300 }))
    assert.equal(changes.length, 1)
    assert.equal(changes[0].kind, 'add')
    assert.equal(changes[0].kind === 'add' ? changes[0].stop.serviceTimeSec : null, 300)
  })

  /** They changed their mind. There is no diff to review for a stop that never landed. */
  test('removing a staged stop retracts the add entirely', () => {
    assert.deepEqual(foldChange(foldChange([], add('n1')), remove('n1')), [])
  })

  test('removing a REAL stop is a change, not a retraction', () => {
    const changes = foldChange(foldChange([], add('n1')), remove('a'))
    assert.equal(changes.length, 2)
  })

  test('a second move replaces the first — dragged twice, not moved twice', () => {
    const changes = foldChange(
      foldChange([], change({ kind: 'move', stopId: 'a', toIndex: 2 })),
      change({ kind: 'move', stopId: 'a', toIndex: 5 }),
    )
    assert.equal(changes.length, 1)
    assert.equal(changes[0].kind === 'move' ? changes[0].toIndex : null, 5)
  })

  test('changes to different stops accumulate', () => {
    assert.equal(foldChange(foldChange([], add('n1')), add('n2')).length, 2)
  })
})

describe('changeCount', () => {
  test('names the unit it counts — Spoke’s "2 stops" is ambiguous', () => {
    assert.equal(describeChangeCount(1), '1 change')
    assert.equal(describeChangeCount(2), '2 changes')
  })

  test('an absent set is zero, not a crash', () => {
    assert.equal(changeCount(undefined), 0)
  })
})

describe('dropChange', () => {
  test('drops by the change id, leaving the rest', () => {
    const one = add('n1')
    const two = add('n2')
    assert.deepEqual(dropChange([one, two], one.id), [two])
  })
})

describe('stagedStops', () => {
  const base = [stop('a'), stop('b')]

  test('added stops appear', () => {
    assert.deepEqual(
      stagedStops(route(base, [add('n1')])).map((s) => s.id),
      ['a', 'b', 'n1'],
    )
  })

  /**
   * The removal has to stay visible: the red chip with the trash glyph IS the
   * review, and a stop that had simply vanished would be a change the driver
   * could not inspect before applying it.
   */
  test('removed stops stay, so the annotation has something to annotate', () => {
    assert.deepEqual(
      stagedStops(route(base, [remove('a')])).map((s) => s.id),
      ['a', 'b'],
    )
  })

  test('edits are merged in place', () => {
    const staged = stagedStops(route(base, [edit('a', { serviceTimeSec: 600 })]))
    assert.equal(staged[0].serviceTimeSec, 600)
  })

  test('nothing staged returns the very same array — reference equality matters here', () => {
    const r = route(base)
    assert.equal(stagedStops(r), r.stops)
  })
})

describe('plannedStops', () => {
  test('removals are actually gone — the preview must not drive to them', () => {
    const stops = [stop('a'), stop('b')]
    assert.deepEqual(
      plannedStops(route(stops, [remove('a'), add('n1')])).map((s) => s.id),
      ['b', 'n1'],
    )
  })

  test('handled stops drop out, as they do for a full solve', () => {
    const stops = [stop('a', { status: 'delivered' }), stop('b'), stop('c', { status: 'failed' })]
    assert.deepEqual(plannedStops(route(stops)).map((s) => s.id), ['b'])
  })
})

describe('frozenOrder', () => {
  test('is the solved order, and staged adds are NOT in it', () => {
    const stops = [stop('a'), stop('b'), stop('c')]
    const r = route(stops, [add('n1')], ['c', 'a', 'b'])
    assert.deepEqual(frozenOrder(r).map((s) => s.id), ['c', 'a', 'b'])
  })

  test('a stop staged for removal leaves the frozen sequence', () => {
    const stops = [stop('a'), stop('b'), stop('c')]
    const r = route(stops, [remove('b')], ['a', 'b', 'c'])
    assert.deepEqual(frozenOrder(r).map((s) => s.id), ['a', 'c'])
  })
})

describe('stagedKindByStopId', () => {
  test('one state per stop, keyed by uuid', () => {
    const kinds = stagedKindByStopId({ changes: [add('n1'), remove('a'), edit('b', { lat: 1 })] })
    assert.deepEqual(kinds, { n1: 'add', a: 'remove' })
  })
})

describe('removedStopIds and addedStops', () => {
  test('name exactly what their sections render', () => {
    const pending = { changes: [add('n1'), remove('a')] }
    assert.deepEqual([...removedStopIds(pending)], ['a'])
    assert.deepEqual(addedStops(pending).map((s) => s.id), ['n1'])
  })
})
