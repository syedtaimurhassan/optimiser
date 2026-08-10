import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeVoiceError, voiceAvailability, voiceIsLocal } from './voice.ts'
import { detectSync, type SyncCapabilities } from './device/capabilities.ts'

const caps = (overrides: Partial<SyncCapabilities> = {}): SyncCapabilities => ({
  ...detectSync(),
  ...overrides,
})

test('a device that can dictate is offered no explanation', () => {
  const a = voiceAvailability(caps({ speechRecognition: true, platform: 'android' }))
  assert.equal(a.usable, true)
  assert.equal(a.message, null)
})

test('an installed iOS app is told the truth about why, and what to do', () => {
  const a = voiceAvailability(
    caps({ speechRecognition: true, platform: 'ios', standalone: true }),
  )
  assert.equal(a.usable, false)
  assert.equal(a.reason, 'ios-standalone')
  // The two halves that make this a limitation rather than a bug: the cause,
  // and the thing to do instead.
  assert.match(a.message ?? '', /iPhone/)
  assert.match(a.fallback ?? '', /Safari|type/i)
})

test('a browser with no recogniser gets the generic explanation, still with a way out', () => {
  const a = voiceAvailability(caps({ speechRecognition: false, platform: 'desktop' }))
  assert.equal(a.reason, 'unsupported')
  assert.match(a.fallback ?? '', /Type/)
})

test('every unusable case has both a reason and a fallback — never a dead control', () => {
  const cases: Partial<SyncCapabilities>[] = [
    { speechRecognition: true, platform: 'ios', standalone: true },
    { speechRecognition: false, platform: 'ios', standalone: false },
    { speechRecognition: false, platform: 'android', standalone: true },
    { speechRecognition: false, platform: 'unknown', standalone: false },
  ]
  for (const c of cases) {
    const a = voiceAvailability(caps(c))
    assert.equal(a.usable, false)
    assert.ok(a.message && a.message.length > 0)
    assert.ok(a.fallback && a.fallback.length > 0)
  }
})

test('only an installed on-device pack counts as local', () => {
  assert.equal(voiceIsLocal('available'), true)
  // Downloadable is not downloaded, and the audio goes to the vendor until it is.
  assert.equal(voiceIsLocal('downloadable'), false)
  assert.equal(voiceIsLocal('downloading'), false)
  assert.equal(voiceIsLocal('unavailable'), false)
  assert.equal(voiceIsLocal(null), false)
  assert.equal(voiceIsLocal(undefined), false)
})

test('error codes become sentences', () => {
  assert.match(describeVoiceError('not-allowed'), /permission/i)
  assert.match(describeVoiceError('no-speech'), /again/i)
  assert.match(describeVoiceError('network'), /network/i)
  // Anything unrecognised still says something, and never leaks the code.
  const unknown = describeVoiceError('some-new-webkit-code')
  assert.ok(unknown.length > 0)
  assert.ok(!unknown.includes('some-new-webkit-code'))
})
