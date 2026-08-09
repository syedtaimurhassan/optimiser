//! Iterated local search, as a state machine.
//!
//! ── Why a state machine and not a loop ────────────────────────────────────
//!
//! The TypeScript driver is a `while` loop that awaits a macrotask every 12 ms.
//! Those awaits are what keep the UI painting, and — inside the worker — they
//! are the only moment a queued `cancel` message can be delivered.
//!
//! A wasm call has no such moment. It runs to completion, and there is no
//! `SharedArrayBuffer` to poll either, because M9 dropped cross-origin isolation
//! so that iOS Safari and Firefox would work at all.
//!
//! So control is inverted. Every variable the loop would have held in its stack
//! frame is a field here, `step` runs a bounded amount of work and returns, and
//! the host decides between calls whether to continue, report progress, or stop.
//! Cancellation latency is one step, and the host sizes a step to about 15 ms by
//! measuring the last one.
//!
//! ── What the search does ──────────────────────────────────────────────────
//!
//! Construct, descend, then repeat: perturb, descend, accept or revert. The
//! perturbation depends on whether the K cap binds, because when it does the
//! expensive question stops being the ORDER of the stops and becomes WHICH
//! stops, and a double bridge cannot answer that — it only ever permutes what is
//! already in the route.

use crate::construct::{construct, greedy_refill, restart};
use crate::localsearch::{LocalSearch, Progress};
use crate::problem::Problem;
use crate::rng::Rng;
use crate::tour::Tour;

/// Consecutive barren restarts before the search declares itself done.
const BARREN_RESTARTS: u32 = 3;

/// How far uphill the walk may drift, in parts per thousand. Twenty is the 2%
/// the TypeScript engine uses.
const DRIFT_PERMILLE: i64 = 20;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Construct,
    Descending,
    Done,
}

pub struct Driver {
    problem: Problem,
    tour: Tour,
    search: LocalSearch,
    rng: Rng,
    seed_order: Option<Vec<i32>>,

    best: Vec<i32>,
    best_objective: i64,
    current_objective: i64,

    phase: Phase,
    iterations: u32,
    since_improvement: u32,
    barren_restarts: u32,
    patience: u32,
    /// Zero unless the cap binds — see `settle`.
    drift_permille: i64,
}

impl Driver {
    pub fn new(problem: Problem, seed: u32, seed_order: Option<Vec<i32>>) -> Self {
        let n = problem.n();
        Driver {
            tour: Tour::new(n),
            search: LocalSearch::new(n),
            rng: Rng::new(seed),
            seed_order,
            best: Vec::new(),
            best_objective: i64::MAX,
            current_objective: i64::MAX,
            phase: Phase::Construct,
            iterations: 0,
            since_improvement: 0,
            barren_restarts: 0,
            // A driver at a kerb should not wait out a five-second clock for a
            // three-stop route that stopped changing in the first millisecond,
            // but "stopped improving" has to mean something stronger than "the
            // last few perturbations missed".
            patience: (8 * n as u32).max(100),
            drift_permille: 0,
            problem,
        }
    }

