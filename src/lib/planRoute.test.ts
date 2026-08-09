import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { LatLng } from '../types.ts'
import { augmentWithBreaks, matrixLayout, planSelectiveRoute } from './planRoute.ts'
import { MAX_TABLE_POINTS } from './routingService.ts'

const at = (i: number): LatLng => ({ lat: 52 + i / 1000, lng: 13 + i / 1000 })

describe('matrixLayout', () => {
  test('orders the grid as [start, ...candidates, end]', () => {
    const layout = matrixLayout({
      startLocation: at(100),
      endLocation: at(200),
      waypoints: [at(1), at(2)],
    })
    assert.deepEqual(layout.points, [at(100), at(1), at(2), at(200)])
    assert.deepEqual(layout.matrixWaypointIndex, [null, 0, 1, null])
    assert.deepEqual(layout.candidateIndices, [0, 1])
  })

  /*
    A stop chosen AS the start is not also a stop to visit. Getting this wrong
    puts the depot in the round twice, and the cache would then hold two rows
    claiming to be the same place.
  */
  test('drops a waypoint that coincides with a chosen endpoint', () => {
    const depot = at(1)
    const layout = matrixLayout({
      startLocation: depot,
      endLocation: null,
      waypoints: [depot, at(2), at(3)],
    })
    assert.deepEqual(layout.points, [depot, at(2), at(3)])
    assert.deepEqual(layout.candidateIndices, [1, 2])
    assert.deepEqual(layout.matrixWaypointIndex, [null, 1, 2])
  })

  test('an open route is candidates and nothing else', () => {
    const layout = matrixLayout({
      startLocation: null,
      endLocation: null,
      waypoints: [at(1), at(2)],
    })
    assert.deepEqual(layout.matrixWaypointIndex, [0, 1])
  })
})

describe('the stop cap', () => {
  test('refuses a route past the cap, and says what to do about it', async () => {
    const waypoints = Array.from({ length: MAX_TABLE_POINTS + 1 }, (_, i) => at(i))
    await assert.rejects(
      () =>
        planSelectiveRoute({
          startLocation: null,
          endLocation: null,
          waypoints,
          targetK: null,
          objective: 'duration',
        }),
      /plans up to 1,?000 in one route/,
    )
  })

  test('refuses a route with nothing in it', async () => {
    await assert.rejects(
      () =>
        planSelectiveRoute({
          startLocation: null,
          endLocation: null,
          waypoints: [at(1)],
          targetK: null,
          objective: 'duration',
        }),
      /at least two points/,
    )
  })
})

describe('augmentWithBreaks', () => {
  test('leaves a matrix with no breaks exactly as it was', () => {
    const matrix = Int32Array.from([0, 5, 7, 0])
    const grown = augmentWithBreaks(matrix, 2, [])
    assert.equal(grown.matrix, matrix, 'no breaks should mean no copy')
    assert.equal(grown.n, 2)
  })

  test('a break is free to reach from everywhere, which is the whole trick', () => {
    const matrix = Int32Array.from([0, 5, 7, 0])
    const grown = augmentWithBreaks(matrix, 2, [{ earliestSec: 0, latestSec: 1, durationSec: 60 }])

    const cell = (i: number, j: number) => grown.matrix[i * 3 + j]
    assert.equal(grown.n, 3)
    assert.equal(cell(0, 1), 5, 'the original costs must survive the reindex')
    assert.equal(cell(1, 0), 7)
    for (let i = 0; i < 3; i++) {
      assert.equal(cell(i, 2), 0, `${i} → break should be free`)
      assert.equal(cell(2, i), 0, `break → ${i} should be free`)
    }
  })
})
