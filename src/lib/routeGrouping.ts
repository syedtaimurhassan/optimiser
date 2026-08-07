import type { StopStatus } from '../types'

/**
 * Dates and grouping for the routes drawer.
 *
 * Framework-free by the layering rule, and pure by choice: every function
 * takes "today" as an argument rather than reading the clock, so the section a
 * route lands in is testable without freezing time.
 *
 * ── Why the locale is pinned ──────────────────────────────────────────────
 *
 * The design specifies "Wed 05 Aug" — day before month, zero-padded. That is
 * en-GB. Following the device locale would silently reformat it to "Aug 05" on
 * a US phone and break the label the design depends on, so the locale is
 * fixed here and the day number is assembled by hand (en-GB's own short format
 * inserts a comma after the weekday).
 */
const LOCALE = 'en-GB'

const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(LOCALE, { month: 'long' })

// ─────────────────────────────────────────────────────────────────── dates

/**
 * `Date` → `yyyy-mm-dd`, in LOCAL time.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which is UTC: at 22:30 on a
 * summer evening in Copenhagen that returns tomorrow's date, so a route
 * created from the "Today" option would be filed under the wrong day and then
 * appear in the wrong drawer section. The whole model keys on this string.
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `yyyy-mm-dd` → a local-midnight `Date`. `new Date(iso)` would parse as UTC. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** "Wednesday" — the default name for a route created on that day. */
export function weekdayName(iso: string): string {
  return weekdayLong.format(parseISODate(iso))
}

/** "Wed 05 Aug" — the date-option label, which carries weekday AND date. */
export function formatDayLabel(iso: string): string {
  const date = parseISODate(iso)
  return `${weekdayShort.format(date)} ${String(date.getDate()).padStart(2, '0')} ${monthShort.format(date)}`
}

/** "05 Aug" — the compact form for a route row, where the name is beside it. */
export function formatShortDate(iso: string): string {
  const date = parseISODate(iso)
  return `${String(date.getDate()).padStart(2, '0')} ${monthShort.format(date)}`
}

/** "Today" / "Tomorrow", or null when the date is neither. */
export function relativeDayName(iso: string, todayISO: string): 'Today' | 'Tomorrow' | null {
  if (iso === todayISO) return 'Today'
  if (iso === addDaysISO(todayISO, 1)) return 'Tomorrow'
  return null
}

/**
 * The Monday of the week containing `iso`.
 *
 * Monday-start rather than Sunday-start: this is a working-week app, and a
 * Sunday boundary would split Saturday's round away from the week it belongs
 * to every single weekend.
 */
export function startOfWeekISO(iso: string): string {
  const date = parseISODate(iso)
  const dayOfWeek = date.getDay() // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7
  return addDaysISO(iso, -daysSinceMonday)
}

/** "July" this year, "July 2025" otherwise — the year only when it disambiguates. */
export function formatMonthLabel(iso: string, todayISO: string): string {
  const date = parseISODate(iso)
  const name = monthLong.format(date)
  return date.getFullYear() === parseISODate(todayISO).getFullYear()
    ? name
    : `${name} ${date.getFullYear()}`
}

// ──────────────────────────────────────────────────────────────── sections

export type RouteSectionKind = 'upcoming' | 'week' | 'month'

export interface RouteSection<T> {
  /** Stable React key. */
  key: string
  kind: RouteSectionKind
  title: string
  routes: T[]
}

/** The minimum a route must expose to be grouped and sorted. */
export interface GroupableRoute {
  dateISO: string
  updatedAt: number
}

/**
 * Group routes into the drawer's section headers, newest first.
 *
 *   Upcoming            dated after today
 *   Earlier this week   from Monday up to and including today
 *   <Month>             everything older, one section per month
 *
 * "Upcoming" is an addition to the specified design, not decoration: the
 * create-route flow offers "Tomorrow", so a future-dated route exists the
 * moment someone uses it, and "Earlier this week" is a false statement about
 * a route that hasn't happened yet.
 *
 * Sections come out in date order without a second sort because the buckets
 * are contiguous in a newest-first list: every future date precedes today,
 * which precedes this week's Monday, which precedes every older month.
 */
export function groupRoutesByRecency<T extends GroupableRoute>(
  routes: T[],
  todayISO: string,
): RouteSection<T>[] {
  const weekStart = startOfWeekISO(todayISO)

  const sorted = [...routes].sort(
    (a, b) => b.dateISO.localeCompare(a.dateISO) || b.updatedAt - a.updatedAt,
  )

  const sections: RouteSection<T>[] = []

  for (const route of sorted) {
    let key: string
    let kind: RouteSectionKind
    let title: string

    if (route.dateISO > todayISO) {
      key = 'upcoming'
      kind = 'upcoming'
      title = 'Upcoming'
    } else if (route.dateISO >= weekStart) {
      key = 'week'
      kind = 'week'
      title = 'Earlier this week'
    } else {
      key = `month-${route.dateISO.slice(0, 7)}`
      kind = 'month'
      title = formatMonthLabel(route.dateISO, todayISO)
    }

    const open = sections[sections.length - 1]
    if (open?.key === key) open.routes.push(route)
    else sections.push({ key, kind, title, routes: [route] })
  }

  return sections
}

// ───────────────────────────────────────────────────────────────── summary

export interface StopSummary {
  total: number
  delivered: number
  failed: number
  pending: number
}

export function summariseStops(stops: readonly { status: StopStatus }[]): StopSummary {
  let delivered = 0
  let failed = 0
  for (const stop of stops) {
    if (stop.status === 'delivered') delivered += 1
    else if (stop.status === 'failed') failed += 1
  }
  return { total: stops.length, delivered, failed, pending: stops.length - delivered - failed }
}

/**
 * "44 stops · 42 delivered · 2 failed".
 *
 * Spoke's route rows carry no summary at all, which means deciding whether
 * yesterday's round is finished requires opening it. Zero counts are dropped
 * rather than printed as "0 delivered" — on a fresh route the interesting fact
 * is the stop count, and three segments where two are zeroes is noise.
 *
 * The drawer renders these segments itself so the failed count can be red;
 * this string is the accessible label for the row.
 */
export function formatStopSummary(summary: StopSummary): string {
  if (summary.total === 0) return 'No stops yet'
  const parts = [`${summary.total} stop${summary.total === 1 ? '' : 's'}`]
  if (summary.delivered > 0) parts.push(`${summary.delivered} delivered`)
  if (summary.failed > 0) parts.push(`${summary.failed} failed`)
  return parts.join(' · ')
}