    /// Run for at most `budget` units of work. Returns true when the search has
    /// finished on its own; the host may stop it sooner for any reason.
    pub fn step(&mut self, mut budget: i64) -> bool {
        while budget > 0 {
            match self.phase {
                Phase::Construct => {
                    construct(&self.problem, &mut self.tour, self.seed_order.as_deref());

                    // Adopt the constructed route as `best` IMMEDIATELY, before
                    // descending.
                    //
                    // The host can stop this engine between any two steps, and a
                    // user who cancels still deserves the answer we already
                    // have. Waiting for the first descent to converge leaves a
                    // window — every step until then — in which the engine holds
                    // no route at all and would have to report failure. At
                    // n = 60 that window opened on the very first call, because
                    // construction alone costs more than a small chunk's budget.
                    self.best = self.tour.snapshot();
                    self.best_objective = self.tour.objective(&self.problem);
                    self.current_objective = self.best_objective;

                    // The drift is a property of the QUESTION, not of a
                    // particular route: it is zero unless some optional stop is
                    // being left out. With nothing left out there is no
                    // selection to revise, so wandering uphill buys nothing and
                    // the instances that already win should not pay for a
                    // problem they do not have.
                    self.drift_permille = if self.tour.has_absent_candidates(&self.problem) {
                        DRIFT_PERMILLE
                    } else {
                        0
                    };

                    self.search.reset(&self.problem, &self.tour);
                    self.phase = Phase::Descending;
                    // Construction is O(n) insertions each scanning O(n) gaps.
                    budget -= self.problem.n() as i64;
                }
                Phase::Descending => {
                    match self.search.run(&self.problem, &mut self.tour, &mut budget) {
                        Progress::Budget => return false,
                        Progress::Converged => {
                            self.settle();
                            if self.phase == Phase::Done {
                                return true;
                            }
                            self.perturb();
                            self.search.reset(&self.problem, &self.tour);
                            budget -= self.problem.n() as i64;
                        }
                    }
                }
                Phase::Done => return true,
            }
        }
        false
    }

    /// A descent has converged. Judge it, and decide whether to carry on.
    fn settle(&mut self) {
        let objective = self.tour.objective(&self.problem);
        self.iterations += 1;

        if objective < self.best_objective {
            self.best_objective = objective;
            self.best = self.tour.snapshot();
            self.current_objective = objective;
            self.since_improvement = 0;
            self.barren_restarts = 0;
        } else if objective
            < self.current_objective + (self.current_objective * self.drift_permille) / 1000
        {
            // Accept a slightly worse route and keep walking from it.
            //
            // Strict descent cannot solve the selection problem: reaching a
            // far cluster costs a whole detour to gain one delivery, so the
            // route is instantly worse and restoring the best throws it away
            // before the cluster's other stops — the entire point of going
            // there — can be added. `best` is kept separately, so nothing found
            // is ever lost.
            self.current_objective = objective;
            self.since_improvement += 1;
        } else {
            self.since_improvement += 1;
            let best = std::mem::take(&mut self.best);
            self.tour.restore(&self.problem, &best);
            self.best = best;
            self.current_objective = self.best_objective;
        }

        if self.barren_restarts >= BARREN_RESTARTS {
            self.phase = Phase::Done;
        }
    }

    /// Kick the route out of its current basin.
    fn perturb(&mut self) {
        if self.since_improvement >= self.patience {
            // Exhausting patience RESTARTS rather than returning. The first
            // version of the TypeScript driver returned here and lost the
            // optimum on an eight-stop instance it could have solved
            // exhaustively — it quit after forty perturbations with 119 ms of
            // its budget unspent.
            restart(&self.problem, &mut self.tour, &mut self.rng);
            self.since_improvement = 0;
            self.barren_restarts += 1;
            return;
        }

        let can_reselect = self.tour.has_absent_candidates(&self.problem);
        if can_reselect && self.rng.next_f64() < 0.5 {
            self.ruin_and_recreate();
        } else {
            self.double_bridge();
        }
    }

    /// Double bridge — a 4-opt move that 2-opt and Or-opt cannot undo in one
    /// step. That is the entire point of it: a perturbation the local search can
    /// walk straight back out of leaves the driver oscillating around one
    /// optimum instead of exploring.
    fn double_bridge(&mut self) -> bool {
        let a_min = 1usize;
        let c_max = if self.problem.end.is_none() {
            self.tour.len
        } else {
            self.tour.len.saturating_sub(1)
        };
        if c_max < a_min + 3 {
            return false;
        }

        // Drawn NESTED, not drawn-and-sorted. Three independent draws collide
        // often on a short route — on an eight-stop round, roughly half the
        // time — and a collision means the perturbation silently does nothing
        // while still counting as a failed iteration. That is how a driver runs
        // out of patience without ever having searched.
        let a = a_min + self.rng.below(c_max - a_min - 1);
        let b = a + 1 + self.rng.below(c_max - a - 1);
        let c = b + 1 + self.rng.below(c_max - b);

        let mut rebuilt: Vec<i32> = Vec::with_capacity(self.tour.len);
        rebuilt.extend_from_slice(&self.tour.order[..a]);
        rebuilt.extend_from_slice(&self.tour.order[b..c]);
        rebuilt.extend_from_slice(&self.tour.order[a..b]);
        rebuilt.extend_from_slice(&self.tour.order[c..self.tour.len]);
        self.tour.restore(&self.problem, &rebuilt);
        true
    }

