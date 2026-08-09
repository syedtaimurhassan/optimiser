import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectSync, selfTest, speechUsable, type SyncCapabilities } from './capabilities.ts'

/** Whatever this runner is, plus the two fields a test is about. */
const caps = (overrides: Partial<SyncCapabilities> = {}): SyncCapabilities => ({
  ...detectSync(),
  ...overrides,
})

test('the wasm detection byte arrays are not corrupt', () => {
  const result = selfTest()
  assert.equal(result.ok, true, result.problems.join('; '))
})

test('speech is unusable in an installed iOS web app, however present it looks', () => {
  // The constructor is there — webkitSpeechRecognition exists in standalone
  // mode — and calling it errors immediately without even prompting for the
  // microphone. Feature detection cannot see this, which is why the rule is
  // written down rather than probed.
  assert.equal(
    speechUsable(caps({ speechRecognition: true, platform: 'ios', standalone: true })),
    false,
  )
})

test('the same iOS device in a Safari tab can use it', () => {
  assert.equal(
    speechUsable(caps({ speechRecognition: true, platform: 'ios', standalone: false })),
    true,
  )
})

test('installing on Android takes nothing away', () => {
  assert.equal(
    speechUsable(caps({ speechRecognition: true, platform: 'android', standalone: true })),
    true,
  )
})

test('no recogniser means no speech, wherever we are', () => {
  for (const platform of ['ios', 'android', 'desktop', 'unknown'] as const) {
    assert.equal(speechUsable(caps({ speechRecognition: false, platform })), false)
  }
})
