import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAILURE_REASONS,
  OTHER_REASON_ID,
  describeFailure,
  reasonLabel,
} from './failureReasons.ts'

test('exactly one option opens the free-text field', () => {
  const freeText = FAILURE_REASONS.filter((r) => r.freeText)
  assert.equal(freeText.length, 1)
  assert.equal(freeText[0].id, OTHER_REASON_ID)
})

test('the ids are unique — they are persisted onto stops', () => {
  assert.equal(new Set(FAILURE_REASONS.map((r) => r.id)).size, FAILURE_REASONS.length)
})

test('a reason a later release removed does not render as a raw id', () => {
  assert.equal(reasonLabel('a-reason-we-dropped'), null)
  assert.equal(reasonLabel(undefined), null)
})

test('a reason and a note read as one fact', () => {
  assert.equal(
    describeFailure({ failureReason: 'nobody-home', failureNote: 'tried the back door too' }),
    'Nobody home — tried the back door too',
  )
})

test('either half stands alone', () => {
  assert.equal(describeFailure({ failureReason: 'refused' }), 'Refused on delivery')
  assert.equal(describeFailure({ failureNote: 'gate locked' }), 'gate locked')
})

test('a skipped reason describes nothing rather than an empty dash', () => {
  assert.equal(describeFailure({}), null)
  assert.equal(describeFailure({ failureNote: '   ' }), null)
})
