import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clockToSeconds,
  describeServiceTime,
  describeWindow,
  secondsToClock,
} from './stopSettings.ts'

test('an unset value is a WORD, never a blank', () => {
  assert.equal(describeWindow(undefined, undefined), 'Anytime')
  assert.equal(describeServiceTime(undefined), 'Default (1 min)')
})

test('a one-ended window is shown as one-ended, not silently completed', () => {
  assert.equal(describeWindow(9 * 3600, undefined), 'From 09:00')
  assert.equal(describeWindow(undefined, 17 * 3600), 'Until 17:00')
  assert.equal(describeWindow(9 * 3600, 12 * 3600), '09:00 – 12:00')
})

test('a service time we never offered still renders as minutes', () => {
  assert.equal(describeServiceTime(420), '7 min')
  assert.equal(describeServiceTime(300), '5 min')
})

test('clocks round-trip', () => {
  for (const seconds of [0, 9 * 3600 + 15 * 60, 23 * 3600 + 59 * 60]) {
    assert.equal(clockToSeconds(secondsToClock(seconds)), seconds)
  }
})

test('an unset clock is an empty field, not "00:00"', () => {
  assert.equal(secondsToClock(undefined), '')
  assert.equal(secondsToClock(Number.NaN), '')
  // …but a real midnight IS 00:00.
  assert.equal(secondsToClock(0), '00:00')
})

test('nonsense in the field is undefined, not a wrong time', () => {
  for (const bad of ['', 'soon', '25:00', '09:75', '9', '09:5']) {
    assert.equal(clockToSeconds(bad), undefined, bad)
  }
})

test('a single-digit hour is accepted — phone keyboards produce it', () => {
  assert.equal(clockToSeconds('9:05'), 9 * 3600 + 5 * 60)
})
