import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOCK_SIZE,
  blockLetter,
  blockIndexFromLetter,
  stopIdForPosition,
  assignStopIds,
  parseStopId,
  rootStopId,
  allocateInsertedStopId,
  allocateAppendedStopId,
  compareStopIds,
  resetStopIds,
} from './stopIds.ts'

describe('block letters', () => {
  test('single letters', () => {
    assert.equal(blockLetter(0), 'A')
    assert.equal(blockLetter(1), 'B')
    assert.equal(blockLetter(25), 'Z')
  })

  test('continues spreadsheet-style past Z', () => {
    assert.equal(blockLetter(26), 'AA')
    assert.equal(blockLetter(27), 'AB')
    assert.equal(blockLetter(49), 'AX')
    assert.equal(blockLetter(51), 'AZ')
    assert.equal(blockLetter(52), 'BA')
  })

  test('round-trips through blockIndexFromLetter', () => {
    for (let i = 0; i < 1000; i++) {
      assert.equal(blockIndexFromLetter(blockLetter(i)), i, `failed at block ${i}`)
    }
  })

  test('rejects nonsense', () => {
    assert.throws(() => blockLetter(-1), RangeError)
    assert.throws(() => blockLetter(1.5), RangeError)
    assert.throws(() => blockIndexFromLetter('a1'), RangeError)
  })
})

describe('stopIdForPosition — the specified cases', () => {
  // These are the reverse-engineered ground truth. If any of these break, the
  // scheme is wrong, not the test.
  test('position 37 → D7', () => assert.equal(stopIdForPosition(37), 'D7'))
  test('position 38 → D8', () => assert.equal(stopIdForPosition(38), 'D8'))
  test('position 43 → E3', () => assert.equal(stopIdForPosition(43), 'E3'))
  test('position 10 → A10', () => assert.equal(stopIdForPosition(10), 'A10'))
  test('position 11 → B1', () => assert.equal(stopIdForPosition(11), 'B1'))
})

describe('stopIdForPosition — block boundaries', () => {
  test('first block is A1..A10, never A0', () => {
    assert.equal(stopIdForPosition(1), 'A1')
    assert.equal(stopIdForPosition(9), 'A9')
    assert.equal(stopIdForPosition(10), 'A10')
  })

  test('10 → 11 rolls A10 into B1', () => {
    assert.equal(stopIdForPosition(10), 'A10')
    assert.equal(stopIdForPosition(11), 'B1')
  })

  test('20 → 21 rolls B10 into C1', () => {
    assert.equal(stopIdForPosition(20), 'B10')
    assert.equal(stopIdForPosition(21), 'C1')
  })

  test('30 → 31 rolls C10 into D1', () => {
    assert.equal(stopIdForPosition(30), 'C10')
    assert.equal(stopIdForPosition(31), 'D1')
  })

  test('every block ends at 10 and the next starts at 1', () => {
    for (let block = 0; block < 40; block++) {
      const last = (block + 1) * BLOCK_SIZE
      assert.equal(stopIdForPosition(last), `${blockLetter(block)}10`)
      assert.equal(stopIdForPosition(last + 1), `${blockLetter(block + 1)}1`)
    }
  })

  test('crosses Z into AA at position 260/261', () => {
    assert.equal(stopIdForPosition(260), 'Z10')
    assert.equal(stopIdForPosition(261), 'AA1')
  })

  test('numeric mode is the plain position', () => {
    assert.equal(stopIdForPosition(37, 'numeric'), '37')
    assert.equal(stopIdForPosition(1, 'numeric'), '1')
    assert.equal(stopIdForPosition(500, 'numeric'), '500')
  })

  test('rejects non-positive and non-integer positions', () => {
    assert.throws(() => stopIdForPosition(0), RangeError)
    assert.throws(() => stopIdForPosition(-3), RangeError)
    assert.throws(() => stopIdForPosition(2.5), RangeError)
  })
})

