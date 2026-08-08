import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ordinal, stopDetailModel } from './stopDetail.ts'
import type { AddressedStop, StopGroup } from '../types.ts'

const GREEN: StopGroup = { id: 'g', name: 'Green run', colorHex: '#12823c' }

/** 16:13 on an arbitrary day, in the machine's own timezone. */
const at = (h: number, m: number) => new Date(2026, 7, 8, h, m).getTime()

function stop(over: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id: 's1',
    stopId: 'D7',
    originalPosition: 37,
    lat: 55.68,
    lng: 12.53,
    address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', source: 'geocoder' },
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...over,
  }
}

const model = (s: AddressedStop, over: Partial<Parameters<typeof stopDetailModel>[0]> = {}) =>
  stopDetailModel({ stop: s, position: 38, total: 44, groups: [GREEN], ...over })

test('a pending stop puts the three-up row in the primary slot', () => {
  const m = model(stop())
  assert.equal(m.primary.kind, 'actions')
  assert.equal(m.statusLine.pill, null)
})

test('a pending stop shows its position then its ETA', () => {
  const m = model(stop(), { etaMs: at(16, 3) })
  assert.equal(m.statusLine.counter, '38/44')
  assert.equal(m.statusLine.eta, '16:03')
})

test('a delivered stop drops the ETA', () => {
  const m = model(
    stop({ status: 'delivered', statusHistory: [{ status: 'delivered', atMs: at(16, 13) }] }),
    { etaMs: at(16, 3) },
  )
  assert.equal(m.statusLine.eta, null)
  assert.deepEqual(m.statusLine.pill, { label: 'Delivered', status: 'delivered' })
})

test('a delivered stop replaces the action row with a completion card', () => {
  const m = model(
    stop({ status: 'delivered', statusHistory: [{ status: 'delivered', atMs: at(16, 13) }] }),
  )
  assert.equal(m.primary.kind, 'completion')
  if (m.primary.kind !== 'completion') return
  assert.equal(m.primary.label, 'Marked as delivered')
  assert.equal(m.primary.at, '16:13')
})

test('Navigate is in exactly one place, and which one depends on the state', () => {
  const pending = model(stop())
  assert.equal(pending.primary.kind, 'actions')
  assert.ok(!pending.demoted.includes('navigate'), 'pending must not demote Navigate')

  for (const status of ['delivered', 'failed'] as const) {
    const done = model(stop({ status, statusHistory: [{ status, atMs: at(16, 13) }] }))
    assert.equal(done.primary.kind, 'completion')
    assert.ok(done.demoted.includes('navigate'), `${status} must demote Navigate`)
  }
})

test('the demoted block keeps its order and never contains the destructive item', () => {
  assert.deepEqual(model(stop()).demoted, ['edit', 'duplicate'])
  assert.deepEqual(
    model(stop({ status: 'failed', statusHistory: [{ status: 'failed', atMs: 1 }] })).demoted,
    ['edit', 'navigate', 'duplicate'],
  )
})

test('a failed stop still carries its GROUP colour, not a status colour', () => {
  const m = model(stop({ status: 'failed', groupId: 'g', statusHistory: [{ status: 'failed', atMs: 1 }] }))
  assert.equal(m.statusLine.color, 'green')
  assert.equal(m.statusLine.pill?.status, 'failed')
})

test('a re-failed stop reports the second attempt, not the first', () => {
  const m = model(
    stop({
      status: 'failed',
      statusHistory: [
        { status: 'failed', atMs: at(9, 5) },
        { status: 'pending', atMs: at(9, 6) },
        { status: 'failed', atMs: at(16, 40) },
      ],
    }),
  )
  assert.equal(m.primary.kind === 'completion' && m.primary.at, '16:40')
})

test('a history with no matching entry yields no timestamp rather than a wrong one', () => {
  const m = model(stop({ status: 'delivered', statusHistory: [] }))
  assert.equal(m.primary.kind === 'completion' && m.primary.at, null)
})

test('the ID line distinguishes the label from the original position', () => {
  assert.equal(model(stop()).idLine, 'ID D7 · Originally 37th')
})

test('an empty note is null, so the row can render its greyed empty state', () => {
  assert.equal(model(stop({ notes: '   ' })).notes, null)
  assert.equal(model(stop({ notes: 'bike + boks' })).notes, 'bike + boks')
})

test('a coordinate-only stop falls back to coordinates for the area row', () => {
  assert.match(model(stop({ address: undefined })).area, /55\.68/)
})

test('ordinals', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th'],
  )
})
