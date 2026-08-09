//! The route, and the O(1) move evaluations it supports.
//!
//! ── An array with a position index, not a linked list ─────────────────────
//!
//! A doubly-linked list is the textbook tour representation: O(1) splice, no
//! shifting. It is the wrong choice here, for two reasons that both come down to
//! the same thing — a linked list has no INDEX, so it has no PREFIXES.
//!
//! 1. Asymmetry. 2-opt reverses a segment, which flips every arc inside it. On a
//!    real driving matrix (98.3% of pairs disagree with their reverse) the
//!    textbook four-term delta is not merely imprecise, it is WRONG: it silently
//!    omits the cost of turning the segment round. The exact extra term is
//!
//!    ```text
//!    R(i,j) = Σ_{t=i..j-1} ( d[p[t+1]][p[t]] − d[p[t]][p[t+1]] )
//!    ```
//!
//!    which is O(len) to evaluate directly and would make a sweep O(n³). With
//!    running prefix sums of the forward and backward arc costs it is O(1) for
//!    any (i,j), exactly:
//!
//!    ```text
//!    F[t] = Σ_{s<t} d[p[s]][p[s+1]]     B[t] = Σ_{s<t} d[p[s+1]][p[s]]
//!    R(i,j) = (B[j] − B[i]) − (F[j] − F[i])
//!    ```
//!
//! 2. M11. Vidal's four labels — duration, time warp, earliest start, latest
//!    start — are concatenated over subsequences, which means prefix and suffix
//!    arrays over tour POSITIONS. `pre`/`suf` below are where they go. A linked
//!    list would make M11 a rewrite rather than an addition; see the module
//!    comment on `DurationSegment`.
//!
//! ── Integers, not floats ──────────────────────────────────────────────────
//!
//! The TypeScript engine keeps these prefix sums in a `Float64Array` because JS
//! has no cheap 64-bit integer, and so it compares deltas against `-1e-9` rather
//! than against zero. Here they are `i64` and every delta is exact, so an
//! improving move is simply `delta < 0`. At n = 1000 with the skip penalty at
//! 10⁷ the objective reaches ~10¹⁰, which overflows i32 and is comfortable in
//! i64.
//!
//! ── Open ends ─────────────────────────────────────────────────────────────
//!
//! Start and end may each be pinned or free. Rather than four code paths, a free
//! end is modelled as a virtual neighbour whose arcs all cost zero. `arc_in` and
//! `arc_out` are the only two places that know this.

use crate::problem::{Problem, TimeData};
use crate::segtree::RangeLabels;

/// Vidal's four-label subsequence summary — **declared for M11, unused in M10.**
///
/// It is here now, with its recurrence tested, for the reason the milestone
/// brief gives: the data structures have to be able to carry time windows
/// without a rewrite, and the cheapest way to be sure of that is to write the
/// type down and prove the maths while the source is in front of us.
///
/// Transcribed from PyVRP's `DurationSegment::merge` (MIT, © 2020 Thibaut
/// Vidal — the same author as the original framework, so this is the
/// formulation rather than a reinterpretation):
/// <https://github.com/PyVRP/PyVRP/blob/main/pyvrp/cpp/DurationSegment.h>
///
/// Upstream carries four further fields for multi-trip routes
/// (`releaseTime`, `cumDuration`, `cumTimeWarp`, `prevEndLate`). A single
/// vehicle making one trip needs none of them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DurationSegment {
    /// Total duration of the subsequence, waiting time included.
    pub duration: i64,
    /// Total time warp — how much lateness has been absorbed.
    pub time_warp: i64,
    /// Earliest the subsequence can start.
    pub start_early: i64,
    /// Latest it can start without incurring further warp.
    pub start_late: i64,
}

/// Stands in for "no upper bound" without being `i64::MAX`, so that the
/// additions in `merge` cannot overflow. Well clear of any real clock value:
/// a day is 86 400 seconds.
pub const NEVER: i64 = 1_000_000_000;

impl DurationSegment {
    /// The identity of `merge`: no time spent, no warp, startable whenever.
    ///
    /// A `const` as well as a function because `RangeLabels` fills its whole
    /// backing array with it, and `vec![expr; n]` wants a value rather than a
    /// call per element.
    pub const EMPTY: Self = DurationSegment {
        duration: 0,
        time_warp: 0,
        start_early: 0,
        start_late: NEVER,
    };

    pub fn empty() -> Self {
        Self::EMPTY
    }

    /// A departure pinned to one instant: the route leaves at `at`, not before
    /// and not after.
    ///
    /// Merged in front of a route's label, this is what turns "the best possible
    /// departure time" — which is what Vidal's recurrence computes on its own —
    /// into "the departure time the driver actually has". Without it a route
    /// whose first window opens at 10:00 would report zero waiting and zero
    /// warp by silently assuming a 10:00 start, and the arrival times shown to a
    /// driver who left at 08:00 would all be two hours optimistic.
    pub fn departure(at: i64) -> Self {
        DurationSegment {
            duration: 0,
            time_warp: 0,
            start_early: at,
            start_late: at,
        }
    }

    /// One node: service time, and its window.
    pub fn node(service: i64, tw_open: i64, tw_close: i64) -> Self {
        DurationSegment {
            duration: service,
            time_warp: 0,
            start_early: tw_open,
            start_late: tw_close,
        }
    }

    /// σ = first ⊕ second, travelling `edge` between them.
    ///
    /// The whole point of the framework: any move's effect on feasibility and
    /// duration is a constant number of these, so a neighbourhood sweep stays
    /// O(1) per move even with time windows.
    pub fn merge(edge: i64, first: &Self, second: &Self) -> Self {
        let at_second = first.duration - first.time_warp + edge;
        let delta_tw = (first.start_early + at_second - second.start_late).max(0);
        let delta_wait = (second.start_early - at_second - first.start_late).max(0);

        DurationSegment {
            duration: first.duration + second.duration + edge + delta_wait,
            time_warp: first.time_warp + second.time_warp + delta_tw,
            start_early: first.start_early.max(second.start_early - at_second) - delta_wait,
            start_late: first.start_late.min(second.start_late - at_second) + delta_tw,
        }
    }
}

/// Builds a whole route's label out of pieces, supplying the arc between them.
///
/// ── Why a builder rather than a chain of `merge` calls ────────────────────
///
/// Every move evaluation reassembles the route from two to five pieces, and the
/// arc joining two pieces depends on which node each of them ends and begins
/// with. Written inline that is four or five nearly-identical expressions per
/// move, each with its own chance of using the wrong node — and using the wrong
/// node produces a schedule that is plausible, slightly wrong, and never
/// detected. Here the rule is written once.
///
/// The departure time is seeded in `new`, so a caller cannot forget it.
pub struct Chain<'a> {
    time: &'a TimeData,
    label: DurationSegment,
    /// Last node pushed, or None while the chain is still only a departure.
    last: Option<usize>,
}

