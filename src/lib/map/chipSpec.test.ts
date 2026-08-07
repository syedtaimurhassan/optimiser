import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressedStop, StopGroup, StopStatus } from '../../types.ts'
import { chipSpecFor, groupColorFor, truncateLabel } from './chipSpec.ts'
import { DEFAULT_GROUP_COLOR, GROUP_COLORS, MAP_COLORS } from './palette.ts'

const GREEN_GROUP: StopGroup = { id: 'g-green', name: 'Green run', colorHex: GROUP_COLORS.green }
const PINK_GROUP: StopGroup = { id: 'g-pink', name: 'Pink run', colorHex: GROUP_COLORS.pink }
const GROUPS = [GREEN_GROUP, PINK_GROUP]

function stop(patch: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id: 'uuid-1',
    stopId: 'D7',
    originalPosition: 7,
    lat: 55.6,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...patch,
  }
}

const spec = (s: AddressedStop, over: Partial<Parameters<typeof chipSpecFor>[0]> = {}) =>
  chipSpecFor({ stop: s, groups: GROUPS, selectedStopId: null, nextStopId: null, ...over })

describe('the group-colour / status rule', () => {
  // This is the milestone's stated CRITICAL DETAIL. If this test fails, the
  // map is lying about which run a stop belongs to at the exact moment the
  // driver cares most.
  test('a FAILED stop in a GREEN group is a GREEN chip with a red ✗ badge', () => {
    const s = stop({ groupId: GREEN_GROUP.id, status: 'failed' })
    const result = spec(s, { selectedStopId: s.id })

    assert.equal(result.fill, GROUP_COLORS.green, 'fill must be the group colour')
    assert.notEqual(result.fill, MAP_COLORS.danger, 'status must never reach the fill')
    assert.equal(result.badge, 'failed', 'status lives on the badge')
  })

  test('a DELIVERED stop in a PINK group is a PINK chip with a ✓ badge', () => {
    const s = stop({ groupId: PINK_GROUP.id, status: 'delivered' })
    const result = spec(s, { selectedStopId: s.id })

    assert.equal(result.fill, GROUP_COLORS.pink)
    assert.notEqual(result.fill, MAP_COLORS.success)
    assert.equal(result.badge, 'delivered')
  })

  test('status changes the badge and nothing else', () => {
    const statuses: StopStatus[] = ['pending', 'delivered', 'failed']
    const specs = statuses.map((status) =>
      spec(stop({ groupId: GREEN_GROUP.id, status, id: 'x' }), { selectedStopId: 'x' }),
    )

    const fills = new Set(specs.map((s) => s.fill))
    assert.equal(fills.size, 1, 'every status must produce the same fill')
    assert.deepEqual(
      specs.map((s) => s.badge),
      ['none', 'delivered', 'failed'],
    )
  })
})

describe('group colour resolution', () => {
  test('no group means the default blue, not grey', () => {
    assert.equal(groupColorFor(stop(), GROUPS), DEFAULT_GROUP_COLOR)
  })

  test('a groupId pointing at a deleted group falls back rather than throwing', () => {
    assert.equal(groupColorFor(stop({ groupId: 'gone' }), GROUPS), DEFAULT_GROUP_COLOR)
  })

  test('a malformed colorHex falls back', () => {
    const bad: StopGroup = { id: 'g', name: 'Bad', colorHex: 'rgb(1,2,3)' }
    assert.equal(groupColorFor(stop({ groupId: 'g' }), [bad]), DEFAULT_GROUP_COLOR)
  })

  test('shorthand hex is accepted and normalised', () => {
    const short: StopGroup = { id: 'g', name: 'Short', colorHex: '#ABC' }
    assert.equal(groupColorFor(stop({ groupId: 'g' }), [short]), '#abc')
  })
})

