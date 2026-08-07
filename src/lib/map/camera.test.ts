import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  boundsOf,
  centerOf,
  contextualFab,
  isDegenerate,
  nextRecenterPhase,
  type RecenterAvailability,
} from './camera.ts'

const ALL: RecenterAvailability = { stop: true, stops: true, route: true }

describe('boundsOf', () => {
  test('wraps the extremes of the given points', () => {
    assert.deepEqual(
      boundsOf([
        { lat: 55.6, lng: 12.5 },
        { lat: 55.7, lng: 12.4 },
        { lat: 55.5, lng: 12.6 },
      ]),
      [
        [12.4, 55.5],
        [12.6, 55.7],
      ],
    )
  })

  test('no points means no bounds, not a bounds around null island', () => {
    assert.equal(boundsOf([]), null)
  })

  test('skips non-finite coordinates instead of poisoning the bounds', () => {
    const bounds = boundsOf([
      { lat: 55.6, lng: 12.5 },
      { lat: NaN, lng: 12.9 },
      { lat: 55.8, lng: 12.7 },
    ])
    assert.deepEqual(bounds, [
      [12.5, 55.6],
      [12.7, 55.8],
    ])
  })

  test('all-invalid input yields null rather than an Infinity bounds', () => {
    assert.equal(boundsOf([{ lat: NaN, lng: NaN }]), null)
  })
})

describe('isDegenerate', () => {
  test('a single stop is degenerate — fitBounds would zoom onto a rooftop', () => {
    const bounds = boundsOf([{ lat: 55.6, lng: 12.5 }])!
    assert.equal(isDegenerate(bounds), true)
  })

  test('two distinct stops are not', () => {
    const bounds = boundsOf([
      { lat: 55.6, lng: 12.5 },
      { lat: 55.7, lng: 12.6 },
    ])!
    assert.equal(isDegenerate(bounds), false)
  })

  test('centerOf halves the bounds', () => {
    assert.deepEqual(
      centerOf([
        [12.4, 55.5],
        [12.6, 55.7],
      ]),
      { lng: 12.5, lat: 55.6 },
    )
  })
})

describe('the recenter cycle', () => {
  test('walks stop → stops → route and wraps', () => {
    assert.equal(nextRecenterPhase(null, ALL), 'stop')
    assert.equal(nextRecenterPhase('stop', ALL), 'stops')
    assert.equal(nextRecenterPhase('stops', ALL), 'route')
    assert.equal(nextRecenterPhase('route', ALL), 'stop', 'the cycle wraps')
  })

  test('skips phases that make no sense right now', () => {
    // Nothing selected and nothing solved: only "all stops" is meaningful,
    // so repeated taps stay there rather than flying nowhere.
    const only = { stop: false, stops: true, route: false }
    assert.equal(nextRecenterPhase(null, only), 'stops')
    assert.equal(nextRecenterPhase('stops', only), 'stops')
  })

  test('an unsolved route cycles between the stop and all stops', () => {
    const unsolved = { stop: true, stops: true, route: false }
    assert.equal(nextRecenterPhase('stop', unsolved), 'stops')
    assert.equal(nextRecenterPhase('stops', unsolved), 'stop')
  })

  test('a phase that became unavailable restarts rather than sticking', () => {
    // The user was on 'stop', then deselected. Tapping again must still move.
    const deselected = { stop: false, stops: true, route: true }
    assert.equal(nextRecenterPhase('stop', deselected), 'stops')
  })

  test('an empty route with no selection leaves the camera alone', () => {
    assert.equal(nextRecenterPhase(null, { stop: false, stops: false, route: false }), null)
  })
})

describe('the contextual FAB', () => {
  test('empty route asks where YOU are', () => {
    assert.equal(contextualFab({ selectedStopId: null, stopCount: 0 }), 'my-location')
  })

  test('route overview offers to frame it', () => {
    assert.equal(contextualFab({ selectedStopId: null, stopCount: 12 }), 'fit-route')
  })

  test('a selected stop offers to get back to it', () => {
    assert.equal(contextualFab({ selectedStopId: 'a', stopCount: 12 }), 'focus-stop')
  })

  test('selection wins even on an otherwise empty route', () => {
    assert.equal(contextualFab({ selectedStopId: 'a', stopCount: 0 }), 'focus-stop')
  })
})
