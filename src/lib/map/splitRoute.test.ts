import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { LineString } from 'geojson'
import { nearestVertexIndex, splitRouteGeometry } from './splitRoute.ts'

/** A straight west→east line at 55°N, one vertex per 0.01° of longitude. */
const line = (n: number): LineString => ({
  type: 'LineString',
  coordinates: Array.from({ length: n }, (_, i) => [12.5 + i * 0.01, 55.6]),
})

const legs = (fc: ReturnType<typeof splitRouteGeometry>) =>
  fc.features.map((f) => f.properties.leg)

describe('nearestVertexIndex', () => {
  test('finds the closest vertex to an off-line point', () => {
    // Near the 4th vertex (12.53) but offset north, as a doorway would be.
    const index = nearestVertexIndex(line(10).coordinates, { lat: 55.6008, lng: 12.5303 })
    assert.equal(index, 3)
  })

  test('corrects for longitude compression at latitude', () => {
    // At 55°N a degree of longitude is ~0.57 of a degree of latitude. This
    // point is 0.004° east and 0.003° north of vertex 0. Uncorrected, the
    // east offset looks larger and the answer is the same — but scaled, the
    // east distance shrinks below the north one. The test pins the geometry
    // that a naive lat/lng² metric gets wrong.
    const coords = [
      [12.5, 55.6],
      [12.504, 55.6],
      [12.5, 55.603],
    ]
    assert.equal(nearestVertexIndex(coords, { lat: 55.6, lng: 12.504 }), 1)
  })

  test('empty geometry yields -1 rather than throwing', () => {
    assert.equal(nearestVertexIndex([], { lat: 0, lng: 0 }), -1)
  })
})

describe('splitRouteGeometry', () => {
  test('nothing handled yet — the whole route is remaining', () => {
    const fc = splitRouteGeometry(line(10), null)
    assert.deepEqual(legs(fc), ['remaining'])
    assert.equal(fc.features[0].geometry.coordinates.length, 10)
  })

  test('mid-route — two legs that share the split vertex', () => {
    const fc = splitRouteGeometry(line(10), { lat: 55.6, lng: 12.54 })
    assert.deepEqual(legs(fc), ['visited', 'remaining'])

    const [visited, remaining] = fc.features.map((f) => f.geometry.coordinates)
    assert.deepEqual(
      visited[visited.length - 1],
      remaining[0],
      'the shared vertex is what closes the join — a gap here is a visible seam',
    )
    // Every vertex accounted for exactly once, bar the shared one.
    assert.equal(visited.length + remaining.length - 1, 10)
  })

  test('split at the last stop — everything is visited, no stub leg', () => {
    const fc = splitRouteGeometry(line(10), { lat: 55.6, lng: 12.59 })
    assert.deepEqual(legs(fc), ['visited'])
    assert.equal(fc.features[0].geometry.coordinates.length, 10)
  })

  test('split at the very start — everything is remaining, no stub leg', () => {
    const fc = splitRouteGeometry(line(10), { lat: 55.6, lng: 12.5 })
    assert.deepEqual(legs(fc), ['remaining'])
  })

  test('an unsolved route produces no lines at all', () => {
    assert.equal(splitRouteGeometry(null, null).features.length, 0)
    assert.equal(splitRouteGeometry(undefined, null).features.length, 0)
  })

  test('a degenerate one-point geometry is not emitted as a line', () => {
    assert.equal(splitRouteGeometry(line(1), null).features.length, 0)
  })
})