describe('selection and fill', () => {
  test('unselected is a light chip with a dark number', () => {
    const result = spec(stop({ groupId: GREEN_GROUP.id }))
    assert.equal(result.fill, MAP_COLORS.surface)
    assert.equal(result.textColor, MAP_COLORS.onSurface)
    assert.equal(result.tail, false)
  })

  test('selected fills with the group colour, white number, and grows a tail', () => {
    const s = stop({ groupId: GREEN_GROUP.id })
    const result = spec(s, { selectedStopId: s.id })
    assert.equal(result.fill, GROUP_COLORS.green)
    assert.equal(result.textColor, MAP_COLORS.onPrimary)
    assert.equal(result.tail, true)
  })
})

describe('staged changes', () => {
  test('staged-add is a tailed pin with a + glyph', () => {
    const result = spec(stop(), { staged: 'add' })
    assert.equal(result.glyph, 'plus')
    assert.equal(result.tail, true)
  })

  test('staged-remove is a red chip with a trash glyph that keeps its number', () => {
    const result = spec(stop({ groupId: GREEN_GROUP.id, stopId: 'D7' }), { staged: 'remove' })
    assert.equal(result.fill, MAP_COLORS.danger, 'a staged destruction is the one red fill')
    assert.equal(result.glyph, 'trash')
    assert.equal(result.label, 'D7', 'the number is retained')
  })

  test('a staged removal outranks the stop’s own status for fill', () => {
    const result = spec(stop({ groupId: GREEN_GROUP.id, status: 'delivered' }), { staged: 'remove' })
    assert.equal(result.fill, MAP_COLORS.danger)
    assert.equal(result.dimmed, false, 'a staged edit is not receding into the background')
  })
})

describe('collision priority', () => {
  // MapLibre places LOWER symbol-sort-key first, so lower wins. Easy to invert.
  test('selected beats next beats pending beats delivered', () => {
    const sel = spec(stop({ id: 'a' }), { selectedStopId: 'a' }).sortKey
    const next = spec(stop({ id: 'b' }), { nextStopId: 'b' }).sortKey
    const failed = spec(stop({ id: 'c', status: 'failed' })).sortKey
    const pending = spec(stop({ id: 'd' })).sortKey
    const delivered = spec(stop({ id: 'e', status: 'delivered' })).sortKey

    assert.ok(sel < next, 'the selected stop wins outright')
    assert.ok(next < failed)
    assert.ok(failed < pending, 'a failure outranks ordinary remaining work')
    assert.ok(pending < delivered, 'work still to do outranks work already done')
  })

  test('selection outranks even a staged edit on the same stop', () => {
    const s = stop({ id: 'a' })
    assert.ok(
      spec(s, { selectedStopId: 'a', staged: 'add' }).sortKey <
        spec(stop({ id: 'b' }), { staged: 'add' }).sortKey,
    )
  })
})

describe('the image cache key', () => {
  test('two identical-looking chips share a key', () => {
    const a = spec(stop({ id: 'a', stopId: 'D7' }))
    const b = spec(stop({ id: 'b', stopId: 'D7' }))
    assert.equal(a.key, b.key, 'the key must not embed the stop uuid')
  })

  test('a status change changes the key, so exactly that chip redraws', () => {
    const s = stop({ id: 'a' })
    assert.notEqual(spec(s).key, spec(stop({ id: 'a', status: 'failed' })).key)
  })

  test('every visual field participates in the key', () => {
    const base = stop({ id: 'a', groupId: GREEN_GROUP.id })
    const keys = new Set([
      spec(base).key,
      spec(base, { selectedStopId: 'a' }).key,
      spec(stop({ id: 'a', groupId: PINK_GROUP.id }), { selectedStopId: 'a' }).key,
      spec(base, { staged: 'add' }).key,
      spec(base, { staged: 'remove' }).key,
      spec(stop({ id: 'a', status: 'delivered' })).key,
    ])
    assert.equal(keys.size, 6, 'distinct appearances must not collide in the cache')
  })
})

describe('label truncation', () => {
  test('ordinary stop ids pass through untouched', () => {
    for (const id of ['1', '37', 'D7', 'D7.1', 'AA12']) {
      assert.equal(truncateLabel(id), id)
    }
  })

  test('an absurd id is clipped rather than overflowing the chip', () => {
    assert.equal(truncateLabel('D7.1.2.3.4'), 'D7.1.…')
  })
})