describe('a 500-stop sequence', () => {
  const ids = assignStopIds(500)

  test('produces exactly 500 ids', () => assert.equal(ids.length, 500))

  test('every id is unique', () => {
    assert.equal(new Set(ids).size, 500)
  })

  test('spot checks across the range', () => {
    assert.equal(ids[0], 'A1')
    assert.equal(ids[9], 'A10')
    assert.equal(ids[10], 'B1')
    assert.equal(ids[36], 'D7') // position 37
    assert.equal(ids[42], 'E3') // position 43
    assert.equal(ids[259], 'Z10') // position 260
    assert.equal(ids[260], 'AA1') // position 261
    assert.equal(ids[499], 'AX10') // position 500
  })

  test('sorting by compareStopIds reproduces original order', () => {
    const shuffled = [...ids].reverse()
    shuffled.sort(compareStopIds)
    assert.deepEqual(shuffled, ids)
  })

  test('every id parses back to its own position', () => {
    ids.forEach((id, i) => {
      const parsed = parseStopId(id)
      assert.ok(parsed, `${id} should parse`)
      const position = blockIndexFromLetter(parsed.letters) * BLOCK_SIZE + parsed.index
      assert.equal(position, i + 1, `${id} should map back to position ${i + 1}`)
    })
  })
})

describe('parsing', () => {
  test('plain letter id', () => {
    assert.deepEqual(parseStopId('D7'), {
      letters: 'D', index: 7, suffixes: [], root: 'D7', mode: 'letterBlock',
    })
  })

  test('suffixed id', () => {
    assert.deepEqual(parseStopId('D7.2'), {
      letters: 'D', index: 7, suffixes: [2], root: 'D7', mode: 'letterBlock',
    })
  })

  test('deeply suffixed id', () => {
    assert.deepEqual(parseStopId('AX10.3.1'), {
      letters: 'AX', index: 10, suffixes: [3, 1], root: 'AX10', mode: 'letterBlock',
    })
  })

  test('numeric id', () => {
    assert.deepEqual(parseStopId('37.1'), {
      letters: '', index: 37, suffixes: [1], root: '37', mode: 'numeric',
    })
  })

  test('rejects rubbish', () => {
    assert.equal(parseStopId(''), null)
    assert.equal(parseStopId('D'), null)
    assert.equal(parseStopId('7D'), null)
    assert.equal(parseStopId('d7'), null)
    assert.equal(parseStopId('D7.'), null)
  })

  test('rootStopId strips suffixes', () => {
    assert.equal(rootStopId('D7'), 'D7')
    assert.equal(rootStopId('D7.1'), 'D7')
    assert.equal(rootStopId('D7.1.4'), 'D7')
    assert.equal(rootStopId('37.2'), '37')
  })
})

describe('decimal inserts', () => {
  test('first insert beside D7 is D7.1', () => {
    assert.equal(allocateInsertedStopId('D7', ['D6', 'D7', 'D8']), 'D7.1')
  })

  test('second insert beside D7 is D7.2', () => {
    assert.equal(allocateInsertedStopId('D7', ['D6', 'D7', 'D7.1', 'D8']), 'D7.2')
  })

  test('inserting beside D7.1 also allocates off the root, giving D7.2', () => {
    // Not D7.1.1: nesting would deepen without bound as a driver worked a
    // street, and nobody wants to write "D7.1.2.1" on a parcel.
    assert.equal(allocateInsertedStopId('D7.1', ['D7', 'D7.1']), 'D7.2')
  })

  test('adjacent decimal inserts keep climbing the same root', () => {
    const ids = ['D7']
    for (let i = 1; i <= 5; i++) {
      const next = allocateInsertedStopId(ids[ids.length - 1], ids)
      assert.equal(next, `D7.${i}`)
      ids.push(next)
    }
    assert.deepEqual(ids, ['D7', 'D7.1', 'D7.2', 'D7.3', 'D7.4', 'D7.5'])
  })

  test('suffixes are never reused after a delete', () => {
    // D7.1 and D7.2 existed; D7.1 was deleted. The next insert must be D7.3,
    // because a driver may still be holding a parcel marked D7.1.
    assert.equal(allocateInsertedStopId('D7', ['D7', 'D7.2']), 'D7.3')
  })

  test('inserts on different roots do not interfere', () => {
    const ids = ['D7', 'D8', 'D7.1']
    assert.equal(allocateInsertedStopId('D8', ids), 'D8.1')
    assert.equal(allocateInsertedStopId('D7', ids), 'D7.2')
  })

  test('grandchildren do not raise the parent suffix counter', () => {
    // D7.2.5 is a child of D7.2, not of D7, so the next child of D7 is D7.3.
    assert.equal(allocateInsertedStopId('D7', ['D7', 'D7.2', 'D7.2.5']), 'D7.3')
  })

  test('works in numeric mode', () => {
    assert.equal(allocateInsertedStopId('37', ['36', '37', '38']), '37.1')
    assert.equal(allocateInsertedStopId('37', ['37', '37.1']), '37.2')
  })

  test('inserted ids sort immediately after their parent', () => {
    const ids = ['D7', 'D8', 'D7.2', 'D7.10', 'D7.1']
    assert.deepEqual([...ids].sort(compareStopIds), ['D7', 'D7.1', 'D7.2', 'D7.10', 'D8'])
  })
})

