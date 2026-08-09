import {
  abortError,
  arcSum,
  capacityFor,
  costMatrixFor,
  effectiveOptional,
  makeRng,
  resolveEndpoints,
  DEFAULT_DEPART_SEC,
  ORDER_FIRST,
  ORDER_LAST,
  TW_NEVER,
  resolvePins,
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

  /*
    ── The schedule, tier D's way ────────────────────────────────────────

    The Rust engine answers "how late would this move make the route" in
    O(log n), from Vidal labels held in a segment tree. This engine walks the
    whole route with a clock: O(n) per evaluation.

    That is a real and deliberate difference, and it is the ONLY kind of
    difference a tier is allowed to have. registry.ts states the rule in bold —
    tiers differ in SPEED, never in capability — because a feature gated on a
    capability becomes a bug report nobody can reproduce. So this engine honours
    windows and pins exactly as the fast one does, and is simply slower at it.

    Reached only where WebAssembly is unavailable, which in practice means a
    browser old enough that a slower search is the least of its problems.
  */
  readonly durations: Int32Array
  readonly serviceTimeSec: Int32Array
  readonly twOpenSec: Int32Array
  readonly twCloseSec: Int32Array
  readonly departAtSec: number
  /** True when some node has a closing time — see `Problem::windows_bind`. */
  readonly windowsBind: boolean
  /** 0 anywhere, 1 first, 2 last. */
  readonly pins: Uint8Array
  readonly firstCount: number
  readonly lastCount: number
  /** What a second of lateness costs, in arc units. The driver adapts it. */
  twPenalty = 0
  /** Where a candidate post-move order is materialised before being walked. */
  private trial: Int32Array

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

    const { serviceTimeSec, twOpenSec, twCloseSec } = request.constraints
    this.durations = matrix.durations
    this.serviceTimeSec = serviceTimeSec
    this.twOpenSec = twOpenSec
    this.twCloseSec = twCloseSec
    this.departAtSec = request.departAtSec ?? DEFAULT_DEPART_SEC
    this.windowsBind = twCloseSec.some((close) => close < TW_NEVER)
    this.pins = resolvePins(request)
    let first = 0
    let last = 0
    for (const pin of this.pins) {
      if (pin === ORDER_FIRST) first++
      else if (pin === ORDER_LAST) last++
    }
    this.firstCount = first
    this.lastCount = last
    this.trial = new Int32Array(this.n)
  }

  // ────────────────────────────────────────────────────────── schedule

  /**
   * Total lateness along a sequence, in seconds. O(n).
   *
   * Waiting for a window to open is free; arriving late is absorbed rather than
   * rejected, which is the whole point of the time-warp relaxation — the search
   * has to be able to walk through infeasible routes to reach good ones.
   */
  warpOf(order: ArrayLike<number>, length: number): number {
    const { durations, n, serviceTimeSec, twOpenSec, twCloseSec } = this
    let clock = this.departAtSec
    let warp = 0
    for (let i = 0; i < length; i++) {
      const node = order[i]
      if (i > 0) clock += durations[order[i - 1] * n + node]
      if (clock < twOpenSec[node]) clock = twOpenSec[node]
      if (clock > twCloseSec[node]) {
        warp += clock - twCloseSec[node]
        clock = twCloseSec[node]
      }
      clock += serviceTimeSec[node]
    }
    return warp
  }

  /** Lateness of the route as it stands, or 0 when nothing can be late. */
  timeWarp(): number {
    if (!this.windowsBind) return 0
    return this.warpOf(this.tour, this.length)
  }

  /** Lateness now, but only when it can affect a decision. */
  private warpNow(): number {
    return this.windowsBind && this.twPenalty !== 0 ? this.timeWarp() : 0
  }

  /** Price a move's effect on the schedule, in arc units. */
  private warpCost(after: () => number, before: number): number {
    if (!this.windowsBind || this.twPenalty === 0) return 0
    return this.twPenalty * (after() - before)
  }

  private warpAfterReverse(i: number, j: number): number {
    const { trial, tour, length } = this
    trial.set(tour.subarray(0, length))
    for (let a = i, b = j; a < b; a++, b--) {
      const swap = trial[a]
      trial[a] = trial[b]
      trial[b] = swap
    }
    return this.warpOf(trial, length)
  }

  private warpAfterOrOpt(p: number, seg: number, u: number, reversed: boolean): number {
    const { trial, tour, length } = this
    let at = 0
    const shortened = length - seg
    const segAt = (k: number) => tour[reversed ? p + seg - 1 - k : p + k]
    const restAt = (t: number) => (t < p ? tour[t] : tour[t + seg])
    for (let t = 0; t < u; t++) trial[at++] = restAt(t)
    for (let k = 0; k < seg; k++) trial[at++] = segAt(k)
    for (let t = u; t < shortened; t++) trial[at++] = restAt(t)
    return this.warpOf(trial, length)
  }

  private warpAfterInsert(node: number, u: number): number {
    const { trial, tour, length } = this
    trial.set(tour.subarray(0, u))
    trial[u] = node
    for (let t = u; t < length; t++) trial[t + 1] = tour[t]
    return this.warpOf(trial, length + 1)
  }

  private warpAfterRemove(p: number): number {
    const { trial, tour, length } = this
    trial.set(tour.subarray(0, p))
    for (let t = p + 1; t < length; t++) trial[t - 1] = tour[t]
    return this.warpOf(trial, length - 1)
  }

  // ─────────────────────────────────────────────────────────── the zones

  /**
   * The span of positions a move may rearrange, for the zone holding `p`.
   *
   * Mirrors `Tour::zone` in the Rust engine — see the `pin` field on `Problem`
   * for the three zones and why crossing between them is forbidden. Returns null
   * for a pinned depot or an empty zone.
   */
  zone(p: number): [number, number] | null {
    const lo = this.start === null ? 0 : 1
    const hi = this.end === null ? this.length - 1 : this.length - 2
    if (this.firstCount === 0 && this.lastCount === 0) {
      return p >= lo && p <= hi && lo <= hi ? [lo, hi] : null
    }
    const s = this.start === null ? 0 : 1
    const e = this.end === null ? 0 : 1
    const firstEnd = s + this.firstCount
    const autoEnd = Math.max(firstEnd, this.length - e - this.lastCount)
    let span: [number, number]
    if (p < s) return null
    else if (p < firstEnd) span = [s, firstEnd - 1]
    else if (p < autoEnd) span = [firstEnd, autoEnd - 1]
    else if (p < this.length - e) span = [autoEnd, this.length - e - 1]
    else return null
    return span[0] > span[1] ? null : span
  }

  /** Lowest gap an unpinned insertion may use — past the leading pinned run. */
  loGap(): number {
    const start = this.start === null ? 0 : 1
    if (this.firstCount === 0) return start
    let at = start
    while (at < this.length && this.pins[this.tour[at]] === ORDER_FIRST) at++
    return at
  }

  /** Highest gap an unpinned insertion may use, for a route of `length`. */
  hiGap(length: number): number {
    let at = this.end === null ? length : length - 1
    if (this.lastCount === 0) return at
    while (at > 0 && this.pins[this.tour[at - 1]] === ORDER_LAST) at--
    return at
  }

  /** Gaps an absent node may occupy, given its pin class. Inclusive. */
  private gapRange(node: number): [number, number] {
    const start = this.start === null ? 0 : 1
    const end = this.end === null ? this.length : this.length - 1
    if (this.pins[node] === ORDER_FIRST) return [start, this.loGap()]
    if (this.pins[node] === ORDER_LAST) return [this.hiGap(this.length), end]
    return [this.loGap(), this.hiGap(this.length)]
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

  /** True when some optional stop is being skipped — i.e. the cap binds. */
  hasAbsentCandidates(): boolean {
    for (let node = 0; node < this.n; node++) {
      if (this.optional[node] === 1 && this.pos[node] === -1) return true
    }
    return false
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
    // The zone, not the whole route: a move may reorder within the first block,
    // the unpinned middle, or the last block, never across a boundary. Same rule
    // as the Rust engine, and for the same reason — see `Tour::zone`.
    const span = this.zone(p)
    if (!span) return false
    const [lo, hi] = span
    const warpNow = this.warpNow()
    const { candidates, width } = this
    const base = a * width

    for (let s = 0; s < width; s++) {
      const c = candidates[base + s]
      const q = this.pos[c]
      if (q < 0) continue

      // `a` before `c`: reverse (p+1 .. q), creating the arc a -> c.
      if (q >= p + 1 && p + 1 >= lo && q <= hi) {
        const delta =
          this.reverseDelta(p + 1, q) +
          this.warpCost(() => this.warpAfterReverse(p + 1, q), warpNow)
        if (delta < -1e-9) {
          this.applyReverse(p + 1, q)
          this.wake(a)
          this.wake(c)
          return true
        }
      }

      // `c` before `a`: reverse (q+1 .. p), creating the arc c -> a.
      if (p >= q + 1 && q + 1 >= lo && p <= hi) {
        const delta =
          this.reverseDelta(q + 1, p) +
          this.warpCost(() => this.warpAfterReverse(q + 1, p), warpNow)
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
    const span = this.zone(p)
    if (!span) return false
    const [lo, hi] = span
    const warpNow = this.warpNow()
    const { candidates, width, length } = this

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
          // In the shortened tour the zone loses `len` positions, so its last
          // legal gap moves down by the same amount.
          if (u < lo || u > hi + 1 - len) continue
          if (u === p) continue // putting it back where it came from

          for (const reversed of [false, true]) {
            if (reversed && len === 1) continue
            const delta =
              this.orOptDelta(p, len, u, reversed) +
              this.warpCost(() => this.warpAfterOrOpt(p, len, u, reversed), warpNow)
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
  private bestInsertion(node: number): { at: number; cost: number; arcs: number } {
    const { cells, n, length, tour } = this
    const [loGap, hiGap] = this.gapRange(node)
    const warpNow = this.warpNow()

    let bestAt = loGap
    let bestCost = Infinity
    let bestArcs = Infinity
    for (let u = loGap; u <= hiGap; u++) {
      const left = u > 0 ? tour[u - 1] : -1
      const right = u < length ? tour[u] : -1
      const arcs =
        (left >= 0 ? cells[left * n + node] : 0) +
        (right >= 0 ? cells[node * n + right] : 0) -
        (left >= 0 && right >= 0 ? cells[left * n + right] : 0)
      // Two costs, for two different questions — see `Insertion` in the Rust
      // engine's tour.rs. `cost` decides WHERE the stop goes, `arcs` decides
      // whether it goes at all, and conflating them lets the search buy
      // punctuality by abandoning a delivery.
      const cost = arcs + this.warpCost(() => this.warpAfterInsert(node, u), warpNow)
      if (cost < bestCost) {
        bestCost = cost
        bestArcs = arcs
        bestAt = u
      }
    }
    return { at: bestAt, cost: bestCost, arcs: bestArcs }
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
      /*
        Arcs alone, with no warp relief — same rule as the Rust engine.

        Dropping a stop does relieve lateness, and pricing that in makes
        abandoning a delivery the cheapest move available on a day that cannot
        be done on time. Lateness decides where a stop goes, never whether.
      */
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
        const { at, arcs } = this.bestInsertion(node)
        if (arcs - this.skipPenalty < -1e-9) {
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
          const warpNow = this.warpNow()
          const gain =
            this.removalGain(p) -
            this.warpCost(() => this.warpAfterRemove(p), warpNow)
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
    // Confined to the unpinned middle. Reaching into the first or last block
    // would move a stop the driver explicitly placed there, and the local
    // search — which respects the zones — could not put it back.
    const aMin = Math.max(1, this.loGap())
    const cMax = this.hiGap(this.length)
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
   * Ruin and recreate: tear a chunk out of the route and rebuild it, seeded
   * with one stop chosen at random from those currently left out.
   *
   * ── Why a reordering perturbation is not enough ───────────────────────────
   *
   * When K binds, the hard question is not the order of the stops — it is WHICH
   * stops. A double bridge cannot answer it: it permutes what is already in the
   * route and never brings anything in from outside.
   *
   * Nor can the 1-for-1 swap in `selectionPass`. The benchmark's `decoy` family
   * is built from exactly that observation: a ring of cheap stops near the start
   * and the valuable payload in a dense cluster 18 km away. Trading ONE ring
   * stop for ONE cluster stop is steeply uphill — you pay the whole 18 km
   * detour to gain one delivery — so every single swap is rejected and the
   * route stays in the ring. You have to move a dozen stops at once, and no
   * sequence of individually-improving moves will take you there. Measured, on
   * the decoy family, that cost us up to 18% against OR-Tools.
   *
   * ── The escape ───────────────────────────────────────────────────────────
   *
   * Remove a contiguous run, then force ONE random absent stop in before
   * greedily refilling. The forced stop is the whole trick: a greedy refill on
   * its own just puts the cheap ring straight back, but once a single cluster
   * stop is in the route, its neighbours are cheap to add and the greedy fill
   * follows it across the map. Most attempts are wasted; that is fine, because
   * an attempt costs microseconds and the driver only needs one to land.
   */
  ruinAndRecreate(rng: () => number): void {
    const removable: number[] = []
    for (let p = this.lo; p <= this.hi && p < this.length; p++) {
      if (this.optional[this.tour[p]] === 1) removable.push(p)
    }
    if (removable.length === 0) return

    // A contiguous run, because the stops that should leave together are the
    // ones that are near each other, and adjacency in the route is the cheapest
    // available proxy for that.
    const span = Math.max(1, Math.round(removable.length * (0.15 + rng() * 0.35)))
    const from = Math.floor(rng() * Math.max(1, removable.length - span))
    for (let i = Math.min(from + span, removable.length) - 1; i >= from; i--) {
      this.removeAt(removable[i])
    }

    // The forced seed.
    const absent: number[] = []
    for (let node = 0; node < this.n; node++) {
      if (this.optional[node] === 1 && this.pos[node] === -1) absent.push(node)
    }
    if (absent.length > 0 && this.optionalVisited() < this.cap) {
      const seed = absent[Math.floor(rng() * absent.length)]
      this.insertAt(seed, this.bestInsertion(seed).at)
    }

    this.greedyRefill()
  }

  /** Fill to the cap, cheapest insertion first, from whatever is still out. */
  private greedyRefill(): void {
    for (;;) {
      if (this.optionalVisited() >= this.cap) return
      let bestNode = -1
      let bestAt = 0
      let bestCost = Infinity
      for (let node = 0; node < this.n; node++) {
        if (this.optional[node] !== 1 || this.pos[node] !== -1) continue
        const { at, cost } = this.bestInsertion(node)
        if (cost < bestCost) {
          bestCost = cost
          bestNode = node
          bestAt = at
        }
      }
      if (bestNode < 0) return
      this.insertAt(bestNode, bestAt)
    }
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

    /*
      Seed the lateness price from the instance's own scale, then construct
      again with it in hand — the same two-pass opening the Rust driver uses. A
      first route built with no regard for the clock can be so late that the
      descent spends its whole budget climbing out.
    */
    search.construct(request.seedOrder)
    if (search.windowsBind) {
      const arcs = Math.max(1, search.length - 1)
      search.twPenalty = Math.max(1, Math.round(search.cost() / arcs))
      search.construct(request.seedOrder)
    }
    search.localSearch(deadline)

    /*
      Two bests, for the same reason the Rust driver keeps two: "cheapest" and
      "on time" are different questions, and a cheaper late route must never be
      returned when an on-time one was found. Both judged unpenalised, so a
      route recorded early stays comparable with one recorded later.
    */
    const penalised = () => search.objective() + search.twPenalty * search.timeWarp()
    let bestFeasible: Int32Array | null = null
    let bestFeasibleObjective = Infinity
    let bestWarp = Infinity

    const record = (): boolean => {
      const objective = search.objective()
      const warp = search.timeWarp()
      let improved = false
      if (warp === 0 && objective < bestFeasibleObjective - 1e-9) {
        bestFeasibleObjective = objective
        bestFeasible = search.snapshot()
        improved = true
      }
      if (warp < bestWarp || (warp === bestWarp && objective < bestObjective - 1e-9)) {
        bestWarp = warp
        bestObjective = objective
        best = search.snapshot()
        improved = true
      }
      return improved
    }

    /** Push the price of lateness towards the feasibility boundary. */
    const adapt = (warp: number) => {
      if (!search.windowsBind) return
      search.twPenalty =
        warp > 0
          ? Math.min(1_000_000_000, Math.floor((search.twPenalty * 5) / 4) + 1)
          : Math.max(1, Math.floor((search.twPenalty * 4) / 5))
    }

    let best = search.snapshot()
    let bestObjective = search.objective()
    record()
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
    // How far uphill the walk may drift. Zero unless the K cap binds — see the
    // acceptance branch below for why.
    const drift = search.hasAbsentCandidates() ? 0.02 : 0
    let currentObjective = penalised()

    while (Date.now() < deadline && barrenRestarts < BARREN_RESTARTS) {
      if (signal?.aborted) throw abortError()

      if (sinceImprovement >= patience) {
        search.restart(rng)
        search.localSearch(deadline)
        sinceImprovement = 0
        barrenRestarts++
      } else {
        /*
          Two perturbations, and which one matters depends entirely on whether
          the K cap binds.

          Visit-all (the default since M9): every stop is in the route, ruin and
          recreate can only put back what it took out, and the double bridge is
          the whole game.

          K binding: the expensive question is WHICH stops, and the double
          bridge cannot answer it — it only ever permutes what is already there.
          So the two alternate, and ruin-and-recreate gets the larger share
          precisely when there is something outside the route to bring in.
        */
        const canReselect = search.hasAbsentCandidates()
        if (canReselect && rng() < 0.5) {
          search.ruinAndRecreate(rng)
        } else {
          search.doubleBridge(rng)
        }
        search.localSearch(deadline)
      }
      iterations++

      // The PENALISED objective, so a route that is cheap only because it is
      // late does not read as an improvement. `record` judges what to KEEP on
      // unpenalised terms.
      const objective = penalised()
      const warp = search.timeWarp()
      if (record()) {
        currentObjective = objective
        sinceImprovement = 0
        barrenRestarts = 0
      } else if (objective < currentObjective * (1 + drift)) {
        /*
          Accept a slightly worse route and keep walking from it.

          Strict descent cannot solve the selection problem, and the benchmark
          proved it: on the decoy family both TS engines returned IDENTICAL
          routes from different seeds, which is what "every seed falls into the
          same trap" looks like. Ruin-and-recreate seeds one far-cluster stop,
          that single stop costs a whole 18 km detour to gain one delivery, the
          route is instantly worse, and restoring the best throws it away before
          its neighbours — the entire point of going there — can be added.

          Reaching the cluster needs several consecutive moves that each look
          like a loss. So a small uphill drift is allowed, and `best` is kept
          separately so nothing found is ever lost.

          The drift is ZERO when every stop is being visited. With nothing left
          out there is no selection to revise, wandering buys nothing, and the
          instances that already win should not pay for a problem they do not
          have.
        */
        currentObjective = objective
        sinceImprovement++
      } else {
        sinceImprovement++
        search.restore(best)
        currentObjective = penalised()
      }

      adapt(warp)
      report(false)

      const now = Date.now()
      if (now - lastYield >= YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
        if (signal?.aborted) throw abortError()
      }
    }

    report(true)
    // On time if we ever found one, least-late otherwise.
    return toResult(request, bestFeasible ?? best)
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
