import type { AddressedStop } from '../types.ts'

/**
 * Why a delivery failed.
 *
 * ── This is ours, not Spoke's ─────────────────────────────────────────────
 *
 * Spoke's screenshots show the failed STATE but never the capture, so the flow
 * is designed rather than copied. Two decisions, both about what happens at a
 * kerb with the engine running:
 *
 *  1. The tap marks the stop IMMEDIATELY. The reason sheet is a follow-up, and
 *     dismissing it leaves the stop failed with no reason. A modal that stands
 *     between the driver and the action they asked for is a modal that gets
 *     dismissed by reflex, and then the status is wrong — which is worse than
 *     a missing reason, because a missing reason is visibly missing and a
 *     wrong status is not.
 *  2. The list is short and covers the whole space. Five options, one of which
 *     is "Other" with free text. A picklist a driver has to read past six
 *     entries to use is a picklist that gets "Other" every time.
 *
 * The wording is deliberately about the WORLD, not about blame: "Nobody home"
 * rather than "Customer unavailable". These strings end up in a message to a
 * dispatcher, and a driver should not have to accuse anyone to file one.
 */

export interface FailureReason {
  id: string
  label: string
  /** Opens the free-text field. Exactly one option does. */
  freeText?: boolean
}

export const FAILURE_REASONS: FailureReason[] = [
  { id: 'nobody-home', label: 'Nobody home' },
  { id: 'address-not-found', label: 'Could not find the address' },
  { id: 'access-blocked', label: 'No access to the building' },
  { id: 'refused', label: 'Refused on delivery' },
  { id: 'other', label: 'Something else', freeText: true },
]

export const OTHER_REASON_ID = 'other'

export function reasonLabel(id: string | undefined): string | null {
  if (!id) return null
  return FAILURE_REASONS.find((r) => r.id === id)?.label ?? null
}

/**
 * The one line the completion card shows.
 *
 * "Nobody home — tried the back door too" reads as one fact. A reason and a
 * note stacked as two lines would imply they are separate fields the driver
 * chose to fill in, when in practice the note qualifies the reason.
 *
 * A note with no reason is still worth showing: it is what the driver actually
 * typed, and dropping it because the picklist was skipped would lose the only
 * information there is.
 */
export function describeFailure(
  stop: Pick<AddressedStop, 'failureReason' | 'failureNote'>,
): string | null {
  const label = reasonLabel(stop.failureReason)
  const note = stop.failureNote?.trim()
  if (label && note) return `${label} — ${note}`
  // `||`, not `??`: a note of pure whitespace trims to "", which is neither
  // null nor undefined, so `??` would fall through and hand the completion
  // card an empty string to render as a blank line under a divider.
  return label || note || null
}