    /// Tear a contiguous run out of the route and rebuild it, forcing in one
    /// stop chosen at random from those currently left out.
    ///
    /// The forced stop is the whole trick. A greedy refill on its own just puts
    /// the cheap ring straight back; once a single far-cluster stop is in the
    /// route, its neighbours are cheap to add and the refill follows it across
    /// the map. Most attempts are wasted, which is fine — an attempt costs
    /// microseconds and only one needs to land.
    fn ruin_and_recreate(&mut self) {
        let lo = self.tour.lo(&self.problem);
        let hi = self.tour.hi(&self.problem);
        let mut removable: Vec<usize> = Vec::new();
        for p in lo..=hi {
            if p >= self.tour.len {
                break;
            }
            if self.problem.is_optional(self.tour.order[p] as usize) {
                removable.push(p);
            }
        }
        if removable.is_empty() {
            return;
        }

        // A contiguous run, because the stops that should leave together are the
        // ones near each other, and adjacency in the route is the cheapest
        // available proxy for that.
        let fraction = 0.15 + self.rng.next_f64() * 0.35;
        let span = ((removable.len() as f64 * fraction).round() as usize).max(1);
        let from = self.rng.below(removable.len().saturating_sub(span).max(1));
        let to = (from + span).min(removable.len());
        // Descending, so the positions still to be removed stay valid.
        for i in (from..to).rev() {
            self.tour.remove_at(&self.problem, removable[i]);
        }

        let mut absent: Vec<usize> = Vec::new();
        for node in 0..self.problem.n() {
            if self.problem.is_optional(node) && self.tour.pos[node] < 0 {
                absent.push(node);
            }
        }
        if !absent.is_empty() && self.tour.optional_visited(&self.problem) < self.problem.cap {
            let seed = absent[self.rng.below(absent.len())];
            let (at, _) = self.tour.best_insertion(&self.problem, seed);
            self.tour.insert_at(&self.problem, seed, at);
        }

        greedy_refill(&self.problem, &mut self.tour);
    }

    // ────────────────────────────────────────────────────────── reporting

    pub fn best(&self) -> &[i32] {
        &self.best
    }

    pub fn best_objective(&self) -> i64 {
        self.best_objective
    }

    pub fn iterations(&self) -> u32 {
        self.iterations
    }

