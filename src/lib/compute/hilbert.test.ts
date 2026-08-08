import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { hilbertD, hilbertOrder } from './hilbert.ts'

describe('hilbertD', () => {
  test('is a bijection on the 4x4 grid — every cell has its own distance', () => {
    const seen = new Set<number>()
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) seen.add(hilbertD(2, x, y))
    }
    assert.equal(seen.size, 16)
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i))
  })

  test('consecutive curve positions are grid neighbours', () => {
    // This is the property the whole thing rests on, and the one a Z-order
    // curve does NOT have. If the quadrant rotation were dropped this fails.
    const bits = 3
    const side = 1 << bits
    const cells: { x: number; y: number }[] = new Array(side * side)
    for (let x = 0; x < side; x++) {
      for (let y = 0; y < side; y++) cells[hilbertD(bits, x, y)] = { x, y }
    }
    for (let d = 1; d < cells.length; d++) {
      const step = Math.abs(cells[d].x - cells[d - 1].x) + Math.abs(cells[d].y - cells[d - 1].y)
      assert.equal(step, 1, `jump of ${step} between curve positions ${d - 1} and ${d}`)
    }
  })
})

describe('hilbertOrder', () => {
  test('returns a permutation of the input indices', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({
      lat: 55.6 + Math.sin(i) * 0.05,
      lng: 12.5 + Math.cos(i * 1.7) * 0.05,
    }))
    const order = hilbertOrder(points)
    assert.equal(order.length, 50)
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i))
  })

  test('orders a grid better than input order does', () => {
    // A 6x6 lattice fed in row-major order has long jumps at every row end.
    // The curve should shorten the total straight-line path substantially.
    const points: { lat: number; lng: number }[] = []
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) points.push({ lat: 55 + r * 0.01, lng: 12 + c * 0.01 })
    }
    const walk = (order: ArrayLike<number>) => {
      let total = 0
      for (let i = 1; i < order.length; i++) {
        const a = points[order[i - 1]]
        const b = points[order[i]]
        total += Math.hypot(a.lat - b.lat, a.lng - b.lng)
      }
      return total
    }
    const naive = walk(Array.from({ length: points.length }, (_, i) => i))
    assert.ok(walk(hilbertOrder(points)) < naive)
  })

  test('a degenerate cloud falls back to input order rather than throwing', () => {
    const same = Array.from({ length: 5 }, () => ({ lat: 55.6, lng: 12.5 }))
    assert.deepEqual([...hilbertOrder(same)], [0, 1, 2, 3, 4])
  })

  test('a single point and an empty list are not special cases to the caller', () => {
    assert.deepEqual([...hilbertOrder([])], [])
    assert.deepEqual([...hilbertOrder([{ lat: 1, lng: 2 }])], [0])
  })

  test('collinear points still order along the line', () => {
    // Zero span in one axis used to be a division by zero.
    const points = [3, 1, 4, 0, 2].map((i) => ({ lat: 55.6, lng: 12.5 + i * 0.01 }))
    const order = [...hilbertOrder(points)]
    assert.deepEqual(order.map((i) => points[i].lng), [12.5, 12.51, 12.52, 12.53, 12.54])
  })
})
