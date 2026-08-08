/**
 * A Hilbert-curve ordering, for the instant first answer.
 *
 * ── What it buys ──────────────────────────────────────────────────────────
 *
 * Cheapest insertion is O(n²) with a K-cap and it allocates; on a 300-stop
 * round that is real milliseconds before anything can be drawn. A space-filling
 * curve sorts the stops in O(n log n) with no matrix lookups at all, and the
 * result is a genuinely reasonable tour — points close on a Hilbert curve are
 * close in the plane, which is the whole property the curve is famous for.
 *
 * So the engine has something to show almost immediately, and the real
 * construction replaces it a moment later. The alternative — a blank screen
 * until cheapest-insertion finishes — is worse for exactly the users on the
 * slowest devices.
 *
 * ── Why not just use it and stop ──────────────────────────────────────────
 *
 * Because it ignores the cost matrix entirely. It knows nothing about one-way
 * streets, rivers, or the fact that two points 50 m apart are a 4 km drive.
 * It is a seed, not an answer.
 *
 * ── Why d2xy is absent ────────────────────────────────────────────────────
 *
 * Only the forward mapping (x,y) -> curve distance is needed, because all we do
 * is sort by it. The inverse is what you need to WALK a curve, and we never do.
 *
 * Pure module: no matrix, no engine, no I/O.
 */

/**
 * Distance along a Hilbert curve of order `bits` for a point on the 2^bits grid.
 *
 * The rotation step is what distinguishes a Hilbert curve from a Z-order (Morton)
 * curve, and it is the reason the Hilbert curve has no long jumps: consecutive
 * curve positions are always grid neighbours. Z-order is cheaper to compute and
 * produces visibly worse tours, so the rotation earns its keep.
 */
export function hilbertD(bits: number, x: number, y: number): number {
  let rx = 0
  let ry = 0
  let d = 0
  let px = x
  let py = y

  for (let s = 1 << (bits - 1); s > 0; s >>= 1) {
    rx = (px & s) > 0 ? 1 : 0
    ry = (py & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)

    // Rotate the quadrant so the curve stays connected across quadrant borders.
    if (ry === 0) {
      if (rx === 1) {
        px = s - 1 - px
        py = s - 1 - py
      }
      const swap = px
      px = py
      py = swap
    }
  }
  return d
}

export interface HilbertPoint {
  lat: number
  lng: number
}

/**
 * The indices of `points`, ordered along a Hilbert curve.
 *
 * Coordinates are normalised against the bounding box of the input rather than
 * against the whole globe: a delivery round covers a few kilometres, and
 * quantising that to a global grid would collapse every stop onto a handful of
 * cells and destroy the ordering. A degenerate box (every stop at one
 * coordinate, or a single stop) is handled by falling back to input order,
 * because there is nothing to sort.
 *
 * 16 bits gives a 65,536² grid — far finer than any real round needs, and still
 * well inside the exact-integer range of a double for `s * s * (...)`.
 */
export function hilbertOrder(points: readonly HilbertPoint[], bits = 16): Int32Array {
  const n = points.length
  const order = new Int32Array(n)
  for (let i = 0; i < n; i++) order[i] = i
  if (n < 3) return order

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (let i = 0; i < n; i++) {
    const { lat, lng } = points[i]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  const spanLat = maxLat - minLat
  const spanLng = maxLng - minLng
  if (!(spanLat > 0) && !(spanLng > 0)) return order

  const side = (1 << bits) - 1
  const keys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const { lat, lng } = points[i]
    const x = spanLng > 0 ? Math.round(((lng - minLng) / spanLng) * side) : 0
    const y = spanLat > 0 ? Math.round(((lat - minLat) / spanLat) * side) : 0
    keys[i] = hilbertD(bits, x, y)
  }

  // Sorting the index array rather than the points keeps the caller's indices
  // meaningful — the engine works in matrix indices and cannot afford to lose
  // which row a point came from.
  const sorted = Array.from(order)
  sorted.sort((a, b) => keys[a] - keys[b])
  return Int32Array.from(sorted)
}
