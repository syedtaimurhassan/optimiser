import type { AddressedStop, StopGroup, StopStatus } from '../types.ts'
import type { GroupColorName } from './map/palette.ts'
import { colorNameFor, titleFor } from './routeList.ts'
import { clockAt } from './routeSummary.ts'
import { formatLatLng } from './coordinates.ts'

/**
 * The stop card, as data.
 *
 * ── The rule this module exists to enforce ────────────────────────────────
 *
 * The primary slot always holds exactly ONE thing: the most relevant next
 * action for this stop's state. Nothing is hidden, and nothing is
 * disabled-but-present — things MOVE between prominence levels.
 *
 * A pending stop's primary slot is the three-up row, and Navigate is the
 * filled blue one in it. The moment the stop is delivered or failed, that row
 * is REPLACED by the completion card, and Navigate is demoted into the grey
 * block — because navigating to a stop you have already been to is a thing you
 * might still want, and not a thing you are about to do.
 *
 * Written here rather than as conditionals inside the card because "which
 * actions are prominent right now" is the design, and a design invariant that
 * only exists as JSX is one nobody can assert. `stopDetail.test.ts` asserts
 * that Navigate is in exactly one of the two places, never both and never
 * neither.
 *
 * ── The two colours still never cross ─────────────────────────────────────
 *
 * The dot is the GROUP. The pill is the STATUS. A failed stop in a green group
 * shows a green dot beside a red "Failed" pill — the same rule `StopRow` and
 * `chipSpec` follow, and the reason a group-coloured dot next to a failed
 * counter is worth a line in the acceptance suite.
 */

/** What occupies the card's primary slot. Exactly one of these, always. */
export type PrimarySlot =
  | { kind: 'actions' }
  | {
      kind: 'completion'
      status: 'delivered' | 'failed'
      /** "Marked as delivered" / "Marked as failed". */
      label: string
      /** "16:13", or null when the history predates timestamps. */
      at: string | null
    }

export interface StatusLineModel {
  /** The group's palette name — the dot, and nothing else on this line. */
  color: GroupColorName
  /** "38/44". */
  counter: string
  /**
   * "16:03", or null.
   *
   * Dropped entirely once the stop is done, which is the best small decision
   * in Spoke's design: an estimated arrival at a place you have already been
   * is not stale information, it is noise, and removing it is what makes the
   * completed state read as finished rather than as a stop with a wrong time.
   */
  eta: string | null
  pill: { label: string; status: 'delivered' | 'failed' } | null
}

/** The grey block's ordinary actions. `remove` is always the destructive tail. */
export type DemotedActionId = 'edit' | 'navigate' | 'duplicate'

export interface StopDetailModel {
  title: string
  statusLine: StatusLineModel
  primary: PrimarySlot
  demoted: DemotedActionId[]
  /** "Bagsværd, 2880", or the coordinates when the stop has no address. */
  area: string
  /** "ID D7 · Originally 37th". */
  idLine: string
  /** The driver's own note, or null — which renders as the greyed empty state. */
  notes: string | null
  /** True once the information rows should recede. */
  done: boolean
}

export interface StopDetailInput {
  stop: AddressedStop
  /** 1-based position in the route. */
  position: number
  /** How many stops the route has. */
  total: number
  groups: StopGroup[]
  /** Predicted arrival, epoch ms, or null when the route has no arrivals yet. */
  etaMs?: number | null
}

const PILL: Record<'delivered' | 'failed', string> = {
  delivered: 'Delivered',
  failed: 'Failed',
}

const COMPLETION: Record<'delivered' | 'failed', string> = {
  delivered: 'Marked as delivered',
  failed: 'Marked as failed',
}

export function stopDetailModel({
  stop,
  position,
  total,
  groups,
  etaMs = null,
}: StopDetailInput): StopDetailModel {
  const done = stop.status !== 'pending'
  const finished = done ? (stop.status as 'delivered' | 'failed') : null

  return {
    title: titleFor(stop),
    statusLine: {
      color: colorNameFor(stop, groups),
      counter: `${position}/${total}`,
      eta: done || etaMs === null ? null : clockAt(etaMs),
      pill: finished ? { label: PILL[finished], status: finished } : null,
    },
    primary: finished
      ? {
          kind: 'completion',
          status: finished,
          label: COMPLETION[finished],
          at: statusChangedAt(stop, finished),
        }
      : { kind: 'actions' },
    // Navigate is in the row when pending and in the block when done. It is
    // never in both, and never in neither.
    demoted: finished ? ['edit', 'navigate', 'duplicate'] : ['edit', 'duplicate'],
    area: areaFor(stop),
    idLine: `ID ${stop.stopId} · Originally ${ordinal(stop.originalPosition)}`,
    notes: stop.notes?.trim() || null,
    done,
  }
}

/**
 * When the stop last entered its current state.
 *
 * Read backwards from the end of the history, not forwards: a stop marked
 * failed, undone, and failed again should report the SECOND attempt. The
 * history is append-only precisely so this answer exists.
 */
function statusChangedAt(stop: AddressedStop, status: StopStatus): string | null {
  for (let i = stop.statusHistory.length - 1; i >= 0; i--) {
    if (stop.statusHistory[i].status === status) return clockAt(stop.statusHistory[i].atMs)
  }
  return null
}

function areaFor(stop: AddressedStop): string {
  const subtitle = stop.address?.subtitle?.trim()
  if (subtitle) return subtitle
  const area = [stop.address?.area, stop.address?.postcode].filter(Boolean).join(', ')
  return area || formatLatLng({ lat: stop.lat, lng: stop.lng })
}

/**
 * "37th" — because "Originally 37" reads like an ID, which is the one thing
 * this line exists to distinguish itself from.
 */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}
