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

use crate::problem::Problem;

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
    pub fn empty() -> Self {
        DurationSegment {
            duration: 0,
            time_warp: 0,
            start_early: 0,
            start_late: NEVER,
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

    /// Cheapest gap for an absent node, as (gap index, cost).
    pub fn best_insertion(&self, problem: &Problem, node: usize) -> (usize, i64) {
        let m = &problem.matrix;
        let lo = self.lo_gap(problem);
        let hi = self.hi_gap(problem, self.len);

        let mut best_at = lo;
        let mut best_cost = i64::MAX;
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
            if cost < best_cost {
                best_cost = cost;
                best_at = u;
            }
        }
        (best_at, best_cost)
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

        let (at, cost) = tour.best_insertion(&problem, node);

        // Check it against every gap, the slow way.
        let mut best = i64::MAX;
        for u in 0..=tour.len {
            let mut candidate = tour.snapshot();
            candidate.insert(u, node as i32);
            best = best.min(recompute(&problem, &candidate) - shortened_cost);
        }
        assert_eq!(cost, best);

        tour.insert_at(&problem, node, at);
        assert_eq!(tour.cost(), shortened_cost + cost);
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
}
