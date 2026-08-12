import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { CAMERA_TTL_MS, isUsable, pickInitialCamera, type SavedCamera } from './lastCamera.ts'
import { HOME } from './camera.ts'

const NOW = 1_800_000_000_000
const good = (over: Partial<SavedCamera> = {}): SavedCamera => ({
  lat: 55.68,
  lng: 12.57,
  zoom: 14,
  savedAt: NOW - 1000,
  ...over,
})

describe('isUsable', () => {
  test('accepts a recent, well-formed camera', () => {
    assert.equal(isUsable(good(), NOW), true)
  })

  test('rejects nothing at all', () => {
    assert.equal(isUsable(null, NOW), false)
    assert.equal(isUsable(undefined, NOW), false)
  })

  /*
    This comes off disk, where a partial write or an older schema can produce
    something shaped right and numerically absurd. NaN in particular passes a
    typeof check and then moves the map nowhere at all.
  */
  test('rejects values that are numbers but not coordinates', () => {
    assert.equal(isUsable(good({ lat: Number.NaN }), NOW), false)
    assert.equal(isUsable(good({ lng: Infinity }), NOW), false)
    assert.equal(isUsable(good({ lat: 91 }), NOW), false)
    assert.equal(isUsable(good({ lng: -181 }), NOW), false)
  })

  /* Restoring zoom 2 would reinstate the exact world view this replaces. */
  test('rejects a zoom outside what the map can usefully show', () => {
    assert.equal(isUsable(good({ zoom: 2 }), NOW), false)
    assert.equal(isUsable(good({ zoom: 25 }), NOW), false)
  })

  test('rejects a camera older than the freshness window', () => {
    assert.equal(isUsable(good({ savedAt: NOW - CAMERA_TTL_MS + 1 }), NOW), true)
    assert.equal(isUsable(good({ savedAt: NOW - CAMERA_TTL_MS - 1 }), NOW), false)
  })

  /*
    A phone with the wrong date, later corrected, writes a camera in the
    future. Disqualifying it forever would strand the driver on HOME on every
    launch, which is a worse outcome than trusting a slightly odd timestamp.
  */
  test('tolerates a clock that ran ahead', () => {
    assert.equal(isUsable(good({ savedAt: NOW + 86_400_000 }), NOW), true)
  })
})

describe('pickInitialCamera', () => {
  test('restores a usable camera', () => {
    const camera = pickInitialCamera(good({ lat: 55.4, lng: 12.3, zoom: 15 }), NOW)
    assert.deepEqual(camera, { center: { lat: 55.4, lng: 12.3 }, zoom: 15 })
  })

  test('falls back to the home region, never to a world view', () => {
    for (const saved of [null, undefined, good({ zoom: 2 }), good({ savedAt: 0 })]) {
      const camera = pickInitialCamera(saved, NOW)
      assert.deepEqual(camera, HOME)
    }
  })

  /*
    The defect this whole module exists for: the map opened at zoom 2 on a
    centre that was ALREADY Copenhagen, so the zoom was the only thing wrong
    and it hid the right answer behind an ocean.
  */
  test('the home region is a city, not a planet', () => {
    assert.ok(HOME.zoom >= 10, `HOME.zoom is ${HOME.zoom} — that is not a city`)
    assert.ok(Math.abs(HOME.center.lat - 55.6761) < 0.01)
    assert.ok(Math.abs(HOME.center.lng - 12.5683) < 0.01)
  })
})
