import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isDataLoss } from './eviction.ts'

describe('isDataLoss', () => {
  /*
    The case this exists for: an earlier session recorded that there was data,
    and now there is none. Without the check that presents as a working app
    with an empty route list, and a driver shown an empty app assumes they are
    on the wrong phone and goes looking, instead of being told it is gone.
  */
  test('a witness with no data is a loss', () => {
    assert.equal(isDataLoss({ hasWitness: true, hasData: false }), true)
  })

  /*
    The false positive the M14 smoke test caught, and the reason the witness is
    no longer "a shell cache exists". The shell cache is created on the FIRST
    visit, before any data has ever existed — so every user with an empty route
    was told their data had been cleared on their second launch.
  */
  test('a first run is not a loss', () => {
    assert.equal(isDataLoss({ hasWitness: false, hasData: false }), false)
  })

  test('data present is never a loss, witness or not', () => {
    assert.equal(isDataLoss({ hasWitness: true, hasData: true }), false)
    assert.equal(isDataLoss({ hasWitness: false, hasData: true }), false)
  })
})
