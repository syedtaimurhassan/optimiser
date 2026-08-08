import {
  abortError,
  arcSum,
  capacityFor,
  costMatrixFor,
  effectiveOptional,
  makeRng,
  resolveEndpoints,
  toResult,
  type SolveProgress,
  type SolveRequest,
  type SolveResult,
  type SolverEngine,
} from './solverPort.ts'

/**
 * The TypeScript engine — our floor, and our correctness reference.
 *
 * ── Why this is a real engine and not a stub ──────────────────────────────
 *
 * Two jobs. It is the engine that runs when nothing else can (no WASM, no
 * workers, an ancient browser), so it has to be good enough to ship. And it is
 * the oracle every faster engine is checked against, so it has to be RIGHT — a
 * Rust engine that disagrees with this one is a bug in one of them, and without
 * a trustworthy reference there is no way to say which.
 *
 * ── What it does ──────────────────────────────────────────────────────────
 *
 *   seed          space-filling-curve order, if the caller supplied one
 *   construct     cheapest insertion under the K cap
 *   improve       2-opt + Or-opt(1..3), first-improvement, don't-look bits,
 *                 over K-nearest candidate lists
 *   select        add / drop / swap moves, so the K cap is searched and not
 *                 merely obeyed
 *   drive         iterated local search, double-bridge perturbation
 *
 * The pre-M9 solver was best-of-seven CONSTRUCTION with no local search at all,
 * because the WASM binding never forwarded a metaheuristic. Published figures
 * put nearest-neighbour ~25% above optimal, greedy 15-20%, 2-opt ~5%, and
 * 2-opt+Or-opt ~4%, so a plain descent should beat the entire old portfolio.
 * `npm run bench -- --engine=all` is what settles it.
 *
 * ── The asymmetry problem, and the trick that solves it ───────────────────
 *
 * Real driving matrices are asymmetric — 98.3% of pairs in the cached OSRM
 * fixture disagree with their reverse. 2-opt REVERSES a segment, so every arc
 * inside it flips direction, and the textbook O(1) delta
 *
 *     d(a,c) + d(b,e) - d(a,b) - d(c,e)
 *
 * is simply WRONG here: it silently omits the cost of turning the segment
 * round. An engine using it accepts losing moves and cannot tell.
 *
 * The exact extra term is
 *
 *     R(i,j) = Σ_{t=i..j-1} ( d[p[t+1]][p[t]] - d[p[t]][p[t+1]] )
 *
 * and evaluating it directly is O(len), which would make a sweep O(n³). So the
 * tour carries running prefix sums of its forward and backward arc costs:
 *
 *     F[t] = Σ_{s<t} d[p[s]][p[s+1]]        B[t] = Σ_{s<t} d[p[s+1]][p[s]]
 *     R(i,j) = (B[j] - B[i]) - (F[j] - F[i])          ← O(1), exact, any i,j
 *
 * Rebuilt in O(n) per ACCEPTED move, which is rare. Evaluation stays O(1), so
 * candidate lists and don't-look bits still do their job.
 *
 * These same prefix arrays are where M11's four Vidal labels (duration, time
 * warp, earliest start, latest start) will live, which is why the tour is an
 * array with a position index rather than a linked list: a linked list has no
 * index, so it has no prefixes, and M11 would be a rewrite instead of an
 * addition.
 *
 * ── Open ends ─────────────────────────────────────────────────────────────
 *
 * Start and end may each be pinned or free. Rather than four code paths, a free
 * end is modelled as a virtual neighbour whose arcs all cost zero — the same
 * device the OR-Tools model used with its virtual depots. `arcIn`/`arcOut`
 * below are the only places that know about it.
 *
 * Pure `lib/`: no React, no store, no DOM.
 */

/** How many nearest neighbours each node keeps. */
const CANDIDATES = 10

/** Longest segment Or-opt will relocate. */
const MAX_SEGMENT = 3

/** Yield to the event loop at least this often, so the UI keeps painting. */
const YIELD_INTERVAL_MS = 12

/** Report progress at most this often. Cheap, but not free. */
const PROGRESS_INTERVAL_MS = 100

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Everything one solve needs, allocated once.
 *
 * A class rather than closures because the inner loops touch these fields
 * millions of times and a megamorphic closure environment is the kind of thing
 * that quietly costs 30%.
 */