impl<'a> Chain<'a> {
    pub fn new(problem: &'a Problem) -> Self {
        let time = problem.time.as_ref().expect("Chain needs time data");
        Chain {
            time,
            label: time.depart,
            last: None,
        }
    }

    /// Append a piece spanning `first ..= last` in visiting order.
    #[inline]
    pub fn push(&mut self, piece: &DurationSegment, first: usize, last: usize) {
        let edge = match self.last {
            Some(previous) => self.time.travel(previous, first),
            None => 0,
        };
        self.label = DurationSegment::merge(edge, &self.label, piece);
        self.last = Some(last);
    }

    /// Append a single node.
    #[inline]
    pub fn push_node(&mut self, node: usize) {
        let leaf = self.time.leaf(node);
        self.push(&leaf, node, node);
    }

    #[inline]
    pub fn time_warp(&self) -> i64 {
        self.label.time_warp
    }

    #[inline]
    pub fn label(&self) -> &DurationSegment {
        &self.label
    }
}

/// Where an absent node would go, and what putting it there is worth.
///
/// ── Two costs, because they answer different questions ────────────────────
///
/// `cost` includes the price of any lateness the insertion causes and decides
/// WHERE the node goes. `arcs` is travel alone and decides WHETHER it goes at
/// all — and that separation is load-bearing.
///
/// Judging "whether" on the penalised cost lets the search buy punctuality by
/// abandoning a delivery: the time-window penalty is adaptive and climbs
/// whenever the route is late, so on a day that cannot be done on time it
/// eventually exceeds the skip penalty, and dropping a stop becomes the cheapest
/// move available. Measured, not imagined — it emptied 21 of 25 TSPTW instances
/// down to a handful of nodes before this split existed.
///
/// So the rule is: **lateness decides where a stop goes, never whether it goes.**
/// A driver who cannot make every window wants to be told that, not to find a
/// parcel still in the van.
#[derive(Clone, Copy, Debug)]
pub struct Insertion {
    pub at: usize,
    /// Arc cost plus the priced lateness. For choosing a position.
    pub cost: i64,
    /// Arc cost alone. For deciding whether the stop is worth visiting.
    pub arcs: i64,
}

pub struct Tour {
    /// Matrix indices in visiting order. Only `len` entries are live.
    pub order: Vec<i32>,
    pub len: usize,
    /// Position of each node, or -1 when it is not in the route.
    pub pos: Vec<i32>,

    /// Forward and backward prefix sums. See the module header.
    fwd: Vec<i64>,
    bwd: Vec<i64>,

    /// Scratch for segment moves, so nothing allocates during the search.
    scratch: Vec<i32>,

    /*
      ── The schedule ──────────────────────────────────────────────────────

      `pre[t]` is the label of `order[0..=t]`, `suf[t]` of `order[t..=len-1]`.
      Both are O(1) lookups and both are used in every single move evaluation,
      which is why they are arrays rather than two more segment-tree queries.

      `ranges` answers the interior ones — the reversed stretch a 2-opt turns
      round, and the forward stretch an Or-opt slides past — in O(log n). See
      segtree.rs for why no arrangement of prefix arrays can do that.

      All three are built ONLY when `problem.windows_bind()`. When they are not,
      `labelled` is false and every accessor below refuses to answer, so a
      caller that forgets to check gets a panic in tests rather than a
      confidently wrong schedule in production.
    */
    pre: Vec<DurationSegment>,
    suf: Vec<DurationSegment>,
    ranges: RangeLabels,
    labelled: bool,
}

impl Tour {
    pub fn new(n: usize) -> Self {
        Tour {
            order: vec![0; n],
            len: 0,
            pos: vec![-1; n],
            fwd: vec![0; n + 1],
            bwd: vec![0; n + 1],
            scratch: vec![0; n],
            // Allocated lazily by `refresh`: a problem with no windows never
            // pays for 2n labels plus a 4n tree, which at n = 1000 is a
            // quarter of a megabyte of pure overhead.
            pre: Vec::new(),
            suf: Vec::new(),
            ranges: RangeLabels::new(0),
            labelled: false,
        }
    }

    // ─────────────────────────────────────────────────────── bookkeeping

    /// Recompute the prefix sums and the position index.
    ///
    /// O(n), and only ever after a move is ACCEPTED. Evaluation stays O(1),
    /// which is what lets candidate lists and don't-look bits do their job.
    pub fn refresh(&mut self, problem: &Problem) {
        self.fwd[0] = 0;
        self.bwd[0] = 0;
        for t in 1..self.len {
            let prev = self.order[t - 1] as usize;
            let cur = self.order[t] as usize;
            self.fwd[t] = self.fwd[t - 1] + i64::from(problem.matrix.at(prev, cur));
            self.bwd[t] = self.bwd[t - 1] + i64::from(problem.matrix.at(cur, prev));
        }
        for node in self.pos.iter_mut() {
            *node = -1;
        }
        for t in 0..self.len {
            self.pos[self.order[t] as usize] = t as i32;
        }
        if problem.windows_bind() {
            self.refresh_labels(problem);
        }
    }

    // ────────────────────────────────────────────────────────── schedule

    /// Rebuild the prefix, suffix and interior labels. O(n), on accept only.
    fn refresh_labels(&mut self, problem: &Problem) {
        let time = problem.time.as_ref().expect("windows_bind implies time data");
        let len = self.len;

        if self.pre.len() < len {
            self.pre.resize(len, DurationSegment::EMPTY);
            self.suf.resize(len, DurationSegment::EMPTY);
        }
        self.labelled = true;
        if len == 0 {
            return;
        }

        self.pre[0] = time.leaf(self.order[0] as usize);
        for t in 1..len {
            let from = self.order[t - 1] as usize;
            let to = self.order[t] as usize;
            self.pre[t] = DurationSegment::merge(time.travel(from, to), &self.pre[t - 1], &time.leaf(to));
        }

        self.suf[len - 1] = time.leaf(self.order[len - 1] as usize);
        for t in (0..len - 1).rev() {
            let from = self.order[t] as usize;
            let to = self.order[t + 1] as usize;
            self.suf[t] = DurationSegment::merge(time.travel(from, to), &time.leaf(from), &self.suf[t + 1]);
        }

        let order = &self.order;
        self.ranges.build(
            len,
            |position| time.leaf(order[position] as usize),
            |from, to| time.travel(order[from] as usize, order[to] as usize),
        );
    }

