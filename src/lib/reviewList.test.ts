import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type {
  AddressedStop,
  NewPendingChange,
  OptimizedRoute,
  PendingChange,
  Route,
} from '../types.ts'
import { buildReviewRows, type ReviewRow } from './reviewList.ts'
import { planIsStale } from './routeSummary.ts'

function stop(id: string, stopId: string, patch: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id,
    stopId,
    originalPosition: 1,
    lat: 55.6,
    lng: 12.5,
    address: { title: `${stopId} Elstedvej`, subtitle: 'Rødovre, 2610', source: 'geocoder' },
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...patch,
  }
}

const base = [stop('a', 'D6'), stop('b', 'D7'), stop('c', 'D8')]

/** A solve with real arrivals, so the ETA columns have something to print. */
const solved = (ids: (string | null)[]): OptimizedRoute => ({
  orderedWaypoints: ids.map(() => ({ lat: 55.6, lng: 12.5 })),
  orderedStopIds: ids,
  arrivalSec: ids.map((_, i) => i * 600),
  legSeconds: ids.slice(1).map(() => 540),
  geometry: { type: 'LineString', coordinates: [] },
  distanceMeters: 1000,
  durationSeconds: 1800,
  candidatesVisited: ids.length,
  candidatesTotal: ids.length,
})

let seq = 0
const change = (c: NewPendingChange): PendingChange =>
  ({ id: `c${++seq}`, at: seq, ...c }) as PendingChange

function route(changes: PendingChange[], patch: Partial<Route> = {}): Route {
  const added = changes.filter((c) => c.kind === 'add').map((c) => c.stop)
  const removed = new Set(changes.filter((c) => c.kind === 'remove').map((c) => c.stopId))
  const provisionalIds = base.map((s) => s.id).filter((id) => !removed.has(id))
  // Adds land after D7, which is where a preview over this fixture puts them.
  for (const stop of added) provisionalIds.splice(2, 0, stop.id)

  return {
    id: 'r1',
    name: 'Wednesday',
    dateISO: '2026-08-08',
    status: 'active',
    start: { lat: 55.5, lng: 12.4 },
    end: null,
    endpointMode: 'fixed',
    stops: base,
    groups: [],
    breaks: [],
    optimizeBy: 'duration',
    searchTierSec: 3,
    targetK: null,
    optimized: solved(base.map((s) => s.id)),
    pending: {
      changes,
      provisional: changes.length > 0 ? solved(provisionalIds) : undefined,
    },
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  }
}

const NOW = Date.UTC(2026, 7, 8, 10, 0, 0)
const rowsOf = (r: Route) => buildReviewRows({ route: r, nowMs: NOW })
const kinds = (rows: ReviewRow[]) => rows.map((r) => r.kind)
const sections = (rows: ReviewRow[]) =>
  rows.filter((r) => r.kind === 'section').map((r) => (r.kind === 'section' ? r.title : ''))

const addOf = (id: string) => change({ kind: 'add', stopId: id, stop: stop(id, 'D7.1') })
const removeOf = (id: string) => change({ kind: 'remove', stopId: id })

describe('buildReviewRows', () => {
  test('nothing staged is no screen at all', () => {
    assert.deepEqual(rowsOf(route([])), [])
  })

  test('the sections come in the order the design names them', () => {
    const rows = rowsOf(route([addOf('n1'), removeOf('a')]))
    assert.deepEqual(sections(rows), ['Added stops', 'Removed stops', 'Existing route'])
  })

  test('a section is omitted entirely when it has nothing in it', () => {
    assert.deepEqual(sections(rowsOf(route([addOf('n1')]))), ['Added stops', 'Existing route'])
    assert.deepEqual(sections(rowsOf(route([removeOf('a')]))), ['Removed stops', 'Existing route'])
  })

  /** Task 2: the break row first, then Start location, then the stops. */
  test('the existing route begins with the break, then the start', () => {
    const rows = rowsOf(route([addOf('n1')]))
    const from = rows.findIndex((r) => r.kind === 'section' && r.title === 'Existing route')
    assert.deepEqual(kinds(rows.slice(from + 1, from + 3)), ['break', 'start'])
  })

  test('the end row closes it', () => {
    assert.equal(rowsOf(route([addOf('n1')])).at(-1)?.kind, 'end')
  })
})