export class Search {
  readonly n: number
  readonly cells: Int32Array
  readonly skipPenalty: number
  readonly start: number | null
  readonly end: number | null
  readonly optional: Uint8Array
  readonly cap: number

  /** K nearest neighbours per node, ascending. `n * width` entries. */
  readonly candidates: Int32Array
  readonly width: number

  /** The route, as matrix indices. Only the first `length` entries are live. */
  tour: Int32Array
  length = 0
  /** Position of each node in `tour`, or -1 when it is not in the route. */
  pos: Int32Array

  /** Forward and backward prefix sums over `tour`. See the header. */
  private forward: Float64Array
  private backward: Float64Array

  private dontLook: Uint8Array
  private queue: Int32Array
  private queued: Uint8Array
  private queueHead = 0
  private queueTail = 0

  /** Scratch for building a perturbed tour, so ILS allocates nothing per pass. */
  private scratch: Int32Array

  constructor(request: SolveRequest) {
    const { matrix } = request
    this.n = matrix.n
    this.cells = costMatrixFor(matrix, request.objective)
    this.skipPenalty = request.skipPenalty
    const { start, end } = resolveEndpoints(request)
    this.start = start
    this.end = end
    this.optional = effectiveOptional(request)
    this.cap = capacityFor(request)

    this.width = Math.min(CANDIDATES, Math.max(1, this.n - 1))
    this.candidates = new Int32Array(this.n * this.width)
    this.buildCandidates()

    this.tour = new Int32Array(this.n)
    this.pos = new Int32Array(this.n).fill(-1)
    this.forward = new Float64Array(this.n + 1)
    this.backward = new Float64Array(this.n + 1)
    this.dontLook = new Uint8Array(this.n)
    this.queue = new Int32Array(this.n)
    this.queued = new Uint8Array(this.n)
    this.scratch = new Int32Array(this.n)
  }

  // ───────────────────────────────────────────────────────── candidates

