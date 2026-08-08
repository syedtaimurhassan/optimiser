import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  FLING_VELOCITY,
  SNAPS,
  clampOffset,
  listScrolls,
  nearestSnap,
  nextSnapUp,
  prevSnapDown,
  snapFor,
  snapHeights,
  snapOffsets,
} from './sheetSnap.ts'

/** A 390×844 phone with a measured 112px collapsed sheet. */
const PHONE = { viewportHeight: 844, collapsedHeight: 112 }

describe('snapHeights', () => {
  test('the four detents rise in order', () => {
    const h = snapHeights(PHONE)
    assert.ok(h.collapsed < h.medium)
    assert.ok(h.medium < h.expanded)
    assert.ok(h.expanded < h.full)
  })

  test('collapsed is exactly what was measured — the header must always show', () => {
    assert.equal(snapHeights(PHONE).collapsed, 112)
  })

  test('full leaves the status bar clear', () => {
    assert.equal(snapHeights({ ...PHONE, topInset: 24 }).full, 820)
  })

  /**
   * Landscape on a small phone: 45% of 320px is 144px, which is BELOW the
   * measured collapsed height. Without clamping, "medium" would be a smaller
   * sheet than "collapsed" and dragging up would move the sheet down.
   */
  test('a viewport too short for the percentages still yields a monotonic ladder', () => {
    const h = snapHeights({ viewportHeight: 320, collapsedHeight: 200 })
    assert.ok(h.collapsed <= h.medium)
    assert.ok(h.medium <= h.expanded)
    assert.ok(h.expanded <= h.full)
  })

  test('a collapsed height taller than the viewport cannot exceed full', () => {
    const h = snapHeights({ viewportHeight: 300, collapsedHeight: 900 })
    assert.ok(h.collapsed <= h.full)
  })
})

describe('snapOffsets', () => {
  test('offset is the room left above the sheet', () => {
    const o = snapOffsets(PHONE)
    assert.equal(o.collapsed, 844 - 112)
    assert.equal(o.full, 24)
  })

  test('a bigger sheet means a smaller offset', () => {
    const o = snapOffsets(PHONE)
    assert.ok(o.collapsed > o.medium)
    assert.ok(o.medium > o.expanded)
    assert.ok(o.expanded > o.full)
  })
})

describe('snapFor — a slow drag lands where you put it', () => {
  const offsets = snapOffsets(PHONE)

  test('released near a detent, it takes that detent', () => {
    assert.equal(snapFor({ offset: offsets.medium + 4, velocity: 0, offsets }), 'medium')
    assert.equal(snapFor({ offset: offsets.expanded - 3, velocity: 0, offsets }), 'expanded')
  })

  test('released between two, the nearer one wins', () => {
    const between = (offsets.collapsed + offsets.medium) / 2
    assert.equal(snapFor({ offset: between - 20, velocity: 0, offsets }), 'medium')
    assert.equal(snapFor({ offset: between + 20, velocity: 0, offsets }), 'collapsed')
  })

  test('a drag slower than the fling threshold is still a drag', () => {
    const decision = snapFor({
      offset: offsets.collapsed - 4,
      velocity: -(FLING_VELOCITY - 0.01),
      offsets,
    })
    assert.equal(decision, 'collapsed')
  })
})

describe('snapFor — a fling goes one detent further, in the direction of travel', () => {
  const offsets = snapOffsets(PHONE)

  test('flicking up from collapsed opens to medium, not straight to full', () => {
    assert.equal(snapFor({ offset: offsets.collapsed, velocity: -1.2, offsets }), 'medium')
  })

  test('flicking down from full closes one detent', () => {
    assert.equal(snapFor({ offset: offsets.full, velocity: 1.2, offsets }), 'expanded')
  })

  /**
   * The case that makes this "past the release point" rather than "one from
   * where the gesture began": drag most of the way open, then flick. The sheet
   * must continue past the thumb, never snap back behind it.
   */
  test('a long drag followed by a flick continues past the finger', () => {
    const nearlyExpanded = offsets.expanded + 10
    assert.equal(snapFor({ offset: nearlyExpanded, velocity: -1.5, offsets }), 'expanded')
  })

  test('a fling with nowhere further to go stops at the end of the ladder', () => {
    assert.equal(snapFor({ offset: offsets.full, velocity: -2, offsets }), 'full')
    assert.equal(snapFor({ offset: offsets.collapsed, velocity: 2, offsets }), 'collapsed')
  })

  test('a fling never moves backwards, from any release point', () => {
    for (const from of SNAPS) {
      const up = snapFor({ offset: offsets[from], velocity: -1, offsets })
      const down = snapFor({ offset: offsets[from], velocity: 1, offsets })
      assert.ok(offsets[up] <= offsets[from], `${from} flicked up went down`)
      assert.ok(offsets[down] >= offsets[from], `${from} flicked down went up`)
    }
  })
})

describe('the ladder', () => {
  test('nearestSnap on an exact offset returns that snap', () => {
    const offsets = snapOffsets(PHONE)
    for (const snap of SNAPS) {
      assert.equal(nearestSnap(offsets[snap], offsets), snap)
    }
  })

  test('a drag cannot tear the sheet off the top or push it off the bottom', () => {
    const offsets = snapOffsets(PHONE)
    assert.equal(clampOffset(-500, offsets), offsets.full)
    assert.equal(clampOffset(5000, offsets), offsets.collapsed)
  })

  test('tapping steps one detent, and stops at the ends', () => {
    assert.equal(nextSnapUp('collapsed'), 'medium')
    assert.equal(nextSnapUp('full'), 'full')
    assert.equal(prevSnapDown('medium'), 'collapsed')
    assert.equal(prevSnapDown('collapsed'), 'collapsed')
  })

  test('the list only scrolls once the sheet is expanded', () => {
    assert.equal(listScrolls('collapsed'), false)
    assert.equal(listScrolls('medium'), false)
    assert.equal(listScrolls('expanded'), true)
    assert.equal(listScrolls('full'), true)
  })
})
