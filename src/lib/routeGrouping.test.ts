import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDaysISO,
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  formatStopSummary,
  groupRoutesByRecency,
  parseISODate,
  relativeDayName,
  startOfWeekISO,
  summariseStops,
  toISODate,
  weekdayName,
} from './routeGrouping.ts'
import type { StopStatus } from '../types.ts'

// Wednesday 5 August 2026 — the date the design's examples are written from.
const TODAY = '2026-08-05'

describe('ISO dates are local, not UTC', () => {
  test('round-trips a local date', () => {
    assert.equal(toISODate(new Date(2026, 7, 5)), '2026-08-05')
  })

  test('late evening still reports the local day', () => {
    // 23:30 local on the 5th is the 6th in UTC anywhere east of Greenwich.
    // toISOString().slice(0,10) would file this route under the wrong day.
    assert.equal(toISODate(new Date(2026, 7, 5, 23, 30)), '2026-08-05')
  })

  test('parses to local midnight, not UTC midnight', () => {
    const date = parseISODate('2026-08-05')
    assert.equal(date.getFullYear(), 2026)
    assert.equal(date.getMonth(), 7)
    assert.equal(date.getDate(), 5)
    assert.equal(date.getHours(), 0)
  })

  test('addDaysISO crosses months and years', () => {
    assert.equal(addDaysISO('2026-08-05', 1), '2026-08-06')
    assert.equal(addDaysISO('2026-08-31', 1), '2026-09-01')
    assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01')
    assert.equal(addDaysISO('2026-01-01', -1), '2025-12-31')
  })

  test('addDaysISO survives a DST transition', () => {
    // Europe/Copenhagen springs forward on 29 March 2026. Adding a day by
    // milliseconds would land at 23:00 the previous evening.
    assert.equal(addDaysISO('2026-03-28', 1), '2026-03-29')
    assert.equal(addDaysISO('2026-03-29', 1), '2026-03-30')
  })
})

describe('labels', () => {
  test('weekday name is the default route name', () => {
    assert.equal(weekdayName('2026-08-05'), 'Wednesday')
    assert.equal(weekdayName('2026-08-06'), 'Thursday')
  })

  test('day label carries weekday and date, with no comma', () => {
    assert.equal(formatDayLabel('2026-08-05'), 'Wed 05 Aug')
    assert.equal(formatDayLabel('2026-08-06'), 'Thu 06 Aug')
  })

  test('short date is zero-padded, day before month', () => {
    assert.equal(formatShortDate('2026-08-05'), '05 Aug')
    assert.equal(formatShortDate('2026-11-30'), '30 Nov')
  })

  test('relative names cover only today and tomorrow', () => {
    assert.equal(relativeDayName(TODAY, TODAY), 'Today')
    assert.equal(relativeDayName('2026-08-06', TODAY), 'Tomorrow')
    assert.equal(relativeDayName('2026-08-07', TODAY), null)
    assert.equal(relativeDayName('2026-08-04', TODAY), null)
  })

  test('month label shows the year only when it differs', () => {
    assert.equal(formatMonthLabel('2026-07-14', TODAY), 'July')
    assert.equal(formatMonthLabel('2025-07-14', TODAY), 'July 2025')
  })
})

describe('week boundaries', () => {
  test('weeks start on Monday', () => {
    assert.equal(startOfWeekISO('2026-08-05'), '2026-08-03') // Wed → Mon
    assert.equal(startOfWeekISO('2026-08-03'), '2026-08-03') // Mon → itself
  })

  test('Sunday belongs to the week that just ended, not the next one', () => {
    assert.equal(startOfWeekISO('2026-08-09'), '2026-08-03')
  })

  test('crosses a month boundary', () => {
    assert.equal(startOfWeekISO('2026-09-02'), '2026-08-31')
  })
})

describe('grouping', () => {
  const route = (dateISO: string, updatedAt = 0) => ({ dateISO, updatedAt })

  test('buckets by recency, newest first', () => {
    const sections = groupRoutesByRecency(
      [
        route('2026-07-20'),
        route('2026-08-04'),
        route('2026-08-06'),
        route('2026-08-05'),
        route('2026-06-02'),
      ],
      TODAY,
    )

    assert.deepEqual(
      sections.map((s) => s.title),
      ['Upcoming', 'Earlier this week', 'July', 'June'],
    )
    assert.deepEqual(
      sections.map((s) => s.routes.map((r) => r.dateISO)),
      [['2026-08-06'], ['2026-08-05', '2026-08-04'], ['2026-07-20'], ['2026-06-02']],
    )
  })

  test('today is "Earlier this week", not "Upcoming"', () => {
    const [section] = groupRoutesByRecency([route(TODAY)], TODAY)
    assert.equal(section.kind, 'week')
  })

  test('last Sunday is a month section, not this week', () => {
    // 2 Aug 2026 is the Sunday before the Monday that starts today's week.
    const [section] = groupRoutesByRecency([route('2026-08-02')], TODAY)
    assert.equal(section.kind, 'month')
    assert.equal(section.title, 'August')
  })

  test('same-month routes from different years get separate sections', () => {
    const sections = groupRoutesByRecency([route('2026-07-01'), route('2025-07-01')], TODAY)
    assert.deepEqual(
      sections.map((s) => s.title),
      ['July', 'July 2025'],
    )
  })

  test('routes on one day are ordered by most recently touched', () => {
    const [section] = groupRoutesByRecency(
      [
        { dateISO: TODAY, updatedAt: 100, id: 'older' },
        { dateISO: TODAY, updatedAt: 900, id: 'newer' },
      ],
      TODAY,
    )
    assert.deepEqual(
      section.routes.map((r) => r.id),
      ['newer', 'older'],
    )
  })

  test('does not mutate or reorder the caller’s array', () => {
    const input = [route('2026-06-02'), route('2026-08-06')]
    groupRoutesByRecency(input, TODAY)
    assert.deepEqual(
      input.map((r) => r.dateISO),
      ['2026-06-02', '2026-08-06'],
    )
  })

  test('no routes means no sections', () => {
    assert.deepEqual(groupRoutesByRecency([], TODAY), [])
  })
})

describe('stop summary', () => {
  const stops = (...statuses: StopStatus[]) => statuses.map((status) => ({ status }))

  test('counts each status', () => {
    const summary = summariseStops(stops('delivered', 'delivered', 'failed', 'pending'))
    assert.deepEqual(summary, { total: 4, delivered: 2, failed: 1, pending: 1 })
  })

  test('formats the full line', () => {
    assert.equal(
      formatStopSummary({ total: 44, delivered: 42, failed: 2, pending: 0 }),
      '44 stops · 42 delivered · 2 failed',
    )
  })

  test('drops zero counts rather than printing them', () => {
    assert.equal(formatStopSummary({ total: 44, delivered: 0, failed: 0, pending: 44 }), '44 stops')
    assert.equal(
      formatStopSummary({ total: 10, delivered: 10, failed: 0, pending: 0 }),
      '10 stops · 10 delivered',
    )
  })

  test('singular, and the empty case', () => {
    assert.equal(formatStopSummary({ total: 1, delivered: 0, failed: 0, pending: 1 }), '1 stop')
    assert.equal(formatStopSummary({ total: 0, delivered: 0, failed: 0, pending: 0 }), 'No stops yet')
  })
})