  /**
   * K nearest neighbours per node, by `min(d[i][j], d[j][i])`.
   *
   * Symmetrised deliberately. A candidate list is asking "might these two ever
   * be adjacent", and they might be adjacent in either order — taking only the
   * forward cost would hide every pair that is cheap one way and dear the
   * other, which on a one-way street is most of them.
   *
   * Insertion into a K-sized sorted window: O(n·K) per node rather than a full
   * sort's O(n log n), and K is 10.
   */
  private buildCandidates(): void {
    const { n, width, cells, candidates } = this
    const bestCost = new Float64Array(width)

    for (let i = 0; i < n; i++) {
      let filled = 0
      bestCost.fill(Infinity)
      const base = i * width

      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const a = cells[i * n + j]
        const b = cells[j * n + i]
        const cost = a < b ? a : b
        if (filled === width && cost >= bestCost[width - 1]) continue

        let slot = filled < width ? filled : width - 1
        while (slot > 0 && bestCost[slot - 1] > cost) {
          bestCost[slot] = bestCost[slot - 1]
          candidates[base + slot] = candidates[base + slot - 1]
          slot--
        }
        bestCost[slot] = cost
        candidates[base + slot] = j
        if (filled < width) filled++
      }

      // A tiny instance can have fewer than `width` other nodes; pad with the
      // last real entry so the inner loops never read an uninitialised zero and
      // mistake it for node 0.
      for (let s = filled; s < width; s++) candidates[base + s] = candidates[base + (filled || 1) - 1]
    }
  }

  // ──────────────────────────────────────────────────────── tour basics

  /** Cost of the arc entering position `i` from its predecessor. Free end = 0. */
  private arcIn(i: number, node: number): number {
    if (i === 0) return 0
    return this.cells[this.tour[i - 1] * this.n + node]
  }

  /** Cost of the arc leaving position `j` to its successor. Free end = 0. */
  private arcOut(j: number, node: number): number {
    if (j === this.length - 1) return 0
    return this.cells[node * this.n + this.tour[j + 1]]
  }

  /** Lowest position an interior move may touch: 1 if the start is pinned. */
  private get lo(): number {
    return this.start === null ? 0 : 1
  }

  /** Highest position an interior move may touch. */
  private get hi(): number {
    return this.end === null ? this.length - 1 : this.length - 2
  }

  /** Recompute the prefix sums. O(n), and only after a move is ACCEPTED. */
  refresh(): void {
    const { tour, cells, n, length, forward, backward } = this
    forward[0] = 0
    backward[0] = 0
    for (let t = 1; t < length; t++) {
      const prev = tour[t - 1]
      const cur = tour[t]
      forward[t] = forward[t - 1] + cells[prev * n + cur]
      backward[t] = backward[t - 1] + cells[cur * n + prev]
    }
    for (let t = 0; t < length; t++) this.pos[tour[t]] = t
  }

  /** Total arc cost of the current route. */
  cost(): number {
    return this.forward[this.length - 1] ?? 0
  }

  /** Arcs plus a penalty for every optional node left out. The referee's formula. */
  objective(): number {
    let skipped = 0
    for (let i = 0; i < this.n; i++) {
      if (this.optional[i] === 1 && this.pos[i] === -1) skipped++
    }
    return this.cost() + this.skipPenalty * skipped
  }

  /** How many optional nodes the route currently visits. */
  private optionalVisited(): number {
    let count = 0
    for (let t = 0; t < this.length; t++) {
      if (this.optional[this.tour[t]] === 1) count++
    }
    return count
  }

  snapshot(): Int32Array {
    return this.tour.slice(0, this.length)
  }

  restore(order: Int32Array): void {
    this.tour.set(order)
    this.length = order.length
    this.pos.fill(-1)
    this.refresh()
  }

  // ───────────────────────────────────────────────────────── don't-look

  private resetQueue(): void {
    this.dontLook.fill(0)
    this.queueHead = 0
    this.queueTail = 0
    this.queued.fill(0)
    for (let t = 0; t < this.length; t++) this.push(this.tour[t])
  }

  private push(node: number): void {
    if (this.queued[node] === 1) return
    this.queued[node] = 1
    this.queue[this.queueTail % this.n] = node
    this.queueTail++
  }

  private pop(): number {
    while (this.queueHead < this.queueTail) {
      const node = this.queue[this.queueHead % this.n]
      this.queueHead++
      this.queued[node] = 0
      if (this.pos[node] !== -1) return node
    }
    return -1
  }

  /** Wake a node and its tour neighbours — the ones a move just invalidated. */
  private wake(node: number): void {
    if (node < 0) return
    this.push(node)
    const p = this.pos[node]
    if (p > 0) this.push(this.tour[p - 1])
    if (p >= 0 && p < this.length - 1) this.push(this.tour[p + 1])
  }

  // ──────────────────────────────────────────────────────────── 2-opt

  /**
   * Exact delta of reversing `tour[i..j]`, asymmetry included.
   *
   * The `R(i,j)` term is the whole reason this engine keeps prefix sums; see
   * the module header for the derivation.
   */
  reverseDelta(i: number, j: number): number {
    const a = this.tour[i]
    const b = this.tour[j]
    const removed = this.arcIn(i, a) + this.arcOut(j, b)
    const added = this.arcIn(i, b) + this.arcOut(j, a)
    const reversalCost =
      this.backward[j] - this.backward[i] - (this.forward[j] - this.forward[i])
    return added - removed + reversalCost
  }

  applyReverse(i: number, j: number): void {
    const { tour } = this
    let a = i
    let b = j
    while (a < b) {
      const swap = tour[a]
      tour[a] = tour[b]
      tour[b] = swap
      a++
      b--
    }
    this.refresh()
  }

  /**
   * One node's 2-opt neighbourhood, first improvement.
   *
   * For node `a` and each candidate `c` there are two ways a reversal can put
   * them next to each other — `a` can end up before `c` or after it — and both
   * are tried, because with an asymmetric matrix they are genuinely different
   * moves with different costs.
   */
  private twoOptFrom(a: number): boolean {
    const p = this.pos[a]
    if (p < 0) return false
    const { candidates, width, lo, hi } = this
    const base = a * width

    for (let s = 0; s < width; s++) {
      const c = candidates[base + s]
      const q = this.pos[c]
      if (q < 0) continue

      // `a` before `c`: reverse (p+1 .. q), creating the arc a -> c.
      if (q >= p + 1 && p + 1 >= lo && q <= hi) {
        const delta = this.reverseDelta(p + 1, q)
        if (delta < -1e-9) {
          this.applyReverse(p + 1, q)
          this.wake(a)
          this.wake(c)
          return true
        }
      }

      // `c` before `a`: reverse (q+1 .. p), creating the arc c -> a.
      if (p >= q + 1 && q + 1 >= lo && p <= hi) {
        const delta = this.reverseDelta(q + 1, p)
        if (delta < -1e-9) {
          this.applyReverse(q + 1, p)
          this.wake(a)
          this.wake(c)
          return true
        }
      }
    }
    return false
  }

  // ─────────────────────────────────────────────────────────── Or-opt

  /**
   * Delta of lifting `tour[p .. p+len-1]` out and dropping it back between the
   * two nodes that sit either side of gap `u` in the SHORTENED tour.
   *
   * Working in shortened-tour coordinates is what keeps this honest. Computing
   * the insertion against the original positions is the classic Or-opt bug:
   * every index after the removed segment has shifted by `len`, and a delta
   * that ignores that is wrong only sometimes, which is the worst way to be
   * wrong.
   */
  orOptDelta(p: number, len: number, u: number, reversed: boolean): number {
    const { tour, cells, n, length } = this
    const first = tour[p]
    const last = tour[p + len - 1]

    const prev = p > 0 ? tour[p - 1] : -1
    const next = p + len < length ? tour[p + len] : -1

    // Closing the hole the segment leaves behind.
    const removal =
      (prev >= 0 ? -cells[prev * n + first] : 0) +
      (next >= 0 ? -cells[last * n + next] : 0) +
      (prev >= 0 && next >= 0 ? cells[prev * n + next] : 0)

    // Gap `u` in the shortened tour lies between these two nodes.
    const shortened = length - len
    const at = (t: number): number => (t < p ? tour[t] : tour[t + len])
    const left = u > 0 ? at(u - 1) : -1
    const right = u < shortened ? at(u) : -1

    const head = reversed ? last : first
    const tail = reversed ? first : last

    const insertion =
      (left >= 0 ? cells[left * n + head] : 0) +
      (right >= 0 ? cells[tail * n + right] : 0) -
      (left >= 0 && right >= 0 ? cells[left * n + right] : 0)

    // Turning the segment round flips its internal arcs. At most two terms,
    // because the segment is at most three nodes long.
    let internal = 0
    if (reversed && len > 1) {
      for (let t = 0; t < len - 1; t++) {
        const x = tour[p + t]
        const y = tour[p + t + 1]
        internal += cells[y * n + x] - cells[x * n + y]
      }
    }

    return removal + insertion + internal
  }

  applyOrOpt(p: number, len: number, u: number, reversed: boolean): void {
    const { tour, scratch, length } = this
    const segment = scratch.subarray(0, len)
    for (let t = 0; t < len; t++) segment[t] = tour[p + t]
    if (reversed) segment.reverse()

    // Close the hole, then open a new one at `u`. Two memmoves, no allocation.
    tour.copyWithin(p, p + len, length)
    const shortened = length - len
    tour.copyWithin(u + len, u, shortened)
    tour.set(segment, u)
    this.refresh()
  }

  /**
   * Or-opt around one node, first improvement.
   *
   * The segment always STARTS at `a`, and the insertion points tried are the
   * gaps beside `a`'s candidates. Trying every gap would be O(n) per segment
   * and would swamp the candidate lists that make the rest of this cheap.
   */
  private orOptFrom(a: number): boolean {
    const p = this.pos[a]
    if (p < 0) return false
    const { candidates, width, length, lo, hi } = this

    for (let len = 1; len <= MAX_SEGMENT; len++) {
      if (p + len - 1 > hi || p < lo) break
      if (length - len < 1) break

      const base = a * width
      for (let s = 0; s < width; s++) {
        const c = candidates[base + s]
        const q = this.pos[c]
        // A node inside the segment cannot also be the thing it is placed next to.
        if (q < 0 || (q >= p && q < p + len)) continue

        // Gap indices in the shortened tour, either side of `c`.
        const shifted = q > p ? q - len : q
        for (const u of [shifted, shifted + 1]) {
          const shortened = length - len
          const loGap = this.start === null ? 0 : 1
          const hiGap = this.end === null ? shortened : shortened - 1
          if (u < loGap || u > hiGap) continue
          if (u === p) continue // putting it back where it came from

          for (const reversed of [false, true]) {
            if (reversed && len === 1) continue
            const delta = this.orOptDelta(p, len, u, reversed)
            if (delta < -1e-9) {
              const moved = this.tour.slice(p, p + len)
              this.applyOrOpt(p, len, u, reversed)
              for (let t = 0; t < moved.length; t++) this.wake(moved[t])
              this.wake(c)
              return true
            }
          }
        }
      }
    }
    return false
  }

  // ────────────────────────────────────────────────── add / drop / swap

  /** Cheapest gap for an absent node, as (gap index, cost). */
  private bestInsertion(node: number): { at: number; cost: number } {
    const { cells, n, length, tour } = this
    const loGap = this.start === null ? 0 : 1
    const hiGap = this.end === null ? length : length - 1

    let bestAt = loGap
    let bestCost = Infinity
    for (let u = loGap; u <= hiGap; u++) {
      const left = u > 0 ? tour[u - 1] : -1
      const right = u < length ? tour[u] : -1
      const cost =
        (left >= 0 ? cells[left * n + node] : 0) +
        (right >= 0 ? cells[node * n + right] : 0) -
        (left >= 0 && right >= 0 ? cells[left * n + right] : 0)
      if (cost < bestCost) {
        bestCost = cost
        bestAt = u
      }
    }
    return { at: bestAt, cost: bestCost }
  }

  /** What removing the node at position `p` saves in arcs. */
  private removalGain(p: number): number {
    const { cells, n, tour, length } = this
    const node = tour[p]
    const prev = p > 0 ? tour[p - 1] : -1
    const next = p + 1 < length ? tour[p + 1] : -1
    return (
      (prev >= 0 ? cells[prev * n + node] : 0) +
      (next >= 0 ? cells[node * n + next] : 0) -
      (prev >= 0 && next >= 0 ? cells[prev * n + next] : 0)
    )
  }

  private insertAt(node: number, u: number): void {
    this.tour.copyWithin(u + 1, u, this.length)
    this.tour[u] = node
    this.length++
    this.refresh()
  }

  private removeAt(p: number): void {
    const node = this.tour[p]
    this.tour.copyWithin(p, p + 1, this.length)
    this.length--
    this.pos[node] = -1
    this.refresh()
  }

  /**
   * Search the K cap rather than merely obeying it.
   *
   * Without these three moves, which candidates get visited is decided entirely
   * by the construction heuristic and never revisited. That is precisely the
   * failure the bench's `decoy` family is built to expose: a greedy build walks
   * a ring of cheap near stops, spends its whole budget, and never reaches the
   * cluster that was worth going to.
   */
  private selectionPass(): boolean {
    let improved = false

    // Drop: an optional node whose detour costs more than skipping it.
    for (let p = this.length - 1; p >= 0; p--) {
      if (p < this.lo || p > this.hi) continue
      const node = this.tour[p]
      if (this.optional[node] !== 1) continue
      if (this.removalGain(p) - this.skipPenalty > 1e-9) {
        this.removeAt(p)
        improved = true
      }
    }

    // Add: an absent optional node cheaper to visit than to skip.
    if (this.optionalVisited() < this.cap) {
      for (let node = 0; node < this.n; node++) {
        if (this.optional[node] !== 1 || this.pos[node] !== -1) continue
        if (this.optionalVisited() >= this.cap) break
        const { at, cost } = this.bestInsertion(node)
        if (cost - this.skipPenalty < -1e-9) {
          this.insertAt(node, at)
          this.wake(node)
          improved = true
        }
      }
    }

    // Swap: only bites when the cap is binding, which is exactly when the
    // choice of WHICH stops to visit is the whole problem.
    if (this.optionalVisited() >= this.cap) {
      for (let node = 0; node < this.n; node++) {
        if (this.optional[node] !== 1 || this.pos[node] !== -1) continue
        const entering = this.bestInsertion(node)
        let worstAt = -1
        let worstGain = -Infinity
        for (let p = this.lo; p <= this.hi && p < this.length; p++) {
          if (this.optional[this.tour[p]] !== 1) continue
          const gain = this.removalGain(p)
          if (gain > worstGain) {
            worstGain = gain
            worstAt = p
          }
        }
        if (worstAt >= 0 && entering.cost - worstGain < -1e-9) {
          const leaving = this.tour[worstAt]
          this.removeAt(worstAt)
          const { at } = this.bestInsertion(node)
          this.insertAt(node, at)
          this.wake(node)
          this.wake(leaving)
          improved = true
        }
      }
    }

    return improved
  }

  // ───────────────────────────────────────────────────── local search

  /**
   * Descend to a local optimum.
   *
   * Don't-look bits are what make this affordable: a node is only re-examined
   * when a move actually changed something next to it, so a converged region of
   * the route stops being scanned entirely.
   */
  localSearch(deadline: number): void {
    this.resetQueue()
    let sinceClockCheck = 0

    for (;;) {
      const node = this.pop()
      if (node === -1) {
        if (!this.selectionPass()) break
        this.resetQueue()
        continue
      }

      if (this.twoOptFrom(node) || this.orOptFrom(node)) {
        this.push(node)
      }

      // Date.now() is not free; once every 256 moves is often enough to keep
      // the budget honest without the clock becoming the bottleneck.
      if ((sinceClockCheck++ & 0xff) === 0 && Date.now() >= deadline) break
    }
  }

  // ───────────────────────────────────────────────────── perturbation

  /**
   * Double bridge — a 4-opt move that 2-opt and Or-opt cannot undo in one step.
   *
   * That is the entire point of it. A perturbation the local search can walk
   * straight back out of leaves the driver oscillating around one optimum
   * instead of exploring, so segment reversal is deliberately not used here.
   */
  doubleBridge(rng: () => number): boolean {
    // The last cut may not detach a pinned end, and the first may not detach a
    // pinned start.
    const aMin = 1
    const cMax = this.end === null ? this.length : this.length - 1
    if (cMax - aMin < 3) return false

    // Drawn nested rather than drawn-and-sorted. Three independent draws collide
    // often on a short route — on an eight-stop round roughly half the time —
    // and a collision means the perturbation silently does nothing while still
    // counting as a failed iteration. That is how a driver runs out of patience
    // without ever having searched.
    const a = aMin + Math.floor(rng() * (cMax - aMin - 1))
    const b = a + 1 + Math.floor(rng() * (cMax - a - 1))
    const c = b + 1 + Math.floor(rng() * (cMax - b))

    const { tour, scratch, length } = this
    let w = 0
    for (let t = 0; t < a; t++) scratch[w++] = tour[t]
    for (let t = b; t < c; t++) scratch[w++] = tour[t]
    for (let t = a; t < b; t++) scratch[w++] = tour[t]
    for (let t = c; t < length; t++) scratch[w++] = tour[t]
    tour.set(scratch.subarray(0, w))
    this.refresh()
    return true
  }

  /**
   * Rebuild from a shuffled offer order — a genuine restart, not a nudge.
   *
   * A double bridge explores the basin around one solution. When that basin is
   * exhausted the way out is a different construction entirely, which is what
   * this is for.
   */
  restart(rng: () => number): void {
    const offered = new Int32Array(this.n)
    for (let i = 0; i < this.n; i++) offered[i] = i
    for (let i = this.n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const swap = offered[i]
      offered[i] = offered[j]
      offered[j] = swap
    }
    this.construct(offered)
  }

  // ──────────────────────────────────────────────────────── construct

  /**
   * Build the first route: pinned ends, then cheapest insertion under the cap.
   *
   * `seedOrder` only decides the ORDER candidates are offered in, never where
   * they land. A space-filling-curve sort therefore makes the insertions
   * cheaper and more sensible without the seed being able to produce a route
   * the cost matrix disagrees with.
   */
  construct(seedOrder: Int32Array | undefined): void {
    this.length = 0
    this.pos.fill(-1)

    if (this.start !== null) this.tour[this.length++] = this.start
    if (this.end !== null) this.tour[this.length++] = this.end
    this.refresh()

    const offered: number[] = []
    if (seedOrder) {
      for (let i = 0; i < seedOrder.length; i++) {
        const node = seedOrder[i]
        if (node !== this.start && node !== this.end) offered.push(node)
      }
    }
    if (offered.length === 0) {
      for (let node = 0; node < this.n; node++) {
        if (node !== this.start && node !== this.end) offered.push(node)
      }
    }

    // Mandatory nodes first: they are going in regardless, and inserting them
    // into a fuller route is more expensive and no better.
    offered.sort((x, y) => this.optional[x] - this.optional[y])

    let optionalIn = 0
    for (const node of offered) {
      const isOptional = this.optional[node] === 1
      if (isOptional && optionalIn >= this.cap) continue
      const { at } = this.bestInsertion(node)
      this.insertAt(node, at)
      if (isOptional) optionalIn++
    }
  }
}