describe('appending', () => {
  test('a 41st stop on a 40-stop route is E1', () => {
    const ids = assignStopIds(40)
    assert.deepEqual(allocateAppendedStopId(40, ids), { stopId: 'E1', originalPosition: 41 })
  })

  test('an 11th stop on a 10-stop route is B1', () => {
    assert.deepEqual(allocateAppendedStopId(10, assignStopIds(10)), {
      stopId: 'B1', originalPosition: 11,
    })
  })

  test('falls back to a suffix rather than colliding', () => {
    // Contrived but reachable: E1 already exists after a reset.
    assert.deepEqual(allocateAppendedStopId(40, ['E1']), {
      stopId: 'E1.1', originalPosition: 41,
    })
  })
})

describe('reset', () => {
  test('reassigns ids and rebases originalPosition from the current order', () => {
    const reset = resetStopIds(12)
    assert.equal(reset.length, 12)
    assert.deepEqual(reset[0], { stopId: 'A1', originalPosition: 1 })
    assert.deepEqual(reset[9], { stopId: 'A10', originalPosition: 10 })
    assert.deepEqual(reset[10], { stopId: 'B1', originalPosition: 11 })
  })

  test('clears decimal suffixes — everything becomes an original again', () => {
    const reset = resetStopIds(3)
    assert.ok(reset.every((r) => !r.stopId.includes('.')))
  })

  test('respects numeric mode', () => {
    assert.deepEqual(resetStopIds(3, 'numeric').map((r) => r.stopId), ['1', '2', '3'])
  })
})

describe('the property that matters: ids never change under reordering', () => {
  test('reordering a route leaves every id untouched', () => {
    const stops = assignStopIds(50).map((stopId, i) => ({ stopId, originalPosition: i + 1 }))

    // Reverse the route, as a reoptimisation might.
    const reordered = [...stops].reverse()

    // Sequence changed completely…
    assert.equal(reordered[0].stopId, 'E10')
    assert.equal(reordered[49].stopId, 'A1')

    // …but each stop's id still matches its ORIGINAL position.
    for (const stop of reordered) {
      assert.equal(stop.stopId, stopIdForPosition(stop.originalPosition))
    }
  })

  test('the 37th stop is D7 no matter where it ends up', () => {
    const stops = assignStopIds(50).map((stopId, i) => ({ stopId, originalPosition: i + 1 }))
    const thirtySeventh = stops.find((s) => s.originalPosition === 37)
    assert.equal(thirtySeventh?.stopId, 'D7')

    const shuffled = [...stops].sort(() => Math.random() - 0.5)
    assert.equal(shuffled.find((s) => s.originalPosition === 37)?.stopId, 'D7')
  })
})
