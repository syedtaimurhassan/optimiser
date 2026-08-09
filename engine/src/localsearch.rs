//! Descent to a local optimum: 2-opt and Or-opt over candidate lists, plus the
//! add/drop/swap moves that decide WHICH stops are visited.
//!
//! ── Resumable, because a wasm call cannot yield ───────────────────────────
//!
//! Every piece of state lives in `LocalSearch` or in the `Tour`, and `run` takes
//! a mutable work budget it decrements as it goes. When the budget runs out it
//! returns `Progress::Budget` and the caller can come back later; nothing is
//! lost and nothing is restarted. That is what makes cancellation possible in a
//! module that cannot `await`.
//!
//! The TypeScript engine achieves the same thing by awaiting a macrotask every
//! ~12 ms. It has that luxury; we do not.
//!
//! ── Don't-look bits ───────────────────────────────────────────────────────
//!
//! A node is only re-examined when a move actually changed something next to it,
//! so a converged region of the route stops being scanned at all. Without this
//! the sweep is O(n · K) per pass regardless of how little is left to find, and
//! at n = 1000 that is the difference between a search and a scan.

use crate::problem::Problem;
use crate::tour::Tour;

/// Longest segment Or-opt will relocate. Matches `MAX_SEGMENT` in `engineTs.ts`.
const MAX_SEGMENT: usize = 3;

/// Why `run` returned.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Progress {
    /// A local optimum: the queue drained and no selection move applied.
    Converged,
    /// The work budget ran out mid-descent. Call again to continue.
    Budget,
}

pub struct LocalSearch {
    /// Circular buffer of nodes waiting to be examined. Capacity n is enough
    /// because `queued` forbids duplicates.
    queue: Vec<i32>,
    queued: Vec<u8>,
    head: usize,
    tail: usize,
    /// Set when the queue drained and a selection pass is the next thing owed.
    selection_pending: bool,
    /*
      ── What a second of lateness costs, in arc units ─────────────────────

      The search minimises `arcs + skip_penalty × skipped + tw_penalty × warp`,
      and walks THROUGH infeasibility rather than around it. That is the whole
      reason the time-warp formulation exists: a feasibility-preserving search
      cannot cross a tightly-constrained instance, because every route between
      two good ones is briefly late and would be rejected.

      The driver raises this when the answer it is converging on is infeasible
      and lets it decay when it is not, so the search spends its time near the
      boundary rather than deep inside either region. Zero means "arcs only",
      which is exactly the M10 search.
    */
    tw_penalty: i64,
}

impl LocalSearch {
    pub fn new(n: usize) -> Self {
        LocalSearch {
            queue: vec![0; n.max(1)],
            queued: vec![0; n],
            head: 0,
            tail: 0,
            selection_pending: true,
            tw_penalty: 0,
        }
    }

    pub fn set_tw_penalty(&mut self, penalty: i64) {
        self.tw_penalty = penalty;
    }

    pub fn tw_penalty(&self) -> i64 {
        self.tw_penalty
    }

    /// What a move's effect on the schedule is worth, in arc units.
    ///
    /// Zero whenever there is no window to miss, which is the common case and
    /// must cost nothing: no segment-tree query, no second matrix read, no
    /// branch beyond this one.
    #[inline(always)]
    fn warp_cost(&self, problem: &Problem, after: impl FnOnce() -> i64, before: i64) -> i64 {
        if !problem.windows_bind() || self.tw_penalty == 0 {
            return 0;
        }
        self.tw_penalty * (after() - before)
    }

    /// The route's lateness right now, or 0 when nothing can be late.
    #[inline(always)]
    fn warp_now(&self, problem: &Problem, tour: &Tour) -> i64 {
        if !problem.windows_bind() || self.tw_penalty == 0 {
            0
        } else {
            tour.time_warp(problem)
        }
    }

    /// Wake every node in the route. Called at the start of a descent and after
    /// any selection move, both of which invalidate the converged state.
    pub fn reset(&mut self, problem: &Problem, tour: &Tour) {
        let _ = problem;
        self.head = 0;
        self.tail = 0;
        for slot in self.queued.iter_mut() {
            *slot = 0;
        }
        for t in 0..tour.len {
            self.push(tour.order[t]);
        }
        self.selection_pending = true;
    }