/**
 * The engine.
 *
 * Stateless between solves — every buffer belongs to a `Search`, which is
 * discarded when the solve ends. Two solves can therefore overlap without
 * corrupting each other, which matters because the app can start a new
 * optimisation while an old one is still unwinding after a cancel.
 */
export class TsEngine implements SolverEngine {
  readonly id: string

  constructor(id = 'ts') {
    this.id = id
  }

  /** Nothing to fetch and nothing to compile. Here to satisfy the port. */
  warmUp(): Promise<void> {
    return Promise.resolve()
  }

  async solve(
    request: SolveRequest,
    onProgress?: (progress: SolveProgress) => void,
    signal?: AbortSignal,
  ): Promise<SolveResult> {
    const { n } = request.matrix
    if (n < 2) throw new Error('Need at least two points to build a route.')
    if (signal?.aborted) throw abortError()

    const startedAt = Date.now()
    const deadline = startedAt + Math.max(0, request.budgetMs)
    const rng = makeRng(request.seed ?? 0x9e3779b9)
    const search = new Search(request)

    search.construct(request.seedOrder)
    search.localSearch(deadline)

    let best = search.snapshot()
    let bestObjective = search.objective()
    let iterations = 0
    let lastYield = Date.now()
    let lastProgress = 0

    const report = (force: boolean) => {
      if (!onProgress) return
      const now = Date.now()
      if (!force && now - lastProgress < PROGRESS_INTERVAL_MS) return
      lastProgress = now
      onProgress({ bestCost: bestObjective, iterations, elapsedMs: now - startedAt })
    }
    report(true)

    /*
      Iterated local search.

      The budget is a ceiling, not a quota — a driver at a kerb should not be
      made to wait out a five-second clock for a three-stop route that stopped
      changing in the first millisecond. But "stopped improving" has to mean
      something stronger than "the last few perturbations missed", which is what
      an impatient loop actually measures.

      So exhausting `patience` triggers a RESTART rather than a return, and only
      a run of barren restarts ends the search. The first version of this
      returned on patience alone and lost the optimum on an eight-stop instance
      it could solve exhaustively — it was quitting after forty perturbations
      with 119 ms of its budget unspent.
    */
    const patience = Math.max(100, 8 * n)
    const BARREN_RESTARTS = 3
    let sinceImprovement = 0
    let barrenRestarts = 0

    while (Date.now() < deadline && barrenRestarts < BARREN_RESTARTS) {
      if (signal?.aborted) throw abortError()

      if (sinceImprovement >= patience) {
        search.restart(rng)
        search.localSearch(deadline)
        sinceImprovement = 0
        barrenRestarts++
      } else {
        search.doubleBridge(rng)
        search.localSearch(deadline)
      }
      iterations++

      const objective = search.objective()
      if (objective < bestObjective - 1e-9) {
        bestObjective = objective
        best = search.snapshot()
        sinceImprovement = 0
        barrenRestarts = 0
      } else {
        sinceImprovement++
        // Wandering away from the best solution wastes the budget, so the walk
        // always resumes from it rather than from wherever it drifted to.
        search.restore(best)
      }

      report(false)

      const now = Date.now()
      if (now - lastYield >= YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
        if (signal?.aborted) throw abortError()
      }
    }

    report(true)
    return toResult(request, best)
  }
}

/** The default single-threaded engine. */
export const engineTs = new TsEngine()

/**
 * Solve without the engine wrapper — used by the worker, which has already done
 * its own budget and cancellation bookkeeping and only wants the arithmetic.
 */
export function solveSync(request: SolveRequest): { order: Int32Array; objective: number } {
  const search = new Search(request)
  const deadline = Date.now() + Math.max(0, request.budgetMs)
  search.construct(request.seedOrder)
  search.localSearch(deadline)
  return { order: search.snapshot(), objective: search.objective() }
}

/** Exported for the tests, which check the exact arc sums this engine reports. */
export function tourCost(request: SolveRequest, order: ArrayLike<number>): number {
  return arcSum(costMatrixFor(request.matrix, request.objective), request.matrix.n, order)
}