    /// Everything strictly before position `t`, departure time included.
    ///
    /// The departure is folded in here rather than left to each caller, because
    /// forgetting it is invisible: the recurrence would silently answer for the
    /// BEST possible departure time instead of the one the driver has, and every
    /// route whose first window opens late would report no waiting and no
    /// lateness at all.
    #[inline]
    pub fn head(&self, problem: &Problem, t: usize) -> DurationSegment {
        let time = problem.time.as_ref().expect("head() needs time data");
        debug_assert!(self.labelled, "labels were never built");
        if t == 0 {
            time.depart
        } else {
            DurationSegment::merge(0, &time.depart, &self.pre[t - 1])
        }
    }

    /// Everything from position `t` to the end, or `None` when `t` is past it.
    #[inline]
    pub fn tail(&self, t: usize) -> Option<&DurationSegment> {
        debug_assert!(self.labelled, "labels were never built");
        if t < self.len {
            Some(&self.suf[t])
        } else {
            None
        }
    }

    /// Label of `order[i..=j]`, travelled in either direction. O(log n).
    #[inline]
    pub fn segment_label(
        &self,
        problem: &Problem,
        i: usize,
        j: usize,
        reversed: bool,
    ) -> DurationSegment {
        let time = problem.time.as_ref().expect("segment_label() needs time data");
        let order = &self.order;
        let edge = |from: usize, to: usize| time.travel(order[from] as usize, order[to] as usize);
        if reversed {
            self.ranges.reversed(i, j, edge)
        } else {
            self.ranges.forward(i, j, edge)
        }
    }

    /// Append one node's label to a running one, travelling `edge` to reach it.
    #[inline]
    pub fn extend(problem: &Problem, running: &DurationSegment, edge: i64, node: usize) -> DurationSegment {
        let time = problem.time.as_ref().expect("extend() needs time data");
        DurationSegment::merge(edge, running, &time.leaf(node))
    }

    /// Total lateness along the route as it stands, in seconds.
    ///
    /// Zero means every window is met. This is the number the adaptive penalty
    /// is applied to and the one reported to the user, so it is deliberately the
    /// whole route's warp rather than a per-node count: two stops five minutes
    /// late is a better route than one stop an hour late, and a count cannot say
    /// so.
    pub fn time_warp(&self, problem: &Problem) -> i64 {
        if !problem.windows_bind() || self.len == 0 {
            return 0;
        }
        debug_assert!(self.labelled, "labels were never built");
        let time = problem.time.as_ref().expect("windows_bind implies time data");
        DurationSegment::merge(0, &time.depart, &self.pre[self.len - 1]).time_warp
    }

    /// Total lateness the route WOULD have if `order[i..=j]` were reversed.
    ///
    /// Three pieces: everything before `i`, the reversed stretch, everything
    /// after `j`. The reversed stretch is the O(log n) query; the other two are
    /// array lookups.
    pub fn warp_after_reverse(&self, problem: &Problem, i: usize, j: usize) -> i64 {
        debug_assert!(i <= j && j < self.len);
        let mut chain = Chain::new(problem);
        if i > 0 {
            chain.push(&self.pre[i - 1], self.order[0] as usize, self.order[i - 1] as usize);
        }
        chain.push(
            &self.segment_label(problem, i, j, true),
            self.order[j] as usize,
            self.order[i] as usize,
        );
        if let Some(tail) = self.tail(j + 1) {
            chain.push(tail, self.order[j + 1] as usize, self.order[self.len - 1] as usize);
        }
        chain.time_warp()
    }

    /// Total lateness the route WOULD have after an Or-opt move.
    ///
    /// `order[p .. p+seg]` is lifted out and dropped into gap `u` of the
    /// SHORTENED tour, optionally turned round — the same coordinates
    /// `or_opt_delta` works in, and for the same reason: computing against the
    /// original positions is the classic Or-opt bug, and it is no less wrong for
    /// a schedule than it is for a cost.
    ///
    /// The stretch between the hole and the gap is the interior FORWARD range,
    /// which is the other half of why `RangeLabels` carries both directions.
    pub fn warp_after_or_opt(
        &self,
        problem: &Problem,
        p: usize,
        seg: usize,
        u: usize,
        reversed: bool,
    ) -> i64 {
        debug_assert!(p + seg <= self.len);
        let shortened = self.len - seg;
        let mut chain = Chain::new(problem);

        // Everything the shortened tour holds before gap `u`.
        if u <= p {
            if u > 0 {
                chain.push(&self.pre[u - 1], self.order[0] as usize, self.order[u - 1] as usize);
            }
        } else {
            if p > 0 {
                chain.push(&self.pre[p - 1], self.order[0] as usize, self.order[p - 1] as usize);
            }
            // Shortened positions p..u map to original positions p+seg..u+seg-1.
            let from = p + seg;
            let to = u + seg - 1;
            chain.push(
                &self.segment_label(problem, from, to, false),
                self.order[from] as usize,
                self.order[to] as usize,
            );
        }

        // The segment itself, in whichever orientation.
        let (first, last) = if reversed {
            (self.order[p + seg - 1] as usize, self.order[p] as usize)
        } else {
            (self.order[p] as usize, self.order[p + seg - 1] as usize)
        };
        chain.push(&self.segment_label(problem, p, p + seg - 1, reversed), first, last);

        // And everything after the gap.
        if u < shortened {
            if u <= p {
                // Original positions u..p-1, then everything from p+seg on.
                if u < p {
                    chain.push(
                        &self.segment_label(problem, u, p - 1, false),
                        self.order[u] as usize,
                        self.order[p - 1] as usize,
                    );
                }
                if let Some(tail) = self.tail(p + seg) {
                    chain.push(
                        tail,
                        self.order[p + seg] as usize,
                        self.order[self.len - 1] as usize,
                    );
                }
            } else if let Some(tail) = self.tail(u + seg) {
                chain.push(tail, self.order[u + seg] as usize, self.order[self.len - 1] as usize);
            }
        }

        chain.time_warp()
    }

    /// Total arc cost of the route as it stands.
    #[inline]
    pub fn cost(&self) -> i64 {
        if self.len == 0 {
            0
        } else {
            self.fwd[self.len - 1]
        }
    }