    #[inline]
    fn push(&mut self, node: i32) {
        let node_ix = node as usize;
        if self.queued[node_ix] == 1 {
            return;
        }
        self.queued[node_ix] = 1;
        let cap = self.queue.len();
        self.queue[self.tail % cap] = node;
        self.tail += 1;
    }

    /// Next node still in the route, or `None` when the queue is empty.
    fn pop(&mut self, tour: &Tour) -> Option<usize> {
        let cap = self.queue.len();
        while self.head < self.tail {
            let node = self.queue[self.head % cap];
            self.head += 1;
            self.queued[node as usize] = 0;
            if tour.pos[node as usize] >= 0 {
                return Some(node as usize);
            }
        }
        None
    }

    /// Re-examine one node and its neighbours on the next descent.
    ///
    /// Guided local search uses this instead of `reset`: after penalising an
    /// arc, the only part of the route whose evaluation changed is the handful
    /// of nodes around that arc. Waking the whole tour would throw away the
    /// don't-look bits every iteration and turn each descent back into a full
    /// O(n · K) sweep, which is most of what makes GLS affordable.
    pub fn wake_external(&mut self, tour: &Tour, node: usize) {
        self.wake(tour, node);
        /*
          The selection pass is owed again.

          `run` clears this flag when it reaches a local optimum, and only
          `reset` sets it. GLS never calls `reset` — that is the point of waking
          two nodes instead of the whole tour — so without this line the search
          runs exactly ONE add/drop/swap pass in its entire life, at the end of
          the opening descent, and then never reconsiders which stops to visit
          however much the penalties change.

          Invisible whenever the cap does not bind, because then there is
          nothing to select. Exactly wrong on the instances where the choice of
          stops IS the problem.
        */
        self.selection_pending = true;
    }

    /// Wake a node and its tour neighbours — the ones a move just invalidated.
    fn wake(&mut self, tour: &Tour, node: usize) {
        self.push(node as i32);
        let p = tour.pos[node];
        if p < 0 {
            return;
        }
        let p = p as usize;
        if p > 0 {
            self.push(tour.order[p - 1]);
        }
        if p + 1 < tour.len {
            self.push(tour.order[p + 1]);
        }
    }

