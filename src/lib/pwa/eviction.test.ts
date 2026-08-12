import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isDataLoss } from './eviction.ts'

describe('isDataLoss', () => {
  /*
    The case this exists for: the shell survived, IndexedDB did not. Without
    the check that presents as a working app with an empty route list, and a
    driver shown an empty app assumes they are on the wrong phone and goes
    looking, instead of being told the data is gone.
  */
  test('a surviving shell beside a missing marker is a loss', () => {
    assert.equal(isDataLoss({ hasShellCache: true, hasMarker: false }), true)
  })

  /*
    A first run has neither, and is indistinguishable from a full-origin
    eviction BY CONSTRUCTION — every script-writable store goes at once, so any
    marker proving otherwise dies with the thing it was proving. Reporting a
    loss here would greet every new user with "your data was cleared".
  */
  test('a first run is not a loss', () => {
    assert.equal(isDataLoss({ hasShellCache: false, hasMarker: false }), false)
  })

  test('both present is the normal case', () => {
    assert.equal(isDataLoss({ hasShellCache: true, hasMarker: true }), false)
  })

  /*
    Asymmetric on purpose. A marker without a shell cache means the CACHES were
    dropped — or the worker never registered — and the data the marker is about
    is still there. That is not a loss and must not be reported as one.
  */
  test('a dropped cache alone is not a loss', () => {
    assert.equal(isDataLoss({ hasShellCache: false, hasMarker: true }), false)
  })
})
