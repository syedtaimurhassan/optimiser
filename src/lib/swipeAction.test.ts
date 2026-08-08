import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SWIPE_COMMIT_PX,
  SWIPE_FLING_MIN_PX,
  SWIPE_FLING_VELOCITY,
  swipeOutcome,
  swipeState,
} from './swipeAction.ts'

test('right is delivered, left is failed', () => {
  assert.deepEqual(swipeOutcome({ dx: 120, velocity: 0, status: 'pending' }), {
    kind: 'set',
    status: 'delivered',
  })
  assert.deepEqual(swipeOutcome({ dx: -120, velocity: 0, status: 'pending' }), {
    kind: 'set',
    status: 'failed',
  })
})

test('a short slow drag does nothing', () => {
  assert.deepEqual(swipeOutcome({ dx: SWIPE_COMMIT_PX - 1, velocity: 0.1, status: 'pending' }), {
    kind: 'none',
  })
})

test('a flick commits without the full distance', () => {
  assert.deepEqual(
    swipeOutcome({ dx: SWIPE_FLING_MIN_PX, velocity: SWIPE_FLING_VELOCITY, status: 'pending' }),
    { kind: 'set', status: 'delivered' },
  )
})

test('a fast twitch is a shaky tap, and must never change a status', () => {
  assert.deepEqual(
    swipeOutcome({ dx: SWIPE_FLING_MIN_PX - 1, velocity: 5, status: 'pending' }),
    { kind: 'none' },
  )
})

test('swiping the same way again undoes, rather than re-setting', () => {
  assert.deepEqual(swipeOutcome({ dx: 120, velocity: 0, status: 'delivered' }), { kind: 'undo' })
  assert.deepEqual(swipeOutcome({ dx: -120, velocity: 0, status: 'failed' }), { kind: 'undo' })
})

test('swiping the OTHER way on a marked row sets the other status', () => {
  assert.deepEqual(swipeOutcome({ dx: -120, velocity: 0, status: 'delivered' }), {
    kind: 'set',
    status: 'failed',
  })
  assert.deepEqual(swipeOutcome({ dx: 120, velocity: 0, status: 'failed' }), {
    kind: 'set',
    status: 'delivered',
  })
})

test('the live state names the side and says whether it is armed', () => {
  assert.deepEqual(swipeState(0, 'pending'), { side: null, armed: false, undo: false })
  assert.deepEqual(swipeState(40, 'pending'), { side: 'delivered', armed: false, undo: false })
  assert.deepEqual(swipeState(SWIPE_COMMIT_PX, 'pending'), {
    side: 'delivered',
    armed: true,
    undo: false,
  })
})

test('the live state warns when the commit would be an undo', () => {
  assert.equal(swipeState(120, 'delivered').undo, true)
  assert.equal(swipeState(120, 'failed').undo, false)
  assert.equal(swipeState(-120, 'failed').undo, true)
})
