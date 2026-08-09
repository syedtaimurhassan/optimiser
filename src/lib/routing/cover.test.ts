import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LatLng } from '../../types.ts'
import { hilbertOrder } from '../compute/hilbert.ts'
import { planCover, uncovered, type NeedSet } from './cover.ts'
import { candidateNeeds } from './sparse.ts'
import type { ProviderLimits } from './types.ts'

const OSRM: ProviderLimits = { maxCells: 10_000, maxPoints: 450, minRequestGapMs: 1_100 }
const TINY: ProviderLimits = { maxCells: 16, maxPoints: 8, minRequestGapMs: 0 }

const inOrder = (n: number) => Array.from({ length: n }, (_, i) => i)

const spread = (n: number): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52 + Math.floor(i / 20) * 0.004 + (i % 3) * 0.0004,
    lng: 13 + (i % 20) * 0.004 + (i % 7) * 0.0003,
  }))

describe('planCover', () => {
  test('covers every needed pair — that is the whole contract', () => {
    const need: NeedSet = [
      [1, 2],
      [0, 3],
      [0, 3],
      [1, 2],
    ]
    const plan = planCover(need, inOrder(4), TINY)
    assert.deepEqual(uncovered(need, plan), [])
    assert.equal(plan.needed, 8)
  })

  test('every band fits what the provider will accept', () => {
    const points = spread(120)
    const need = candidateNeeds(points, { k: 5, padding: 2 })
    const plan = planCover(need, Array.from(hilbertOrder(points)), TINY)

    assert.deepEqual(uncovered(need, plan), [])
    for (const band of plan.bands) {
      const cells = band.sources.length * band.destinations.length
      // A single row whose own needs exceed the budget is left for the service
      // to split; anything wider must already fit.
      if (band.sources.length > 1) {
        assert.ok(cells <= TINY.maxCells, `band of ${cells} cells`)
        assert.ok(band.destinations.length <= TINY.maxPoints)
      }
    }
  })

  test('a row nothing needs costs no request', () => {
    const need: NeedSet = [[1], [0], [], []]
    const plan = planCover(need, inOrder(4), TINY)
    const asked = new Set(plan.bands.flatMap((b) => b.sources))
    assert.ok(!asked.has(2))
    assert.ok(!asked.has(3))
  })

  test('an empty need set is no requests at all', () => {
    assert.deepEqual(planCover([[], []], inOrder(2), OSRM).bands, [])
  })

  /*
    The point of the milestone, as an assertion: the fetch stops being
    quadratic. A dense 300-stop grid is 90,000 cells across 10 requests; the
    cover asks for a fraction of that in a handful.
  */
  test('beats a dense fetch on both requests and cells at 300 stops', () => {
    const points = spread(300)
    const need = candidateNeeds(points, { mandatory: [0, points.length - 1] })
    const plan = planCover(need, Array.from(hilbertOrder(points)), OSRM)

    assert.deepEqual(uncovered(need, plan), [])

    const denseCells = 300 * 300
    const denseRequests = Math.ceil(denseCells / OSRM.maxCells)
    assert.ok(plan.cells < denseCells, `${plan.cells} cells vs ${denseCells} dense`)
    assert.ok(
      plan.bands.length < denseRequests,
      `${plan.bands.length} requests vs ${denseRequests} dense`,
    )
  })

  test('scales linearly, not quadratically, in cells per stop', () => {
    const cellsPerStop = (n: number) => {
      const points = spread(n)
      const need = candidateNeeds(points)
      const plan = planCover(need, Array.from(hilbertOrder(points)), OSRM)
      assert.deepEqual(uncovered(need, plan), [])
      return plan.cells / n
    }
    const small = cellsPerStop(150)
    const large = cellsPerStop(600)
    // Dense would double this ratio with every doubling of n. A linear fetch
    // holds it roughly flat; allow generous slack for boundary effects.
    assert.ok(large < small * 1.6, `cells/stop went ${small.toFixed(0)} → ${large.toFixed(0)}`)
  })

  test('uses the spatial order it is given — a random one is worse', () => {
    const points = spread(200)
    const need = candidateNeeds(points)
    const hilbert = planCover(need, Array.from(hilbertOrder(points)), OSRM)

    const shuffled = inOrder(200)
    let seed = 42
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      const j = seed % (i + 1)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const random = planCover(need, shuffled, OSRM)

    assert.deepEqual(uncovered(need, random), [], 'a bad order must still be correct')
    assert.ok(
      hilbert.bands.length <= random.bands.length,
      `hilbert ${hilbert.bands.length} vs random ${random.bands.length}`,
    )
  })
})

describe('planCover on the real fixture', () => {
  /*
    107 stops is 11,449 cells — barely over one OSRM request either way, which
    is exactly the point: at this size the cover has nothing to win, and it must
    not LOSE. The sparse path earns its keep above the cell budget, not below
    it, and `planRoute` chooses accordingly.
  */
  test('costs no more than the dense fetch it replaces', () => {
    const here = import.meta.dirname
    const points = JSON.parse(
      readFileSync(join(here, '../../../samples/bikes_low_battery.json'), 'utf8'),
    ) as LatLng[]

    const need = candidateNeeds(points, { mandatory: [0] })
    const plan = planCover(need, Array.from(hilbertOrder(points)), OSRM)
    const denseRequests = Math.ceil(points.length ** 2 / OSRM.maxCells)

    assert.deepEqual(uncovered(need, plan), [])
    assert.ok(plan.bands.length <= denseRequests, `${plan.bands.length} vs ${denseRequests}`)
    assert.ok(plan.cells <= points.length * points.length)
  })
})