    /// Arcs plus a penalty for every optional node left out — the referee's
    /// formula, and the only number the driver ever compares.
    pub fn objective(&self, problem: &Problem) -> i64 {
        let mut skipped = 0i64;
        for node in 0..problem.n() {
            if problem.is_optional(node) && self.pos[node] < 0 {
                skipped += 1;
            }
        }
        self.cost() + problem.skip_penalty * skipped
    }

    /// True when some optional node is currently left out — i.e. the cap binds.
    pub fn has_absent_candidates(&self, problem: &Problem) -> bool {
        (0..problem.n()).any(|node| problem.is_optional(node) && self.pos[node] < 0)
    }

    /// How many optional nodes the route visits.
    pub fn optional_visited(&self, problem: &Problem) -> usize {
        self.order[..self.len]
            .iter()
            .filter(|&&node| problem.is_optional(node as usize))
            .count()
    }

    pub fn snapshot(&self) -> Vec<i32> {
        self.order[..self.len].to_vec()
    }

    pub fn restore(&mut self, problem: &Problem, order: &[i32]) {
        self.order[..order.len()].copy_from_slice(order);
        self.len = order.len();
        self.refresh(problem);
    }

    // ───────────────────────────────────────────────────────── geometry

    /// Cost of the arc entering position `i`, whose occupant is `node`.
    /// A free start has no predecessor, so it costs nothing.
    #[inline(always)]
    fn arc_in(&self, problem: &Problem, i: usize, node: usize) -> i64 {
        if i == 0 {
            0
        } else {
            i64::from(problem.matrix.at(self.order[i - 1] as usize, node))
        }
    }

    /// Cost of the arc leaving position `j`, whose occupant is `node`.
    /// A free end has no successor, so it costs nothing.
    #[inline(always)]
    fn arc_out(&self, problem: &Problem, j: usize, node: usize) -> i64 {
        if j + 1 >= self.len {
            0
        } else {
            i64::from(problem.matrix.at(node, self.order[j + 1] as usize))
        }
    }

    /// Lowest position an interior move may touch: 1 when the start is pinned.
    #[inline]
    pub fn lo(&self, problem: &Problem) -> usize {
        if problem.start.is_none() {
            0
        } else {
            1
        }
    }

    /// Highest position an interior move may touch.
    #[inline]
    pub fn hi(&self, problem: &Problem) -> usize {
        if problem.end.is_none() {
            self.len.saturating_sub(1)
        } else {
            self.len.saturating_sub(2)
        }
    }

    /// Lowest gap index an insertion may use.
    #[inline]
    pub fn lo_gap(&self, problem: &Problem) -> usize {
        if problem.start.is_none() {
            0
        } else {
            1
        }
    }

    /// Highest gap index an insertion may use, for a route of length `len`.
    #[inline]
    pub fn hi_gap(&self, problem: &Problem, len: usize) -> usize {
        if problem.end.is_none() {
            len
        } else {
            len.saturating_sub(1)
        }
    }

    // ─────────────────────────────────────────────────────────── 2-opt

    /// Exact delta of reversing `order[i..=j]`, asymmetry included.
    ///
    /// The `reversal` term is the entire reason this struct keeps prefix sums.
    /// Without it the engine accepts losing moves and cannot tell.
    #[inline]
    pub fn reverse_delta(&self, problem: &Problem, i: usize, j: usize) -> i64 {
        let a = self.order[i] as usize;
        let b = self.order[j] as usize;
        let removed = self.arc_in(problem, i, a) + self.arc_out(problem, j, b);
        let added = self.arc_in(problem, i, b) + self.arc_out(problem, j, a);
        let reversal = (self.bwd[j] - self.bwd[i]) - (self.fwd[j] - self.fwd[i]);
        added - removed + reversal
    }

    pub fn apply_reverse(&mut self, problem: &Problem, i: usize, j: usize) {
        self.order[i..=j].reverse();
        self.refresh(problem);
    }

    // ────────────────────────────────────────────────────────── Or-opt

    /// Delta of lifting `order[p .. p+seg]` out and dropping it into gap `u` of
    /// the SHORTENED tour, optionally turned round.
    ///
    /// Working in shortened-tour coordinates is what keeps this honest.
    /// Computing the insertion against the original positions is the classic
    /// Or-opt bug: every index after the removed segment has shifted by `seg`,
    /// and a delta that ignores that is wrong only sometimes.
    pub fn or_opt_delta(
        &self,
        problem: &Problem,
        p: usize,
        seg: usize,
        u: usize,
        reversed: bool,
    ) -> i64 {
        let m = &problem.matrix;
        let first = self.order[p] as usize;
        let last = self.order[p + seg - 1] as usize;

        let prev = if p > 0 {
            Some(self.order[p - 1] as usize)
        } else {
            None
        };
        let next = if p + seg < self.len {
            Some(self.order[p + seg] as usize)
        } else {
            None
        };

        // Closing the hole the segment leaves behind.
        let mut removal = 0i64;
        if let Some(prev) = prev {
            removal -= i64::from(m.at(prev, first));
        }
        if let Some(next) = next {
            removal -= i64::from(m.at(last, next));
        }
        if let (Some(prev), Some(next)) = (prev, next) {
            removal += i64::from(m.at(prev, next));
        }

        // Gap `u` in the shortened tour lies between these two nodes.
        let shortened = self.len - seg;
        let at = |t: usize| -> usize {
            if t < p {
                self.order[t] as usize
            } else {
                self.order[t + seg] as usize
            }
        };
        let left = if u > 0 { Some(at(u - 1)) } else { None };
        let right = if u < shortened { Some(at(u)) } else { None };

        let (head, tail) = if reversed { (last, first) } else { (first, last) };

        let mut insertion = 0i64;
        if let Some(left) = left {
            insertion += i64::from(m.at(left, head));
        }
        if let Some(right) = right {
            insertion += i64::from(m.at(tail, right));
        }
        if let (Some(left), Some(right)) = (left, right) {
            insertion -= i64::from(m.at(left, right));
        }

        // Turning the segment round flips its internal arcs. At most two terms,
        // because the segment is at most three nodes long.
        let mut internal = 0i64;
        if reversed && seg > 1 {
            for t in 0..seg - 1 {
                let x = self.order[p + t] as usize;
                let y = self.order[p + t + 1] as usize;
                internal += i64::from(m.at(y, x)) - i64::from(m.at(x, y));
            }
        }

        removal + insertion + internal
    }