    pub fn problem(&self) -> &Problem {
        &self.problem
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matrix::Matrix;

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

    /// Run to completion, with a cap so a bug cannot hang the suite.
    fn solve(problem: Problem, seed: u32) -> (Vec<i32>, i64) {
        let mut driver = Driver::new(problem, seed, None);
        for _ in 0..200_000 {
            if driver.step(64) {
                break;
            }
        }
        (driver.best().to_vec(), driver.best_objective())
    }

    /// Exhaustive optimality. Every permutation of the interior is enumerated
    /// and compared against what the driver found.
    ///
    /// This is the check that a fast wrong answer cannot survive. Local search
    /// quality arguments are all relative; this one is absolute.
    #[test]
    fn finds_the_optimum_on_small_instances() {
        let mut checked = 0;
        for n in 6..=8usize {
            for seed in 1..=20u32 {
                let problem = problem_with(n, seed, None, Some(0), Some(n - 1));
                let matrix_n = problem.n();

                // Brute force: every ordering of the interior nodes.
                let interior: Vec<i32> = (1..n as i32 - 1).collect();
                let mut best = i64::MAX;
                permute(&interior, &mut |perm: &[i32]| {
                    let mut order = vec![0i32];
                    order.extend_from_slice(perm);
                    order.push(matrix_n as i32 - 1);
                    let mut cost = 0i64;
                    for w in order.windows(2) {
                        cost += i64::from(problem.matrix.at(w[0] as usize, w[1] as usize));
                    }
                    best = best.min(cost);
                });

                let (order, objective) = solve(problem, seed);
                assert_eq!(
                    objective, best,
                    "n={n} seed={seed}: driver found {objective}, optimum is {best} (order {order:?})"
                );
                checked += 1;
            }
        }
        assert_eq!(checked, 60);
    }

    fn permute(items: &[i32], visit: &mut impl FnMut(&[i32])) {
        fn go(items: &mut Vec<i32>, k: usize, visit: &mut impl FnMut(&[i32])) {
            if k == items.len() {
                visit(items);
                return;
            }
            for i in k..items.len() {
                items.swap(k, i);
                go(items, k + 1, visit);
                items.swap(k, i);
            }
        }
        let mut owned = items.to_vec();
        go(&mut owned, 0, visit);
    }

    /// The route must be structurally valid however the search is chopped up.
    #[test]
    fn results_are_always_well_formed() {
        for seed in 1..12u32 {
            let n = 40;
            let problem = problem_with(n, seed, Some(15), Some(0), Some(39));
            let cap = problem.cap;
            let (order, _) = solve(problem, seed);

            assert_eq!(order[0], 0);
            assert_eq!(*order.last().unwrap(), 39);
            let mut seen = order.clone();
            seen.sort();
            seen.dedup();
            assert_eq!(seen.len(), order.len(), "seed {seed}: repeated node");
            // Two mandatory endpoints plus at most `cap` optional stops.
            assert!(order.len() <= cap + 2, "seed {seed}: cap exceeded");
        }
    }

    /// Chunk size must not change the answer. The host picks it from wall-clock
    /// measurements, so it varies between devices and between runs on the same
    /// device — if it changed the route, two phones would disagree.
    #[test]
    fn the_answer_does_not_depend_on_the_chunk_size() {
        for seed in 1..8u32 {
            let n = 30;
            let mut results = Vec::new();
            for &chunk in &[1i64, 7, 64, 1000, 100_000] {
                let problem = problem_with(n, seed, None, Some(0), None);
                let mut driver = Driver::new(problem, seed, None);
                for _ in 0..1_000_000 {
                    if driver.step(chunk) {
                        break;
                    }
                }
                results.push((chunk, driver.best().to_vec(), driver.best_objective()));
            }
            let (_, first_order, first_objective) = &results[0];
            for (chunk, order, objective) in &results[1..] {
                assert_eq!(
                    objective, first_objective,
                    "seed {seed}: chunk {chunk} scored differently"
                );
                assert_eq!(order, first_order, "seed {seed}: chunk {chunk} routed differently");
            }
        }
    }

    /// Stopping early must still yield a usable route — that is what happens
    /// every time a user cancels, and every time the budget runs out.
    #[test]
    fn a_partial_run_still_returns_a_valid_route() {
        let n = 60;
        let problem = problem_with(n, 5, None, Some(0), Some(59));
        let mut driver = Driver::new(problem, 5, None);

        // One single small step: barely past construction.
        driver.step(8);
        let order = driver.best().to_vec();
        assert!(!order.is_empty(), "no route after the first step");
        assert_eq!(order[0], 0);
        assert_eq!(*order.last().unwrap(), 59);
        assert_eq!(order.len(), n, "visit-all instance must be complete");
    }

    #[test]
    fn improves_monotonically() {
        let n = 50;
        let problem = problem_with(n, 9, None, None, None);
        let mut driver = Driver::new(problem, 9, None);

        let mut last = i64::MAX;
        for _ in 0..5000 {
            let finished = driver.step(32);
            let objective = driver.best_objective();
            assert!(objective <= last, "best objective went up: {last} -> {objective}");
            last = objective;
            if finished {
                break;
            }
        }
        assert!(last < i64::MAX, "never produced a route");
    }
}
