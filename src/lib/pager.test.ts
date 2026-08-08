import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGE_COMMIT_RATIO, PAGE_FLING_VELOCITY, pageFor, resist } from './pager.ts'

const WIDTH = 360
const base = { index: 5, dx: 0, velocity: 0, width: WIDTH, count: 44 }

test('a small slow drag stays put', () => {
  assert.equal(pageFor({ ...base, dx: -20, velocity: 0.05 }), 5)
})

test('a drag past the commit ratio turns the page', () => {
  const past = -(WIDTH * PAGE_COMMIT_RATIO + 1)
  assert.equal(pageFor({ ...base, dx: past, velocity: 0.05 }), 6)
  assert.equal(pageFor({ ...base, dx: -past, velocity: -0.05 }), 4)
})

test('a drag one pixel short of the ratio does not', () => {
  assert.equal(pageFor({ ...base, dx: -(WIDTH * PAGE_COMMIT_RATIO - 1), velocity: 0 }), 5)
})

test('a flick turns the page even though the card barely moved', () => {
  assert.equal(pageFor({ ...base, dx: -8, velocity: -PAGE_FLING_VELOCITY }), 6)
  assert.equal(pageFor({ ...base, dx: 8, velocity: PAGE_FLING_VELOCITY }), 4)
})

test('a flick that reverses a long drag follows the flick', () => {
  // Dragged a long way left, then flicked back right at the last instant.
  assert.equal(pageFor({ ...base, dx: -300, velocity: 0.9 }), 4)
})

test('never more than one page, however hard the flick', () => {
  assert.equal(pageFor({ ...base, dx: -2000, velocity: -12 }), 6)
})

test('the ends clamp rather than wrap', () => {
  assert.equal(pageFor({ ...base, index: 0, dx: 300, velocity: 2 }), 0)
  assert.equal(pageFor({ ...base, index: 43, dx: -300, velocity: -2 }), 43)
})

test('a single-page carousel goes nowhere', () => {
  assert.equal(pageFor({ ...base, index: 0, count: 1, dx: -300, velocity: -2 }), 0)
})

test('an empty carousel is page zero, not NaN', () => {
  assert.equal(pageFor({ ...base, index: 0, count: 0, dx: -300, velocity: -2 }), 0)
})

test('a zero width cannot commit on distance alone', () => {
  assert.equal(pageFor({ ...base, width: 0, dx: -300, velocity: 0 }), 5)
  // …but a flick still works, so a carousel measured before layout is not stuck.
  assert.equal(pageFor({ ...base, width: 0, dx: -300, velocity: -1 }), 6)
})

test('dragging past either end resists at a third', () => {
  assert.equal(resist(90, 0, 44), 30)
  assert.equal(resist(-90, 43, 44), -30)
})

test('dragging away from an end is unresisted', () => {
  assert.equal(resist(-90, 0, 44), -90)
  assert.equal(resist(90, 43, 44), 90)
})