describe('the added rows', () => {
  test('carry no sequence number — they are not in the sequence yet', () => {
    const row = rowsOf(route([addOf('n1')])).find((r) => r.kind === 'added')
    assert.equal(row?.kind === 'added' ? row.seq : 'x', '')
  })

  /**
   * They DO appear in the existing route, in the position the preview gives
   * them, and that is what keeps the numbering continuous. Leaving them out
   * produced 1, 2, 4, 5 with a hole — which reads as a rendering bug — and put
   * two different rows on screen both claiming position 3.
   */
  test('they appear once more in the existing route, in their new position', () => {
    const rows = rowsOf(route([addOf('n1')]))
    const inRoute = rows.find((r) => r.kind === 'existing' && r.id === 'n1')
    assert.ok(inRoute?.kind === 'existing')
    assert.equal(inRoute.added, true)
    assert.equal(inRoute.seq, '3')
  })

  test('the existing route is numbered without gaps', () => {
    const rows = rowsOf(route([addOf('n1')]))
    const seqs = rows.filter((r) => r.kind === 'existing').map((r) => (r.kind === 'existing' ? r.seq : ''))
    assert.deepEqual(seqs, ['1', '2', '3', '4'])
  })
})

describe('the removed rows', () => {
  /**
   * Keeping the number is not decoration. It is the position the parcels are
   * sorted in, and renumbering the round before the driver has agreed to
   * anything would destroy the sort.
   */
  test('keep their own sequence number and their own ETA', () => {
    const row = rowsOf(route([removeOf('b')])).find((r) => r.kind === 'removed')
    assert.equal(row?.kind === 'removed' ? row.seq : null, '2')
    assert.ok(row?.kind === 'removed' && /^\d\d:\d\d$/.test(row.eta ?? ''))
  })

  test('and they leave the existing route', () => {
    const rows = rowsOf(route([removeOf('b')]))
    assert.equal(rows.filter((r) => r.kind === 'existing' && r.id === 'b').length, 0)
  })

  /**
   * The two clocks are different clocks. A removed row shows what you are
   * about to lose; an existing row shows what the change would do to it. Read
   * from one plan, a removed stop would print the arrival of whatever now
   * occupies its slot.
   */
  test('a removed row reads the COMMITTED plan, not the preview', () => {
    const r = route([removeOf('a')])
    const rows = rowsOf(r)
    const removed = rows.find((x) => x.kind === 'removed')
    const firstExisting = rows.find((x) => x.kind === 'existing')
    assert.ok(removed?.kind === 'removed' && firstExisting?.kind === 'existing')
    // 'a' was first and 'b' is now first; they cannot both be at the same time.
    assert.notEqual(removed.eta, null)
    assert.notEqual(firstExisting.eta, null)
  })
})

describe('an edited stop', () => {
  test('stays in the route and is marked, rather than being listed twice', () => {
    const rows = rowsOf(route([change({ kind: 'edit', stopId: 'b', patch: { order: 'first' } })]))
    const row = rows.find((r) => r.kind === 'existing' && r.id === 'b')
    assert.equal(row?.kind === 'existing' ? row.edited : null, true)
    assert.deepEqual(sections(rows), ['Existing route'])
  })
})

describe('planIsStale', () => {
  const noon = Date.UTC(2026, 7, 8, 12, 0, 0)

  test('a plan made minutes ago is not stale', () => {
    assert.equal(planIsStale({ dateISO: '2026-08-08', updatedAt: noon - 60_000 }, noon), false)
  })

  /**
   * A round running forty minutes late is the normal case, not something to
   * explain. The hint would become wallpaper if it appeared then.
   */
  test('nor is one running forty minutes late', () => {
    assert.equal(planIsStale({ dateISO: '2026-08-08', updatedAt: noon - 40 * 60_000 }, noon), false)
  })

  test('a plan poked hours later is', () => {
    assert.equal(planIsStale({ dateISO: '2026-08-08', updatedAt: noon - 5 * 3600_000 }, noon), true)
  })

  test('and so is yesterday’s, however recently it was touched', () => {
    const lastNight = Date.UTC(2026, 7, 7, 23, 59, 0)
    assert.equal(planIsStale({ dateISO: '2026-08-07', updatedAt: lastNight }, noon), true)
  })
})
