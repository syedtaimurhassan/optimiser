import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatLateness, infeasibilityOf } from './infeasibility.ts'
import type { AddressedStop, OptimizedRoute } from '../types.ts'

function stop(id: string, label: string, twCloseSec?: number): AddressedStop {
  return {
    id,
    stopId: label,
    originalPosition: 1,
    lat: 55.7,
    lng: 12.5,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    twCloseSec,
  }
}

type Solved = Pick<OptimizedRoute, 'orderedStopIds' | 'arrivalSec' | 'feasible' | 'lateBySec'>

const solved = (overrides: Partial<Solved> = {}): Solved => ({
  orderedStopIds: ['a', 'b', 'c'],
  arrivalSec: [0, 3600, 7200],
  feasible: false,
  lateBySec: [0, 0, 0],
  ...overrides,
})

const DEPART = 8 * 3600

describe('formatLateness', () => {
  test('rounds to minutes and never reports zero', () => {
    assert.equal(formatLateness(30), '1 min')
    assert.equal(formatLateness(2280), '38 min')
    assert.equal(formatLateness(3600), '1 h')
    assert.equal(formatLateness(3900), '1 h 5 min')
  })
})

describe('infeasibilityOf', () => {
  const stops = [
    stop('a', 'D1', 12 * 3600),
    stop('b', 'D7', 8 * 3600 + 1800),
    stop('c', 'D3'),
  ]

  test('a feasible route reports nothing', () => {
    const report = infeasibilityOf(solved({ feasible: true }), stops, DEPART)
    assert.deepEqual(report.late, [])
    assert.equal(report.summary, '')
  })

  /**
   * A route solved before M11 has no `feasible` field. It did not fail its
   * windows; it was never asked about them, and treating undefined as false
   * would light a warning on every route in the driver's history.
   */
  test('a route from before time windows reports nothing', () => {
    const report = infeasibilityOf(
      { orderedStopIds: ['a'], arrivalSec: [0] },
      stops,
      DEPART,
    )
    assert.equal(report.summary, '')
  })

  test('names the stop, its window, and the arrival', () => {
    // Stop b closes at 08:30; the route reaches it an hour in, at 09:00.
    const report = infeasibilityOf(
      solved({ lateBySec: [0, 1800, 0] }),
      stops,
      DEPART,
    )
    assert.equal(report.late.length, 1)
    assert.equal(report.late[0].label, 'D7')
    assert.equal(report.totalLateSec, 1800)
    assert.equal(
      report.summary,
      'One stop cannot be reached in time: D7 closes at 08:30, earliest arrival 09:00 (30 min late).',
    )
  })

  test('reports the worst offender first, and counts the rest', () => {
    const report = infeasibilityOf(
      solved({ lateBySec: [600, 1800, 0] }),
      stops,
      DEPART,
    )
    assert.deepEqual(
      report.late.map((l) => l.label),
      ['D7', 'D1'],
    )
    assert.equal(report.totalLateSec, 2400)
    assert.match(report.summary, /^2 stops cannot be reached in time\. Worst: D7 /)
  })

  /**
   * A stop with no closing time cannot be late, whatever the solver said. This
   * guards the case where lateness is attributed to a depot endpoint, which has
   * no window and is not something a driver can act on.
   */
  test('ignores lateness attributed to a stop with no window', () => {
    const report = infeasibilityOf(solved({ lateBySec: [0, 0, 900] }), stops, DEPART)
    assert.equal(report.summary, '')
  })

  test('ignores an ordered point that is not a stop at all', () => {
    const report = infeasibilityOf(
      solved({ orderedStopIds: [null, 'b', 'c'], lateBySec: [500, 0, 0] }),
      stops,
      DEPART,
    )
    assert.equal(report.summary, '')
  })
})
