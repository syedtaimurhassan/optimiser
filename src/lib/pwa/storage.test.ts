import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  CRITICAL_AT,
  WARN_AT,
  describeStorage,
  formatBytes,
  fractionUsed,
  pressureOf,
} from './storage.ts'

describe('storage pressure', () => {
  test('classifies the three bands', () => {
    assert.equal(pressureOf({ usage: 10, quota: 100 }), 'fine')
    assert.equal(pressureOf({ usage: WARN_AT * 100, quota: 100 }), 'warn')
    assert.equal(pressureOf({ usage: CRITICAL_AT * 100, quota: 100 }), 'critical')
  })

  /*
    Safari declines to answer in private browsing. Reading that as "100% full"
    would put a red warning in front of someone whose storage is fine, which is
    the fastest way to teach a driver to ignore the warning that matters.
  */
  test('a quota of zero is unknown, not full', () => {
    assert.equal(pressureOf({ usage: 0, quota: 0 }), 'unknown')
    assert.equal(pressureOf({ usage: null, quota: null }), 'unknown')
    assert.equal(pressureOf(null), 'unknown')
    assert.equal(pressureOf(undefined), 'unknown')
  })

  test('fractionUsed is bounded at 1 and null when unanswerable', () => {
    assert.equal(fractionUsed({ usage: 50, quota: 100 }), 0.5)
    // Browsers do report usage over quota after a quota reduction.
    assert.equal(fractionUsed({ usage: 300, quota: 100 }), 1)
    assert.equal(fractionUsed({ usage: 1, quota: 0 }), null)
  })
})

describe('formatBytes', () => {
  test('uses decimal units, matching what a phone shows', () => {
    assert.equal(formatBytes(999), '999 B')
    assert.equal(formatBytes(1000), '1.0 kB')
    assert.equal(formatBytes(1_500_000), '1.5 MB')
    assert.equal(formatBytes(2_400_000_000), '2.4 GB')
  })

  /* "847 MB" reads at a glance; "847.2 MB" does not. */
  test('drops the decimal above 100', () => {
    assert.equal(formatBytes(847_200_000), '847 MB')
    assert.equal(formatBytes(99_400_000), '99.4 MB')
  })

  test('survives the answers a browser actually gives', () => {
    assert.equal(formatBytes(null), '—')
    assert.equal(formatBytes(undefined), '—')
    assert.equal(formatBytes(Number.NaN), '—')
  })
})

describe('describeStorage', () => {
  /*
    Pressure outranks persistence. An origin can be persisted AND nearly full,
    and "Protected" is the wrong headline for a driver about to lose writes.
  */
  test('a full disk is reported even when persisted', () => {
    const text = describeStorage({ usage: 99, quota: 100 }, true)
    assert.match(text, /Almost full/)
  })

  test('an unprotected origin is warned about, without calling it an error', () => {
    const text = describeStorage({ usage: 1, quota: 100 }, false)
    assert.match(text, /Not protected/)
    // persist() returning false is a normal outcome on Safari, not a fault.
    assert.doesNotMatch(text, /error|failed|problem/i)
  })

  test('the good case says so plainly', () => {
    assert.match(describeStorage({ usage: 1, quota: 100 }, true), /^Protected\./)
  })
})