    /// Descend until a local optimum or until `budget` is exhausted.
    ///
    /// `budget` counts node scans, not arc evaluations: one unit is a full
    /// 2-opt-then-Or-opt sweep of one node's candidate list, which is a bounded
    /// ~140 evaluations plus, on acceptance, one O(n) prefix rebuild. Uniform
    /// enough that the host can calibrate a chunk of work to a wall-clock target
    /// by measuring the last one.
    pub fn run(&mut self, problem: &Problem, tour: &mut Tour, budget: &mut i64) -> Progress {
        loop {
            if *budget <= 0 {
                return Progress::Budget;
            }

            match self.pop(tour) {
                Some(node) => {
                    *budget -= 1;
                    /*
                      The operator table, in the order they are tried.

                      First improvement, cheapest operator first: a node's sweep
                      stops at the first move that pays, so putting the cheap
                      neighbourhoods before the expensive ones means the
                      expensive ones only run where the cheap ones found
                      nothing. Adding an operator is adding a line here and a
                      method below — which is the point of writing it as a
                      table rather than as a chain of `||`.

                      2-opt and Or-opt are M10's. `exchange` is
                      `use_exchange` from OR-Tools' operator set, and it is here
                      because it cannot be composed from the other two: trading
                      two stops that sit far apart in the route takes several
                      individually-worse moves any other way.
                    */
                    let improved = self.two_opt_from(problem, tour, node)
                        || self.or_opt_from(problem, tour, node)
                        || self.exchange_from(problem, tour, node);
                    if improved {
                        self.push(node as i32);
                    }
                }
                None => {
                    if !self.selection_pending {
                        return Progress::Converged;
                    }
                    // A selection pass is O(n · len) when the cap binds, which
                    // is the only case where its add and swap loops do anything.
                    // Charge it accordingly so the next budget check comes
                    // sooner rather than after an unbounded overshoot.
                    *budget -= (problem.n() as i64).max(1);
                    self.selection_pending = false;
                    if self.selection_pass(problem, tour) {
                        self.reset(problem, tour);
                    } else {
                        return Progress::Converged;
                    }
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────── 2-opt

    /// One node's 2-opt neighbourhood, first improvement.
    ///
    /// For node `a` and each candidate `c` there are two ways a reversal can put
    /// them next to each other — `a` before `c`, or `c` before `a` — and both
    /// are tried, because with an asymmetric matrix they are genuinely different
    /// moves with different costs.
    fn two_opt_from(&mut self, problem: &Problem, tour: &mut Tour, a: usize) -> bool {
        let p = tour.pos[a];
        if p < 0 {
            return false;
        }
        let p = p as usize;
        /*
          The zone, not the whole route.

          A move may reorder positions within the first block, within the
          unpinned middle, or within the last block, but never across a
          boundary — that is what "First" and "Last" mean. Asking for the zone
          here is candidate GENERATION: a move that would cross is never built,
          rather than built and rejected, so a pinned route costs no more
          evaluations than an unpinned one. With nothing pinned this is exactly
          `(lo, hi)`.
        */
        let Some((lo, hi)) = tour.zone(problem, p) else {
            return false;
        };
        let warp_now = self.warp_now(problem, tour);

        // The penalised delta of reversing i..=j. The arc term is exact and
        // O(1); the schedule term is O(log n) and is only reached when a window
        // can actually be missed.
        let improves = |search: &Self, tour: &Tour, i: usize, j: usize| {
            let arcs = tour.reverse_delta(problem, i, j);
            // Short-circuit: with no schedule to worry about, a losing arc delta
            // is a losing move and there is nothing to query.
            if !problem.windows_bind() || search.tw_penalty == 0 {
                return arcs < 0;
            }
            arcs + search.warp_cost(problem, || tour.warp_after_reverse(problem, i, j), warp_now) < 0
        };

        for slot in 0..problem.candidates.width {
            let c = problem.candidates.of(a)[slot] as usize;
            let q = tour.pos[c];
            if q < 0 {
                continue;
            }
            let q = q as usize;

            // `a` before `c`: reverse (p+1 ..= q), creating the arc a → c.
            if q >= p + 1 && p + 1 >= lo && q <= hi && improves(self, tour, p + 1, q) {
                tour.apply_reverse(problem, p + 1, q);
                self.wake(tour, a);
                self.wake(tour, c);
                return true;
            }

            // `c` before `a`: reverse (q+1 ..= p), creating the arc c → a.
            if p >= q + 1 && q + 1 >= lo && p <= hi && improves(self, tour, q + 1, p) {
                tour.apply_reverse(problem, q + 1, p);
                self.wake(tour, a);
                self.wake(tour, c);
                return true;
            }
        }
        false
    }

    // ─────────────────────────────────────────────────────────── Or-opt

    /// Or-opt around one node, first improvement.
    ///
    /// The segment always STARTS at `a`, and the insertion points tried are the
    /// gaps beside `a`'s candidates. Trying every gap would be O(n) per segment
    /// and would swamp the candidate lists that make the rest of this cheap.
    fn or_opt_from(&mut self, problem: &Problem, tour: &mut Tour, a: usize) -> bool {
        let p = tour.pos[a];
        if p < 0 {
            return false;
        }
        let p = p as usize;
        // Same rule as 2-opt: the segment and the gap it lands in must be in one
        // zone. Deriving the gap bounds from the zone rather than from
        // `lo_gap`/`hi_gap` is what keeps a relocation inside a pinned block.
        let Some((lo, hi)) = tour.zone(problem, p) else {
            return false;
        };
        let warp_now = self.warp_now(problem, tour);

        for seg in 1..=MAX_SEGMENT {
            if p + seg - 1 > hi || tour.len < seg + 1 {
                break;
            }
            // In the shortened tour the zone loses `seg` positions, so its last
            // legal gap moves down by the same amount.
            let lo_gap = lo;
            let hi_gap = hi + 1 - seg;

            for slot in 0..problem.candidates.width {
                let c = problem.candidates.of(a)[slot] as usize;
                let q = tour.pos[c];
                // A node inside the segment cannot also be the thing the segment
                // is placed next to.
                if q < 0 {
                    continue;
                }
                let q = q as usize;
                if q >= p && q < p + seg {
                    continue;
                }

                // Gap indices in the SHORTENED tour, either side of `c`.
                let shifted = if q > p { q - seg } else { q };
                for u in [shifted, shifted + 1] {
                    if u < lo_gap || u > hi_gap || u == p {
                        continue;
                    }
                    for reversed in [false, true] {
                        if reversed && seg == 1 {
                            continue;
                        }
                        let arcs = tour.or_opt_delta(problem, p, seg, u, reversed);
                        let delta = arcs
                            + self.warp_cost(
                                problem,
                                || tour.warp_after_or_opt(problem, p, seg, u, reversed),
                                warp_now,
                            );
                        if delta < 0 {
                            let moved: Vec<i32> = tour.order[p..p + seg].to_vec();
                            tour.apply_or_opt(problem, p, seg, u, reversed);
                            for node in moved {
                                self.wake(tour, node as usize);
                            }
                            self.wake(tour, c);
                            return true;
                        }
                    }
                }
            }
        }
        false
    }

    // ─────────────────────────────────────────────────────── exchange

    /// Swap `a` with one of its candidates, first improvement.
    ///
    /// `use_exchange` in OR-Tools' operator set. Confined to one zone like every
    /// other move, and searched over `a`'s candidate list rather than over every
    /// position — swapping a stop with something on the other side of the city
    /// is never the improving move, and scanning for it would cost O(n) per node
    /// and swamp the candidate lists that make the rest of this cheap.
    fn exchange_from(&mut self, problem: &Problem, tour: &mut Tour, a: usize) -> bool {
        let p = tour.pos[a];
        if p < 0 {
            return false;
        }
        let p = p as usize;
        let Some((lo, hi)) = tour.zone(problem, p) else {
            return false;
        };
        let warp_now = self.warp_now(problem, tour);

        for slot in 0..problem.candidates.width {
            let c = problem.candidates.of(a)[slot] as usize;
            let q = tour.pos[c];
            if q < 0 {
                continue;
            }
            let q = q as usize;
            if q < lo || q > hi || q == p {
                continue;
            }
            // Ordered, because `exchange_delta` is written for `p < q` and the
            // adjacent case depends on which of the two comes first.
            let (left, right) = if p < q { (p, q) } else { (q, p) };

            let delta = tour.exchange_delta(problem, left, right)
                + self.warp_cost(
                    problem,
                    || tour.warp_after_exchange(problem, left, right),
                    warp_now,
                );
            if delta < 0 {
                tour.apply_exchange(problem, left, right);
                self.wake(tour, a);
                self.wake(tour, c);
                return true;
            }
        }
        false
    }

    // ────────────────────────────────────────────────── add / drop / swap

    /// Search the K cap rather than merely obeying it.
    ///
    /// Without these three moves, which stops get visited is decided entirely by
    /// the construction heuristic and never revisited. That is exactly the
    /// failure the benchmark's `decoy` family is built to expose: a greedy build
    /// walks a ring of cheap near stops, spends its whole budget, and never
    /// reaches the cluster that was worth going to.
    fn selection_pass(&mut self, problem: &Problem, tour: &mut Tour) -> bool {
        let mut improved = false;

        // Drop: an optional node whose detour costs more than skipping it.
        let mut p = tour.len;
        while p > 0 {
            p -= 1;
            if p < tour.lo(problem) || p > tour.hi(problem) {
                continue;
            }
            let node = tour.order[p] as usize;
            if !problem.is_optional(node) {
                continue;
            }
            /*
              Arcs alone, deliberately — no warp relief. See `tour::Insertion`.

              Dropping a stop does relieve lateness, often by a lot, and pricing
              that relief in makes it a rational move: the time-window penalty
              climbs whenever the route is late, so on a day that cannot be done
              on time it eventually exceeds the skip penalty and abandoning a
              delivery becomes the cheapest thing available. That is not a
              trade-off this app is allowed to make on the driver's behalf.
            */
            if tour.removal_gain(problem, p) - problem.skip_penalty > 0 {
                tour.remove_at(problem, p);
                improved = true;
            }
        }

        // Add: an absent optional node cheaper to visit than to skip.
        if tour.optional_visited(problem) < problem.cap {
            for node in 0..problem.n() {
                if !problem.is_optional(node) || tour.pos[node] >= 0 {
                    continue;
                }
                if tour.optional_visited(problem) >= problem.cap {
                    break;
                }
                // The position comes from the penalised cost, the decision from
                // the arcs — symmetrically with the drop above, and for the same
                // reason: lateness decides where a stop goes, not whether.
                let placed = tour.best_insertion(problem, node, self.tw_penalty);
                if placed.arcs - problem.skip_penalty < 0 {
                    tour.insert_at(problem, node, placed.at);
                    self.wake(tour, node);
                    improved = true;
                }
            }
        }

        // Swap: only bites when the cap is binding, which is exactly when the
        // choice of WHICH stops to visit is the whole problem.
        //
        // ── The move has to be measured AFTER the removal ─────────────────
        //
        // The obvious implementation costs the incoming node against the
        // current route, then removes the outgoing one, then inserts. Those two
        // numbers are measured on different routes: once the worst node is gone
        // its neighbours have closed up, and the gap the incoming node wanted
        // may no longer exist. The move can then be applied while making the
        // route WORSE, and — because it still reports "improved" — the pass runs
        // again, swaps them back, and the search oscillates until the clock
        // saves it.
        //
        // This is not hypothetical. `selection_moves_respect_the_cap` ran a
        // budget of a million node scans to exhaustion on a 30-node instance
        // before this was fixed; the descent never converged at all. The
        // TypeScript engine has the same unsound test, where it is invisible
        // because a deadline stops the loop and nothing checks that the search
        // reached a local optimum.
        //
        // So: remove first, price the insertion against the SHORTENED route,
        // and put the node back untouched if the composite move does not pay.
        // `cost - gain` is then the exact delta, and every accepted move
        // strictly decreases an integer objective that is bounded below — which
        // is what makes termination a fact rather than a hope.
        if tour.optional_visited(problem) >= problem.cap {
            for node in 0..problem.n() {
                if !problem.is_optional(node) || tour.pos[node] >= 0 {
                    continue;
                }

                let mut worst_at = usize::MAX;
                let mut worst_gain = i64::MIN;
                let hi = tour.hi(problem);
                let warp_now = self.warp_now(problem, tour);
                for p in tour.lo(problem)..=hi {
                    if p >= tour.len {
                        break;
                    }
                    if !problem.is_optional(tour.order[p] as usize) {
                        continue;
                    }
                    let gain = tour.removal_gain(problem, p)
                        - self.warp_cost(problem, || tour.warp_after_remove(problem, p), warp_now);
                    if gain > worst_gain {
                        worst_gain = gain;
                        worst_at = p;
                    }
                }
                if worst_at == usize::MAX {
                    continue;
                }

                let leaving = tour.order[worst_at] as usize;
                tour.remove_at(problem, worst_at);
                let placed = tour.best_insertion(problem, node, self.tw_penalty);

                /*
                  The penalised cost on BOTH sides, unlike drop and add.

                  A swap keeps the number of stops the same, so lateness cannot
                  be bought here by abandoning anybody — it is a genuine choice
                  between two stops, and which of them the schedule can actually
                  accommodate is exactly the right thing to decide it on.
                */
                if placed.cost - worst_gain < 0 {
                    tour.insert_at(problem, node, placed.at);
                    self.wake(tour, node);
                    self.wake(tour, leaving);
                    improved = true;
                } else {
                    // Exact rollback: re-inserting at the position it came from
                    // restores the order it had.
                    tour.insert_at(problem, leaving, worst_at);
                }
            }
        }

        improved
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::construct::construct;
    use crate::matrix::Matrix;
    use crate::rng::Rng;

    fn problem_with(
        n: usize,
        seed: u32,
        k: Option<usize>,
        start: Option<usize>,
        end: Option<usize>,
    ) -> Problem {
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
        Problem::new(Matrix::new(n, cells), optional, k, 10_000_000, start, end)
    }

    fn descend(problem: &Problem, tour: &mut Tour) {
        let mut search = LocalSearch::new(problem.n());
        search.reset(problem, tour);
        let mut budget = 1_000_000i64;
        assert_eq!(search.run(problem, tour, &mut budget), Progress::Converged);
    }

    /// Local search must never make a route worse, and must never break it.
    #[test]
    fn descent_improves_and_preserves_validity() {
        for seed in 1..15u32 {
            let n = 30;
            let problem = problem_with(n, seed, None, Some(0), Some(29));
            let mut tour = Tour::new(n);
            construct(&problem, &mut tour, None, 0);
            let before = tour.objective(&problem);

            descend(&problem, &mut tour);

            assert!(
                tour.objective(&problem) <= before,
                "seed {seed}: descent made it worse ({} > {before})",
                tour.objective(&problem)
            );
            assert_eq!(tour.order[0], 0);
            assert_eq!(tour.order[tour.len - 1], 29);
            let mut seen = tour.snapshot();
            seen.sort();
            seen.dedup();
            assert_eq!(seen.len(), tour.len, "seed {seed}: a node was visited twice");
        }
    }

    /// The reported cost must always be the real one. A delta that drifts from
    /// the truth is the failure mode this whole design is built to prevent, and
    /// it would otherwise be invisible — the search would simply return a route
    /// whose price tag was fiction.
    #[test]
    fn the_running_cost_never_drifts_from_a_full_recompute() {
        for seed in 1..10u32 {
            let n = 25;
            let problem = problem_with(n, seed, None, None, None);
            let mut tour = Tour::new(n);
            construct(&problem, &mut tour, None, 0);
            descend(&problem, &mut tour);

            let mut recomputed = 0i64;
            let order = tour.snapshot();
            for w in order.windows(2) {
                recomputed += i64::from(problem.matrix.at(w[0] as usize, w[1] as usize));
            }
            assert_eq!(tour.cost(), recomputed, "seed {seed}");
        }
    }

    /// Resuming a budget-limited descent must reach the same place as running it
    /// in one go. This is the property the whole chunked design rests on: if a
    /// pause could change the answer, cancellation would change the answer too.
    #[test]
    fn a_chunked_descent_matches_an_uninterrupted_one() {
        for seed in 1..10u32 {
            let n = 40;
            let problem = problem_with(n, seed, None, Some(0), None);

            let mut whole = Tour::new(n);
            construct(&problem, &mut whole, None, 0);
            descend(&problem, &mut whole);

            let mut chunked = Tour::new(n);
            construct(&problem, &mut chunked, None, 0);
            let mut search = LocalSearch::new(n);
            search.reset(&problem, &chunked);
            loop {
                // Three scans at a time — small enough to interrupt constantly.
                let mut budget = 3i64;
                if search.run(&problem, &mut chunked, &mut budget) == Progress::Converged {
                    break;
                }
            }

            assert_eq!(
                chunked.snapshot(),
                whole.snapshot(),
                "seed {seed}: chunking changed the route"
            );
        }
    }

    /// With the cap binding, the selection moves have to actually fire.
    #[test]
    fn selection_moves_respect_the_cap() {
        for seed in 1..10u32 {
            let n = 30;
            let problem = problem_with(n, seed, Some(10), Some(0), Some(29));
            let mut tour = Tour::new(n);
            construct(&problem, &mut tour, None, 0);
            descend(&problem, &mut tour);

            assert!(
                tour.optional_visited(&problem) <= 10,
                "seed {seed}: cap exceeded"
            );
            assert_eq!(tour.order[0], 0);
            assert_eq!(tour.order[tour.len - 1], 29);
        }
    }

    /// A two-node instance has no interior and nothing to improve. It must
    /// terminate rather than spin or panic.
    #[test]
    fn degenerate_instances_terminate() {
        for n in 2..5usize {
            let problem = problem_with(n, 3, None, Some(0), Some(n - 1));
            let mut tour = Tour::new(n);
            construct(&problem, &mut tour, None, 0);
            descend(&problem, &mut tour);
            assert_eq!(tour.order[0], 0);
            assert_eq!(tour.order[tour.len - 1], (n - 1) as i32);
        }
    }
}
