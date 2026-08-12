import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { DISMISSAL_MS, installPitch, installRoute, shouldOfferInstall } from './install.ts'

describe('installRoute', () => {
  test('offers nothing to an app that is already installed', () => {
    for (const platform of ['ios', 'android', 'desktop', 'unknown'] as const) {
      assert.equal(installRoute({ platform, standalone: true, hasPrompt: true }), 'none')
    }
  })

  test('replays a captured prompt wherever one exists', () => {
    assert.equal(installRoute({ platform: 'android', standalone: false, hasPrompt: true }), 'prompt')
    assert.equal(installRoute({ platform: 'desktop', standalone: false, hasPrompt: true }), 'prompt')
  })

  /* Safari has no install API at all, so instructions are the only option. */
  test('iOS falls back to instructions', () => {
    assert.equal(installRoute({ platform: 'ios', standalone: false, hasPrompt: false }), 'ios-manual')
  })

  /*
    On Android an absent prompt means the browser has decided the app is not
    installable, or already is. Hand-written steps there would be guessing at a
    menu that differs by vendor and skin.
  */
  test('Android without a prompt is offered nothing', () => {
    assert.equal(installRoute({ platform: 'android', standalone: false, hasPrompt: false }), 'none')
  })
})

describe('shouldOfferInstall', () => {
  const base = { route: 'prompt' as const, dismissedAt: null, hasDataWorthKeeping: true }

  test('offers when there is something to protect', () => {
    assert.equal(shouldOfferInstall(base), true)
  })

  /*
    The rule that keeps this from being nagware. On a first launch there is
    nothing installing would protect, so the card would be a pop-up asking for
    a commitment before the app has done anything.
  */
  test('says nothing on an empty app', () => {
    assert.equal(shouldOfferInstall({ ...base, hasDataWorthKeeping: false }), false)
  })

  test('a dismissal lasts, but not forever', () => {
    const now = 1_000_000_000_000
    assert.equal(
      shouldOfferInstall({ ...base, dismissedAt: now - DISMISSAL_MS + 1000, now }),
      false,
    )
    assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - DISMISSAL_MS - 1, now }), true)
  })

  test('nothing to offer means nothing is offered', () => {
    assert.equal(shouldOfferInstall({ ...base, route: 'none' }), false)
  })
})

describe('installPitch', () => {
  /*
    The iOS copy is the only one making a promise about the driver's data, so
    it has to be the accurate version: installing is what makes WebKit likely
    to grant persistent mode, and persistent mode is what survives eviction.
    It must not claim the data is guaranteed — the heuristics are Apple's, and
    Settings reports the actual outcome of persist() rather than assuming it.
  */
  test('iOS explains eviction without promising immunity', () => {
    const { body } = installPitch('ios')
    assert.match(body, /week/)
    assert.match(body, /more likely/)
    assert.doesNotMatch(body, /guarantee|never|always/i)
  })

  test('every platform gets a reason, not just a request', () => {
    for (const platform of ['ios', 'android', 'desktop', 'unknown'] as const) {
      const { title, body } = installPitch(platform)
      assert.ok(title.length > 0)
      assert.ok(body.length > 40, `${platform} pitch is too thin to be a reason`)
    }
  })
})
