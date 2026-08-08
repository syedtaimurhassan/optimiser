import type { Address, AddressDefault, AddressedStop, LatLng } from '../types.ts'
import { foldForSearch } from './searchScreen.ts'

/**
 * "Set Default ☆" — this stop's settings, remembered for this address.
 *
 * ── Why this saves real work ──────────────────────────────────────────────
 *
 * The same addresses come round again. A door code, a "parcels go in the bin
 * store round the back", a stop that always takes five minutes because it is
 * on the fourth floor — these are facts about the PLACE, not about today's
 * parcel, and re-entering them every time the address reappears is the kind of
 * repetition that makes people stop entering them at all.
 *
 * So defaults are keyed on the address and stored globally, not per route:
 * "across days" is the entire point. They are applied at stop CREATION, which
 * is why a route imported from a manifest arrives already knowing the codes.
 *
 * ── What is deliberately NOT remembered ───────────────────────────────────
 *
 *  - `groupId`. Groups are route-scoped; the id would resolve to a different
 *    group, or to nothing, on tomorrow's route.
 *  - `notes` and `recipient`. Those belong to a delivery, not to a door. A
 *    note reading "leave with next door, they're expecting it" reappearing on
 *    an unrelated parcel three weeks later would be actively misleading.
 *  - status, of course.
 */

/**
 * The key an address is remembered under.
 *
 * Folded with the SAME folding the search screen uses, which matters more than
 * it looks: `ø` and `æ` have no canonical decomposition, so a naive
 * lowercase-and-strip leaves "Løvfrøvej 6" and "Lovfrovej 6" as different
 * doors. Reusing that function means a default saved from a geocoded address
 * still matches the same address typed by hand from an ASCII keyboard.
 *
 * A coordinate-only stop is keyed on its rounded position instead — five
 * decimal places is about a metre, which is the same door and not the next
 * one. Dropping those stops from the mechanic entirely would mean a driver who
 * works from a coordinate file never gets to save a door code.
 */
export function addressKey(address: Address | undefined, point: LatLng): string | null {
  const title = address?.title?.trim()
  if (title) {
    const area = address?.postcode?.trim() || address?.subtitle?.trim() || ''
    return `addr:${foldForSearch(title)}|${foldForSearch(area)}`
  }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null
  return `coord:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

/** The subset of a stop worth remembering for next time. */
export function defaultsFromStop(stop: AddressedStop, nowMs: number): AddressDefault {
  return {
    kind: stop.kind,
    order: stop.order,
    parcelCount: stop.parcelCount,
    serviceTimeSec: stop.serviceTimeSec,
    accessCodes: stop.accessCodes?.trim() || undefined,
    packageFinder: stop.packageFinder?.trim() || undefined,
    twOpenSec: stop.twOpenSec,
    twCloseSec: stop.twCloseSec,
    updatedAt: nowMs,
  }
}

/**
 * Apply a saved default to a freshly created stop.
 *
 * Only fills fields the stop does not already have. An importer that supplied
 * a parcel count knows more about today than a default saved a month ago, and
 * silently overwriting it would make the import look broken.
 */
export function applyDefault<T extends Partial<AddressedStop>>(
  stop: T,
  saved: AddressDefault | undefined,
): T {
  if (!saved) return stop
  return {
    ...stop,
    kind: stop.kind ?? saved.kind,
    order: stop.order ?? saved.order,
    parcelCount: stop.parcelCount ?? saved.parcelCount,
    serviceTimeSec: stop.serviceTimeSec ?? saved.serviceTimeSec,
    accessCodes: stop.accessCodes ?? saved.accessCodes,
    packageFinder: stop.packageFinder ?? saved.packageFinder,
    twOpenSec: stop.twOpenSec ?? saved.twOpenSec,
    twCloseSec: stop.twCloseSec ?? saved.twCloseSec,
  }
}

/**
 * True when the stop still matches what was saved for its address.
 *
 * Drives the star's filled/hollow state. Comparing the VALUES rather than
 * storing a flag on the stop is what keeps the star honest after an edit:
 * change the parcel count and the star hollows out, because the stop no longer
 * is what the address defaults to.
 */
export function matchesDefault(stop: AddressedStop, saved: AddressDefault | undefined): boolean {
  if (!saved) return false
  const now = defaultsFromStop(stop, saved.updatedAt)
  return (
    now.kind === saved.kind &&
    now.order === saved.order &&
    now.parcelCount === saved.parcelCount &&
    now.serviceTimeSec === saved.serviceTimeSec &&
    now.accessCodes === saved.accessCodes &&
    now.packageFinder === saved.packageFinder &&
    now.twOpenSec === saved.twOpenSec &&
    now.twCloseSec === saved.twCloseSec
  )
}
