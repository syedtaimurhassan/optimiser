import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_CANVAS_AREA,
  MAX_PHOTOS_PER_ROUTE,
  MAX_PHOTOS_PER_STOP,
  budgetMessage,
  exceedsCanvasLimit,
  fitWithin,
  newPhotoRef,
  photoBudget,
} from './photos.ts'
import type { AddressedStop } from '../types.ts'

const stop = (id: string, photos: number): AddressedStop => ({
  id,
  stopId: id.toUpperCase(),
  originalPosition: 1,
  lat: 55.7,
  lng: 12.5,
  kind: 'delivery',
  order: 'auto',
  status: 'pending',
  statusHistory: [],
  photoRefs: Array.from({ length: photos }, (_, i) => `photo:${id}-${i}`),
})

// ------------------------------------------------------------------- fitting

test('a photo larger than the cap is scaled by its longest edge', () => {
  // A typical phone photo, landscape.
  assert.deepEqual(fitWithin({ width: 4032, height: 3024 }, 1440), { width: 1440, height: 1080 })
})

test('portrait is capped on height, not on width', () => {
  assert.deepEqual(fitWithin({ width: 3024, height: 4032 }, 1440), { width: 1080, height: 1440 })
})

test('a photo already smaller than the cap is left alone', () => {
  // Upscaling costs bytes and adds no detail.
  assert.deepEqual(fitWithin({ width: 800, height: 600 }, 1440), { width: 800, height: 600 })
})

test('the aspect ratio survives the round trip', () => {
  const source = { width: 4000, height: 2250 }
  const fitted = fitWithin(source, 1440)
  assert.ok(Math.abs(fitted.width / fitted.height - source.width / source.height) < 0.01)
})

test('a degenerate size does not produce a zero-pixel canvas', () => {
  // A 1px edge rounds to 0 without the clamp, and a 0-width canvas throws.
  const fitted = fitWithin({ width: 10000, height: 1 }, 1440)
  assert.ok(fitted.height >= 1)
  assert.ok(fitted.width >= 1)
})

// ------------------------------------------------------------- canvas limit

test('a modern phone photo would exceed the iOS canvas ceiling', () => {
  // 8000 x 6000 is 48 Mpx, nearly three times the limit. Drawing it on iOS
  // yields a blank canvas rather than an error, so this is the check that
  // stops us storing a black rectangle as proof of delivery.
  assert.equal(exceedsCanvasLimit({ width: 8000, height: 6000 }), true)
})

test('the capped size never does', () => {
  const fitted = fitWithin({ width: 8000, height: 6000 }, 1440)
  assert.equal(exceedsCanvasLimit(fitted), false)
  assert.ok(fitted.width * fitted.height < MAX_CANVAS_AREA)
})

test('4097 x 4096 is over the line and 4096 x 4096 is not', () => {
  assert.equal(exceedsCanvasLimit({ width: 4097, height: 4096 }), true)
  assert.equal(exceedsCanvasLimit({ width: 4096, height: 4096 }), false)
})

// ------------------------------------------------------------------- budget

test('an empty stop on an empty route is not blocked', () => {
  const s = stop('a', 0)
  assert.deepEqual(photoBudget(s, [s]), { stopUsed: 0, routeUsed: 0, blocked: null })
})

test('a full stop blocks on the stop, even with room on the route', () => {
  const s = stop('a', MAX_PHOTOS_PER_STOP)
  const budget = photoBudget(s, [s])
  assert.equal(budget.blocked, 'stop')
  assert.ok(budget.routeUsed < MAX_PHOTOS_PER_ROUTE)
})

test('a full route blocks a stop that has room of its own', () => {
  const target = stop('a', 1)
  const others = Array.from({ length: 10 }, (_, i) => stop(`b${i}`, MAX_PHOTOS_PER_STOP))
  const budget = photoBudget(target, [target, ...others])
  assert.ok(budget.routeUsed >= MAX_PHOTOS_PER_ROUTE)
  assert.equal(budget.blocked, 'route')
})

test('the stop limit is reported before the route limit', () => {
  // Both are spent. Telling a driver to clear the whole route when deleting
  // one photo from this stop would do is the less useful of two true answers.
  const target = stop('a', MAX_PHOTOS_PER_STOP)
  const others = Array.from({ length: 10 }, (_, i) => stop(`b${i}`, MAX_PHOTOS_PER_STOP))
  assert.equal(photoBudget(target, [target, ...others]).blocked, 'stop')
})

test('the message names a number and an action, not a failure', () => {
  for (const blocked of ['stop', 'route'] as const) {
    const message = budgetMessage(blocked)
    assert.match(message, /\d+/)
    assert.match(message, /Delete/)
  }
})

// --------------------------------------------------------------------- refs

test('photo refs are unique and recognisable', () => {
  const refs = new Set(Array.from({ length: 200 }, newPhotoRef))
  assert.equal(refs.size, 200)
  for (const ref of refs) assert.match(ref, /^photo:/)
})
