import type { AddressedStop, StopGroup } from '../types.ts'
import { GROUP_COLORS, type GroupColorName } from './map/palette.ts'

/**
 * Stop groups: the presets, and the rules that apply them on their own.
 *
 * ── What a group IS ───────────────────────────────────────────────────────
 *
 * A colour that means something to the driver, propagated to every place the
 * stop appears — the ID chip in the list, the dot on the stop card, and the
 * marker's fill on the map. One glance at the map should answer "which of
 * these are the afternoon pickups" without reading a single label.
 *
 * Groups are ROUTE-SCOPED. `Route.groups` holds them and `stop.groupId` points
 * into it, which is why duplicating a route copies the groups verbatim: the
 * ids have to keep resolving. It is also why a group is not part of a saved
 * address default — the same address next week is on a different route with a
 * different group table.
 *
 * ── The two automatic groups ──────────────────────────────────────────────
 *
 * Purple follows pickups; teal follows multi-parcel stops. Both are properties
 * a driver already has to know about the stop, so having to also remember to
 * colour it is busywork the app can do.
 *
 * The rule that stops this being annoying: an automatic group NEVER overwrites
 * a deliberate one. Auto-assignment only applies when the stop is ungrouped or
 * is already in one of the automatic groups — so choosing "Afternoon Pickup"
 * by hand survives changing the parcel count, and choosing nothing survives
 * everything.
 *
 * Pickup wins a tie with multi-parcel: a pickup with three parcels is a
 * PICKUP, which is a fact about what the driver does there, and the parcel
 * count is a detail of it.
 */

/** An automatic group's role, which is also how we recognise it later. */
export type AutoGroup = 'pickup' | 'multiPackage'

export interface GroupPreset {
  name: string
  color: GroupColorName
  auto?: AutoGroup
}

/**
 * The named presets, in chip-row order.
 *
 * "Default" is not in here because it is not a group: an ungrouped stop is in
 * the default group, which is blue, and is the same blue as the primary
 * action. Storing a group to mean "no group" would put a row in every route's
 * group table that exists only to be empty.
 */
export const GROUP_PRESETS: GroupPreset[] = [
  { name: 'Afternoon Pickup', color: 'purple', auto: 'pickup' },
  { name: 'Multiple parcels', color: 'teal', auto: 'multiPackage' },
]

/**
 * The colour-only swatches that follow the named presets in the chip row.
 *
 * Deliberately the palette MINUS blue (that is the default) and minus the two
 * automatic colours — offering purple as a nameless swatch beside "Afternoon
 * Pickup" would create two purple groups that mean different things.
 */
export const SWATCH_COLORS: GroupColorName[] = ['green', 'pink', 'amber']

export const presetFor = (auto: AutoGroup): GroupPreset =>
  GROUP_PRESETS.find((p) => p.auto === auto) as GroupPreset

/** The hex a preset renders as. Groups store hex; the UI wants palette names. */
export const presetHex = (preset: GroupPreset): string => GROUP_COLORS[preset.color]

/** Which automatic group a stop qualifies for, if any. */
export function autoGroupFor(stop: Pick<AddressedStop, 'kind' | 'parcelCount'>): AutoGroup | null {
  if (stop.kind === 'pickup') return 'pickup'
  if ((stop.parcelCount ?? 1) > 1) return 'multiPackage'
  return null
}

/** True when `group` is one of the automatic ones, by name and colour. */
export function isAutoGroup(group: StopGroup | undefined): boolean {
  if (!group) return false
  return GROUP_PRESETS.some(
    (p) => p.auto !== undefined && p.name === group.name && presetHex(p) === group.colorHex,
  )
}

/**
 * The group a stop should end up in after `kind` or `parcelCount` changed.
 *
 * Returns:
 *   `{ auto }`      move it into that automatic group (creating it if needed)
 *   `{ clear: true }` take it out of the automatic group it no longer qualifies for
 *   `null`          leave it exactly where it is
 *
 * Expressed as a decision rather than performed here, because creating a group
 * is a store write and this module never touches the store.
 */
export type GroupRetarget = { auto: AutoGroup } | { clear: true } | null

export function retargetGroup(
  stop: Pick<AddressedStop, 'kind' | 'parcelCount' | 'groupId'>,
  groups: StopGroup[],
): GroupRetarget {
  const current = groups.find((g) => g.id === stop.groupId)
  // A deliberate choice is never overwritten. This is the whole reason the
  // automatic groups are usable at all.
  if (current && !isAutoGroup(current)) return null

  const wanted = autoGroupFor(stop)
  if (wanted === null) return current ? { clear: true } : null

  const target = presetFor(wanted)
  if (current && current.name === target.name) return null
  return { auto: wanted }
}