    pub fn apply_or_opt(
        &mut self,
        problem: &Problem,
        p: usize,
        seg: usize,
        u: usize,
        reversed: bool,
    ) {
        for t in 0..seg {
            self.scratch[t] = self.order[p + t];
        }
        if reversed {
            self.scratch[..seg].reverse();
        }

        // Close the hole, then open a new one at `u`. Two shifts, no allocation.
        self.order.copy_within(p + seg..self.len, p);
        let shortened = self.len - seg;
        self.order.copy_within(u..shortened, u + seg);
        self.order[u..u + seg].copy_from_slice(&self.scratch[..seg]);
        self.refresh(problem);
    }

    // ─────────────────────────────────────────────── add / drop / swap

    /// Total lateness the route WOULD have with `node` inserted at gap `u`.
    ///
    /// O(1), and it stays O(1) because an insertion reorders nothing: the route
    /// either side of the gap is exactly the prefix and suffix already tabulated.
    pub fn warp_after_insert(&self, problem: &Problem, node: usize, u: usize) -> i64 {
        debug_assert!(u <= self.len);
        let mut chain = Chain::new(problem);
        if u > 0 {
            chain.push(&self.pre[u - 1], self.order[0] as usize, self.order[u - 1] as usize);
        }
        chain.push_node(node);
        if let Some(tail) = self.tail(u) {
            chain.push(tail, self.order[u] as usize, self.order[self.len - 1] as usize);
        }
        chain.time_warp()
    }

    /// Total lateness the route WOULD have with position `p` removed. O(1).
    pub fn warp_after_remove(&self, problem: &Problem, p: usize) -> i64 {
        debug_assert!(p < self.len);
        let mut chain = Chain::new(problem);
        if p > 0 {
            chain.push(&self.pre[p - 1], self.order[0] as usize, self.order[p - 1] as usize);
        }
        if let Some(tail) = self.tail(p + 1) {
            chain.push(tail, self.order[p + 1] as usize, self.order[self.len - 1] as usize);
        }
        chain.time_warp()
    }

    /// Cheapest gap for an absent node.
    ///
    /// `tw_penalty` prices a second of lateness in the same units as an arc. At
    /// zero — or with no windows to miss — this is exactly the arc-only search
    /// M10 shipped, which is what keeps a driver who set no windows paying
    /// nothing for the machinery.
    ///
    /// Picking the cheapest gap by ARCS alone and hoping the schedule survives is
    /// the obvious version and it is wrong in a specific way: on a tight route
    /// the cheapest gap is very often the one that makes everything downstream
    /// late, so the insertion looks free and costs the whole afternoon.
    ///
    /// Both costs come back because they answer different questions. See
    /// `Insertion`.
    pub fn best_insertion(&self, problem: &Problem, node: usize, tw_penalty: i64) -> Insertion {
        let m = &problem.matrix;
        let lo = self.lo_gap(problem);
        let hi = self.hi_gap(problem, self.len);
        let warp_now = self.time_warp(problem);
        let timed = problem.windows_bind() && tw_penalty != 0;

        let mut best = Insertion {
            at: lo,
            cost: i64::MAX,
            arcs: i64::MAX,
        };
        for u in lo..=hi {
            let left = if u > 0 {
                Some(self.order[u - 1] as usize)
            } else {
                None
            };
            let right = if u < self.len {
                Some(self.order[u] as usize)
            } else {
                None
            };
            let mut cost = 0i64;
            if let Some(left) = left {
                cost += i64::from(m.at(left, node));
            }
            if let Some(right) = right {
                cost += i64::from(m.at(node, right));
            }
            if let (Some(left), Some(right)) = (left, right) {
                cost -= i64::from(m.at(left, right));
            }
            let arcs = cost;
            if timed {
                cost += tw_penalty * (self.warp_after_insert(problem, node, u) - warp_now);
            }
            if cost < best.cost {
                best = Insertion { at: u, cost, arcs };
            }
        }
        best
    }

    /// What removing the node at position `p` saves in arcs.
    pub fn removal_gain(&self, problem: &Problem, p: usize) -> i64 {
        let m = &problem.matrix;
        let node = self.order[p] as usize;
        let prev = if p > 0 {
            Some(self.order[p - 1] as usize)
        } else {
            None
        };
        let next = if p + 1 < self.len {
            Some(self.order[p + 1] as usize)
        } else {
            None
        };
        let mut gain = 0i64;
        if let Some(prev) = prev {
            gain += i64::from(m.at(prev, node));
        }
        if let Some(next) = next {
            gain += i64::from(m.at(node, next));
        }
        if let (Some(prev), Some(next)) = (prev, next) {
            gain -= i64::from(m.at(prev, next));
        }
        gain
    }

    pub fn insert_at(&mut self, problem: &Problem, node: usize, u: usize) {
        self.order.copy_within(u..self.len, u + 1);
        self.order[u] = node as i32;
        self.len += 1;
        self.refresh(problem);
    }

