import type { Route } from '../types.ts'
import { visitOrder } from './routeOrder.ts'
import { formatSeq, titleFor } from './routeList.ts'
import { formatLatLng } from './coordinates.ts'
import { describeWindow } from './stopSettings.ts'

/**
 * The round, as paper.
 *
 * ── Why this exists at all ────────────────────────────────────────────────
 *
 * `window.print()` on the app as it stands produces nothing usable. The sheet
 * is positioned with a transform, its list is virtualised to about fifteen
 * rows, and the map is a WebGL canvas — so a printed page would be a screenshot
 * of a phone showing a fraction of the round. Printing needs its own rendering
 * of the whole route, and that means its own view model.
 *
 * ── What goes on the page ─────────────────────────────────────────────────
 *
 * What survives being carried around a van on paper: the sequence, the
 * immutable ID a driver can write on a parcel, the address, and the handful of
 * things that change what happens at the door — a time window, a note, an
 * access code, more than one parcel. Everything else is app furniture.
 */

export interface PrintRow {
  /** "01" — zero-padded to the width of the largest, so the column aligns. */
  seq: string
  /** The immutable label. This is the whole point of printing. */
  stopId: string
  title: string
  subtitle: string
  /** One line of everything that changes what happens at the door, or ''. */
  detail: string
  /** "✓", "✗", or '' — a printed round is worked on and marked up. */
  mark: string
}

export interface PrintModel {
  routeName: string
  dateISO: string
  /** "44 stops · 2 delivered · 1 failed". */
  summary: string
  rows: PrintRow[]
}

const MARK = { pending: '', delivered: '✓', failed: '✗' } as const

export function printModel(route: Route): PrintModel {
  const ordered = visitOrder(route)
  const delivered = ordered.filter((s) => s.status === 'delivered').length
  const failed = ordered.filter((s) => s.status === 'failed').length

  const summary = [
    `${ordered.length} stop${ordered.length === 1 ? '' : 's'}`,
    delivered > 0 ? `${delivered} delivered` : null,
    failed > 0 ? `${failed} failed` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    routeName: route.name,
    dateISO: route.dateISO,
    summary,
    rows: ordered.map((stop, index) => ({
      seq: formatSeq(index + 1, ordered.length),
      stopId: stop.stopId,
      title: titleFor(stop),
      subtitle: stop.address?.subtitle?.trim() || formatLatLng({ lat: stop.lat, lng: stop.lng }),
      detail: detailLine(stop),
      mark: MARK[stop.status],
    })),
  }
}

function detailLine(stop: Route['stops'][number]): string {
  const parts: string[] = []
  if (stop.kind === 'pickup') parts.push('PICKUP')
  if ((stop.parcelCount ?? 1) > 1) parts.push(`${stop.parcelCount} parcels`)
  if (stop.twOpenSec !== undefined || stop.twCloseSec !== undefined) {
    parts.push(describeWindow(stop.twOpenSec, stop.twCloseSec))
  }
  // The access code is on the paper on purpose. A printed round is the fallback
  // for a dead phone, and a door code left in the app it is a fallback FOR is
  // no fallback at all.
  if (stop.accessCodes?.trim()) parts.push(`Code ${stop.accessCodes.trim()}`)
  if (stop.packageFinder?.trim()) parts.push(stop.packageFinder.trim())
  if (stop.notes?.trim()) parts.push(stop.notes.trim())
  return parts.join(' · ')
}

/**
 * The route as plain text, for Web Share or the clipboard.
 *
 * Built on `printModel` rather than beside it, because "what survives being
 * carried around a van" is the same question whether the answer is printed or
 * pasted into a message — and two independent answers would drift.
 *
 * Plain text, not a link. There is no server to host a route on, so a shared
 * copy is the content itself; anything else would be a URL to nothing.
 */
export function routeShareText(route: Route): string {
  const model = printModel(route)
  const lines = [`${model.routeName} — ${model.dateISO}`, model.summary, '']
  for (const row of model.rows) {
    const mark = row.mark ? `${row.mark} ` : ''
    const detail = row.detail ? `\n     ${row.detail}` : ''
    lines.push(`${row.seq}. ${mark}[${row.stopId}] ${row.title}, ${row.subtitle}${detail}`)
  }
  return lines.join('\n')
}
