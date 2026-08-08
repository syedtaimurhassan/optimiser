import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROUP_PRESETS,
  SWATCH_COLORS,
  autoGroupFor,
  isAutoGroup,
  presetFor,
  presetHex,
  retargetGroup,
} from './groups.ts'
import { GROUP_COLORS } from './map/palette.ts'
import type { StopGroup } from '../types.ts'

const pickupGroup: StopGroup = {
  id: 'g-pickup',
  name: 'Afternoon Pickup',
  colorHex: GROUP_COLORS.purple,
}
const multiGroup: StopGroup = {
  id: 'g-multi',
  name: 'Multiple parcels',
  colorHex: GROUP_COLORS.teal,
}
const chosen: StopGroup = { id: 'g-mine', name: 'Flats on Elm', colorHex: GROUP_COLORS.pink }

test('a pickup wants purple, a multi-parcel delivery wants teal', () => {
  assert.equal(autoGroupFor({ kind: 'pickup', parcelCount: 1 }), 'pickup')
  assert.equal(autoGroupFor({ kind: 'delivery', parcelCount: 3 }), 'multiPackage')
  assert.equal(autoGroupFor({ kind: 'delivery', parcelCount: 1 }), null)
  assert.equal(autoGroupFor({ kind: 'delivery' }), null)
})

test('a pickup with three parcels is a PICKUP', () => {
  assert.equal(autoGroupFor({ kind: 'pickup', parcelCount: 3 }), 'pickup')
})

test('the swatches never duplicate the default or an automatic colour', () => {
  const autoColors = GROUP_PRESETS.filter((p) => p.auto).map((p) => p.color)
  for (const color of SWATCH_COLORS) {
    assert.ok(!autoColors.includes(color), `${color} is already an automatic group`)
    assert.notEqual(color, 'blue')
  }
})

test('an automatic group is recognised by name AND colour', () => {
  assert.equal(isAutoGroup(pickupGroup), true)
  assert.equal(isAutoGroup(chosen), false)
  assert.equal(isAutoGroup(undefined), false)
  // Same name, someone recoloured it: no longer ours to move stops out of.
  assert.equal(isAutoGroup({ ...pickupGroup, colorHex: GROUP_COLORS.pink }), false)
})

test('an ungrouped stop that becomes a pickup is moved into purple', () => {
  assert.deepEqual(retargetGroup({ kind: 'pickup', parcelCount: 1 }, []), { auto: 'pickup' })
})

test('a DELIBERATE group is never overwritten', () => {
  assert.equal(
    retargetGroup({ kind: 'pickup', parcelCount: 4, groupId: chosen.id }, [chosen]),
    null,
  )
})

test('a stop that stops qualifying leaves the automatic group it was put in', () => {
  assert.deepEqual(
    retargetGroup({ kind: 'delivery', parcelCount: 1, groupId: pickupGroup.id }, [pickupGroup]),
    { clear: true },
  )
})

test('…but a deliberate group survives no longer qualifying for anything', () => {
  assert.equal(
    retargetGroup({ kind: 'delivery', parcelCount: 1, groupId: chosen.id }, [chosen]),
    null,
  )
})

test('a pickup already in the pickup group is left alone', () => {
  assert.equal(
    retargetGroup({ kind: 'pickup', parcelCount: 1, groupId: pickupGroup.id }, [pickupGroup]),
    null,
  )
})

test('a multi-parcel stop that becomes a pickup moves from teal to purple', () => {
  assert.deepEqual(
    retargetGroup({ kind: 'pickup', parcelCount: 3, groupId: multiGroup.id }, [multiGroup]),
    { auto: 'pickup' },
  )
})

test('presets resolve to a palette hex', () => {
  assert.equal(presetHex(presetFor('pickup')), GROUP_COLORS.purple)
  assert.equal(presetHex(presetFor('multiPackage')), GROUP_COLORS.teal)
})