    pub fn remove_at(&mut self, problem: &Problem, p: usize) {
        let node = self.order[p] as usize;
        self.order.copy_within(p + 1..self.len, p);
        self.len -= 1;
        self.pos[node] = -1;
        self.refresh(problem);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matrix::Matrix;
    use crate::rng::Rng;

    fn asymmetric_problem(n: usize, seed: u32, start: Option<usize>, end: Option<usize>) -> Problem {
        let mut rng = Rng::new(seed);
        let mut cells = vec![0i32; n * n];
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    cells[i * n + j] = 1 + (rng.next_f64() * 10_000.0) as i32;
                }
            }
        }
        let mut optional = vec![1u8; n];
        if let Some(s) = start {
            optional[s] = 0;
        }
        if let Some(e) = end {
            optional[e] = 0;
        }
        Problem::new(Matrix::new(n, cells), optional, None, 10_000_000, start, end)
    }

    fn seeded_tour(problem: &Problem, n: usize) -> Tour {
        let mut tour = Tour::new(n);
        for i in 0..n {
            tour.order[i] = i as i32;
        }
        tour.len = n;
        tour.refresh(problem);
        tour
    }

    /// A full recompute of the arc sum, used to check every delta.
    fn recompute(problem: &Problem, order: &[i32]) -> i64 {
        let mut sum = 0i64;
        for w in order.windows(2) {
            sum += i64::from(problem.matrix.at(w[0] as usize, w[1] as usize));
        }
        sum
    }

    #[test]
    fn prefix_sums_agree_with_a_full_recompute() {
        let n = 12;
        let problem = asymmetric_problem(n, 3, None, None);
        let tour = seeded_tour(&problem, n);
        assert_eq!(tour.cost(), recompute(&problem, &tour.snapshot()));
    }

    /// **The test that matters.** Every legal (i,j), not a sample: the reversal
    /// delta must equal the change a full recompute reports. The asymmetric
    /// reversal term is exactly the thing a textbook implementation gets wrong,
    /// and it is wrong only for some (i,j), so sampling would miss it.
    #[test]
    fn reverse_delta_is_exact_for_every_legal_move() {
        for seed in 1..8u32 {
            for &(start, end) in &[
                (None, None),
                (Some(0), None),
                (None, Some(11)),
                (Some(0), Some(11)),
            ] {
                let n = 12;
                let problem = asymmetric_problem(n, seed, start, end);
                let tour = seeded_tour(&problem, n);
                let before = tour.cost();
                let lo = tour.lo(&problem);
                let hi = tour.hi(&problem);

                for i in lo..=hi {
                    for j in (i + 1)..=hi {
                        let predicted = tour.reverse_delta(&problem, i, j);

                        let mut after_order = tour.snapshot();
                        after_order[i..=j].reverse();
                        let actual = recompute(&problem, &after_order) - before;

                        assert_eq!(
                            predicted, actual,
                            "seed {seed}, pins {start:?}/{end:?}, reverse({i},{j})"
                        );
                    }
                }
            }
        }
    }

    /// Same standard for Or-opt: every segment start, every length, every gap,
    /// both orientations.
    #[test]
    fn or_opt_delta_is_exact_for_every_legal_move() {
        for seed in 1..6u32 {
            for &(start, end) in &[(None, None), (Some(0), Some(9))] {
                let n = 10;
                let problem = asymmetric_problem(n, seed, start, end);
                let tour = seeded_tour(&problem, n);
                let before = tour.cost();
                let lo = tour.lo(&problem);
                let hi = tour.hi(&problem);

                for seg in 1..=3usize {
                    for p in lo..=hi {
                        if p + seg - 1 > hi {
                            continue;
                        }
                        let shortened = n - seg;
                        for u in tour.lo_gap(&problem)..=tour.hi_gap(&problem, shortened) {
                            if u == p {
                                continue;
                            }
                            for &reversed in &[false, true] {
                                if reversed && seg == 1 {
                                    continue;
                                }
                                let predicted =
                                    tour.or_opt_delta(&problem, p, seg, u, reversed);

                                // Apply by hand, the slow obvious way.
                                let original = tour.snapshot();
                                let mut segment: Vec<i32> =
                                    original[p..p + seg].to_vec();
                                if reversed {
                                    segment.reverse();
                                }
                                let mut rest: Vec<i32> = original.clone();
                                rest.drain(p..p + seg);
                                let mut after_order = rest;
                                for (k, &node) in segment.iter().enumerate() {
                                    after_order.insert(u + k, node);
                                }
                                let actual = recompute(&problem, &after_order) - before;

                                assert_eq!(
                                    predicted, actual,
                                    "seed {seed}, pins {start:?}/{end:?}, \
                                     or_opt(p={p}, seg={seg}, u={u}, rev={reversed})"
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn apply_reverse_matches_its_delta() {
        let n = 11;
        let problem = asymmetric_problem(n, 17, Some(0), Some(10));
        let mut tour = seeded_tour(&problem, n);
        for i in 1..=9 {
            for j in (i + 1)..=9 {
                let before = tour.cost();
                let predicted = tour.reverse_delta(&problem, i, j);
                tour.apply_reverse(&problem, i, j);
                assert_eq!(tour.cost() - before, predicted, "reverse({i},{j})");
                // Put it back.
                tour.apply_reverse(&problem, i, j);
                assert_eq!(tour.cost(), before);
            }
        }
    }

    #[test]
    fn apply_or_opt_matches_its_delta() {
        let n = 10;
        let problem = asymmetric_problem(n, 21, None, None);
        for seg in 1..=3usize {
            for p in 0..(n - seg) {
                for u in 0..=(n - seg) {
                    if u == p {
                        continue;
                    }
                    for &reversed in &[false, true] {
                        if reversed && seg == 1 {
                            continue;
                        }
                        let mut tour = seeded_tour(&problem, n);
                        let before = tour.cost();
                        let predicted = tour.or_opt_delta(&problem, p, seg, u, reversed);
                        tour.apply_or_opt(&problem, p, seg, u, reversed);
                        assert_eq!(
                            tour.cost() - before,
                            predicted,
                            "or_opt(p={p}, seg={seg}, u={u}, rev={reversed})"
                        );
                        // And the tour is still a permutation.
                        let mut seen = tour.snapshot();
                        seen.sort();
                        assert_eq!(seen, (0..n as i32).collect::<Vec<_>>());
                    }
                }
            }
        }
    }

    #[test]
    fn insertion_and_removal_are_inverses() {
        let n = 9;
        let problem = asymmetric_problem(n, 33, None, None);
        let mut tour = seeded_tour(&problem, n);
        let original = tour.snapshot();
        let original_cost = tour.cost();

        for p in 0..n {
            let node = tour.order[p] as usize;
            let gain = tour.removal_gain(&problem, p);
            tour.remove_at(&problem, p);
            assert_eq!(tour.cost(), original_cost - gain, "removing position {p}");
            assert_eq!(tour.pos[node], -1);

            tour.insert_at(&problem, node, p);
            assert_eq!(tour.snapshot(), original);
            assert_eq!(tour.cost(), original_cost);
        }
    }

    #[test]
    fn best_insertion_finds_the_cheapest_gap() {
        let n = 8;
        let problem = asymmetric_problem(n, 41, None, None);
        let mut tour = seeded_tour(&problem, n);
        let node = tour.order[3] as usize;
        tour.remove_at(&problem, 3);
        let shortened_cost = tour.cost();

        let placed = tour.best_insertion(&problem, node, 0);

        // Check it against every gap, the slow way.
        let mut best = i64::MAX;
        for u in 0..=tour.len {
            let mut candidate = tour.snapshot();
            candidate.insert(u, node as i32);
            best = best.min(recompute(&problem, &candidate) - shortened_cost);
        }
        assert_eq!(placed.cost, best);
        assert_eq!(placed.arcs, best, "with no windows the two costs coincide");

        tour.insert_at(&problem, node, placed.at);
        assert_eq!(tour.cost(), shortened_cost + placed.cost);
    }

    // ───────────────────────────────────── Vidal labels (M11 groundwork)

    /// Walk a route with a clock, from a given departure time.
    ///
    /// Returns (elapsed, time warp). Waiting for a window to open extends the
    /// elapsed time; arriving after one closes is absorbed as warp rather than
    /// treated as a failure, which is the whole point of the formulation — an
    /// infeasible route is scored, not rejected, so the search can walk through
    /// infeasibility to reach something better.
    fn simulate(nodes: &[(i64, i64, i64)], edges: &[i64], start: i64) -> (i64, i64) {
        let mut clock = start;
        let mut warp = 0i64;
        if clock > nodes[0].2 {
            warp += clock - nodes[0].2;
            clock = nodes[0].2;
        }
        clock += nodes[0].0;
        for k in 1..nodes.len() {
            clock += edges[k - 1];
            if clock < nodes[k].1 {
                clock = nodes[k].1;
            }
            if clock > nodes[k].2 {
                warp += clock - nodes[k].2;
                clock = nodes[k].2;
            }
            clock += nodes[k].0;
        }
        (clock - start, warp)
    }

    /// The recurrence, checked against a direct simulation of the schedule.
    ///
    /// ── The subtlety this test exists to pin down ─────────────────────────
    ///
    /// `duration` is NOT "elapsed time if you leave as early as possible". It is
    /// the elapsed time under the BEST departure time, because waiting at a
    /// closed door is avoidable by leaving later, and a route should not be
    /// charged for it. `start_early` is that best departure.
    ///
    /// The first version of this test simulated from the earliest departure and
    /// reported 333 against the recurrence's 245 — an 88-second "discrepancy"
    /// that was entirely the test's misreading. Leaving 88 seconds later removes
    /// every wait, and 245 is correct. Getting this wrong in M11 would mean
    /// systematically over-charging routes that start with a slack window.
    #[test]
    fn duration_segment_merge_matches_a_simulated_schedule() {
        // (service, open, close) per node, and the travel time between them.
        let nodes = [
            (10i64, 0i64, NEVER),
            (5, 100, 200),
            (7, 50, 400),
            (3, 300, 350),
            (0, 0, NEVER),
        ];
        let edges = [40i64, 60, 90, 30];

        let mut merged = DurationSegment::node(nodes[0].0, nodes[0].1, nodes[0].2);
        for k in 1..nodes.len() {
            let next = DurationSegment::node(nodes[k].0, nodes[k].1, nodes[k].2);
            merged = DurationSegment::merge(edges[k - 1], &merged, &next);
        }

        // Departing at `start_early` must realise exactly what was predicted.
        //
        // Note `duration - time_warp`, not `duration`. Warp is time the schedule
        // pretends it did not spend, so the wall clock advances by the duration
        // MINUS the warp — PyVRP calls the difference `netDuration`. Asserting
        // against `duration` alone would pass on every feasible instance and
        // fail the moment a window is missed, which is precisely the case M11
        // needs to get right.
        let (elapsed, warp) = simulate(&nodes, &edges, merged.start_early);
        assert_eq!(warp, merged.time_warp, "time warp at the predicted departure");
        assert_eq!(
            elapsed,
            merged.duration - merged.time_warp,
            "elapsed time at the predicted departure"
        );

        // And nothing does better. Scanning every departure is only affordable
        // because the instance is tiny, but it is the strongest available check:
        // it says the recurrence found the OPTIMUM, not merely a schedule.
        let predicted = (merged.time_warp, merged.duration - merged.time_warp);
        for start in 0..500i64 {
            let (elapsed, warp) = simulate(&nodes, &edges, start);
            assert!(
                (warp, elapsed) >= predicted,
                "departing at {start} gives (warp {warp}, elapsed {elapsed}), \
                 which beats the predicted optimum {predicted:?}"
            );
        }
    }

    /// The same claim where the windows genuinely cannot be met, so the answer
    /// is nonzero time warp. Without a case like this the merge could ignore
    /// `delta_tw` entirely and still pass.
    #[test]
    fn duration_segment_merge_accounts_for_unavoidable_lateness() {
        // Node 2 closes at 50, but cannot be reached before 100+.
        let nodes = [(0i64, 0i64, NEVER), (10, 0, NEVER), (5, 0, 50)];
        let edges = [60i64, 40];

        let mut merged = DurationSegment::node(nodes[0].0, nodes[0].1, nodes[0].2);
        for k in 1..nodes.len() {
            let next = DurationSegment::node(nodes[k].0, nodes[k].1, nodes[k].2);
            merged = DurationSegment::merge(edges[k - 1], &merged, &next);
        }

        assert!(merged.time_warp > 0, "an unreachable window must produce warp");

        let (elapsed, warp) = simulate(&nodes, &edges, merged.start_early);
        assert_eq!(warp, merged.time_warp);
        assert_eq!(elapsed, merged.duration - merged.time_warp);

        let predicted = (merged.time_warp, merged.duration - merged.time_warp);
        for start in 0..200i64 {
            let (elapsed, warp) = simulate(&nodes, &edges, start);
            assert!(
                (warp, elapsed) >= predicted,
                "departing at {start} gives (warp {warp}, elapsed {elapsed}), \
                 which beats the predicted optimum {predicted:?}"
            );
        }
    }

    /// Concatenation must be associative — that is what makes prefix/suffix
    /// arrays valid, and therefore what makes O(1) evaluation possible.
    #[test]
    fn duration_segment_merge_is_associative() {
        let a = DurationSegment::node(10, 0, 500);
        let b = DurationSegment::node(5, 100, 200);
        let c = DurationSegment::node(7, 150, 400);

        // (a ⊕ b) ⊕ c, with the second edge folded into the outer merge.
        let left = DurationSegment::merge(20, &DurationSegment::merge(30, &a, &b), &c);
        // a ⊕ (b ⊕ c)
        let right = DurationSegment::merge(30, &a, &DurationSegment::merge(20, &b, &c));

        assert_eq!(left.duration, right.duration);
        assert_eq!(left.time_warp, right.time_warp);
    }

    #[test]
    fn an_empty_segment_is_the_identity() {
        let a = DurationSegment::node(10, 50, 500);
        let merged = DurationSegment::merge(0, &DurationSegment::empty(), &a);
        assert_eq!(merged.duration, a.duration);
        assert_eq!(merged.time_warp, a.time_warp);
    }

    // ─────────────────────────────────── the labels, wired to a real Tour

    /// An instance with real windows, tight enough that most orderings are late.
    ///
    /// The tightness matters. With generous windows almost every move has zero
    /// warp before and after, and a composition that silently drops a piece
    /// would pass every test — the failures only appear where the schedule is
    /// actually under pressure.
    fn timed_problem(n: usize, seed: u32, start: Option<usize>, end: Option<usize>) -> Problem {
        let mut rng = Rng::new(seed);
        let mut cells = vec![0i32; n * n];
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    cells[i * n + j] = 1 + (rng.next_f64() * 300.0) as i32;
                }
            }
        }
        let mut optional = vec![1u8; n];
        if let Some(s) = start {
            optional[s] = 0;
        }
        if let Some(e) = end {
            optional[e] = 0;
        }

        let mut service = vec![0i64; n];
        let mut tw_open = vec![0i64; n];
        let mut tw_close = vec![NEVER; n];
        for node in 0..n {
            service[node] = (rng.next_f64() * 60.0) as i64;
            if rng.next_f64() < 0.7 {
                let from = (rng.next_f64() * 2000.0) as i64;
                tw_open[node] = from;
                tw_close[node] = from + 100 + (rng.next_f64() * 600.0) as i64;
            }
        }

        let time = TimeData::new(
            Matrix::new(n, cells.clone()),
            service,
            tw_open,
            tw_close,
            0,
        );
        Problem::with_time(
            Matrix::new(n, cells),
            optional,
            None,
            10_000_000,
            start,
            end,
            Some(time),
        )
    }

    /// Walk a visiting order with a clock, absorbing lateness as warp.
    ///
    /// The slow, obvious answer that every label composition is checked against.
    /// Deliberately written from the departure time rather than from an optimal
    /// one — that is what a driver experiences, and it is the thing
    /// `DurationSegment::departure` exists to pin down.
    fn simulate_warp(problem: &Problem, order: &[i32]) -> i64 {
        let time = problem.time.as_ref().unwrap();
        let mut clock = 0i64;
        let mut warp = 0i64;
        for (index, &node) in order.iter().enumerate() {
            let node = node as usize;
            if index > 0 {
                clock += time.travel(order[index - 1] as usize, node);
            }
            if clock < time.tw_open[node] {
                clock = time.tw_open[node];
            }
            if clock > time.tw_close[node] {
                warp += clock - time.tw_close[node];
                clock = time.tw_close[node];
            }
            clock += time.service[node];
        }
        warp
    }

    #[test]
    fn the_routes_own_warp_matches_a_simulation() {
        for seed in 1..10u32 {
            let n = 14;
            let problem = timed_problem(n, seed, Some(0), Some(n - 1));
            let tour = seeded_tour(&problem, n);
            assert_eq!(
                tour.time_warp(&problem),
                simulate_warp(&problem, &tour.snapshot()),
                "seed {seed}"
            );
        }
    }

    /// **The test commit 2 exists for.** Every legal reversal, not a sample.
    ///
    /// The composition is head ⊕ reversed-stretch ⊕ tail, and each of the three
    /// has its own way of being wrong: the head can forget the departure time,
    /// the stretch can come back in the wrong direction, and the arcs joining
    /// them can be taken from the wrong nodes. All three produce a plausible
    /// number, and all three are only visible against a full recompute.
    #[test]
    fn every_reversal_predicts_the_schedule_exactly() {
        for seed in 1..8u32 {
            for &(start, end) in &[(None, None), (Some(0), Some(13))] {
                let n = 14;
                let problem = timed_problem(n, seed, start, end);
                let tour = seeded_tour(&problem, n);
                let lo = tour.lo(&problem);
                let hi = tour.hi(&problem);

                for i in lo..=hi {
                    for j in (i + 1)..=hi {
                        let predicted = tour.warp_after_reverse(&problem, i, j);
                        let mut after = tour.snapshot();
                        after[i..=j].reverse();
                        assert_eq!(
                            predicted,
                            simulate_warp(&problem, &after),
                            "seed {seed}, pins {start:?}/{end:?}, reverse({i},{j})"
                        );
                    }
                }
            }
        }
    }

    /// The same standard for Or-opt: every segment start, length, gap and
    /// orientation.
    #[test]
    fn every_or_opt_predicts_the_schedule_exactly() {
        for seed in 1..6u32 {
            for &(start, end) in &[(None, None), (Some(0), Some(10))] {
                let n = 11;
                let problem = timed_problem(n, seed, start, end);
                let tour = seeded_tour(&problem, n);
                let lo = tour.lo(&problem);
                let hi = tour.hi(&problem);

                for seg in 1..=3usize {
                    for p in lo..=hi {
                        if p + seg - 1 > hi {
                            continue;
                        }
                        let shortened = n - seg;
                        for u in tour.lo_gap(&problem)..=tour.hi_gap(&problem, shortened) {
                            if u == p {
                                continue;
                            }
                            for &reversed in &[false, true] {
                                if reversed && seg == 1 {
                                    continue;
                                }
                                let predicted =
                                    tour.warp_after_or_opt(&problem, p, seg, u, reversed);

                                let original = tour.snapshot();
                                let mut segment: Vec<i32> = original[p..p + seg].to_vec();
                                if reversed {
                                    segment.reverse();
                                }
                                let mut after: Vec<i32> = original.clone();
                                after.drain(p..p + seg);
                                for (k, &node) in segment.iter().enumerate() {
                                    after.insert(u + k, node);
                                }

                                assert_eq!(
                                    predicted,
                                    simulate_warp(&problem, &after),
                                    "seed {seed}, pins {start:?}/{end:?}, \
                                     or_opt(p={p}, seg={seg}, u={u}, rev={reversed})"
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    /// A route that can meet every window must report exactly zero warp — not
    /// "a small number". A penalty applied to a feasible route would make the
    /// search chase lateness that is not there.
    #[test]
    fn a_feasible_route_has_no_warp() {
        let n = 6;
        let mut cells = vec![0i32; n * n];
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    cells[i * n + j] = 10;
                }
            }
        }
        // Wide open windows, and a departure early enough to make them all.
        let time = TimeData::new(
            Matrix::new(n, cells.clone()),
            vec![5; n],
            vec![0; n],
            vec![NEVER; n],
            0,
        );
        let problem = Problem::with_time(
            Matrix::new(n, cells),
            vec![1; n],
            None,
            10_000_000,
            Some(0),
            Some(n - 1),
            Some(time),
        );
        let tour = seeded_tour(&problem, n);
        assert_eq!(tour.time_warp(&problem), 0);
    }

    /// With no closing time anywhere, the labels are never built and every
    /// schedule question answers zero — which is what keeps a driver who set no
    /// windows paying nothing for the machinery.
    #[test]
    fn a_problem_without_closing_times_builds_no_labels() {
        let n = 8;
        let problem = asymmetric_problem(n, 3, Some(0), Some(7));
        assert!(!problem.windows_bind());
        let tour = seeded_tour(&problem, n);
        assert_eq!(tour.time_warp(&problem), 0);
    }
}
