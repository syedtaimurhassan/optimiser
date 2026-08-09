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

/// GLS penalty weight, as a fraction of the average arc cost, in parts per
/// thousand.
///
/// The literature's usual range for TSP is 0.1-0.3. Measured here, smaller is
/// strictly better, and by a wide margin — at n = 1000, α = 0.025 finds a route
/// 0.9% cheaper than α = 0.2 does. The reason is that this local search is
/// already strong: with Or-opt, candidate lists and don't-look bits doing the
/// work, a heavy penalty distorts the landscape faster than the descent can
/// exploit it, and the search spends its time chasing an increasingly fictional
/// matrix. A light touch is enough to make a local optimum stop being one.
const GLS_ALPHA_PERMILLE: i64 = 25;

/// A penalty this large has stopped conveying information and is only risking
/// the i32 the augmented matrix is stored in.
const MAX_PENALTY: u16 = 8_000;

/// How hard the time-window penalty is pushed each way.
///
/// ── Why it is adaptive at all ─────────────────────────────────────────────
///
/// A fixed coefficient cannot work, because it has to convert SECONDS OF
/// LATENESS into the units the objective is measured in — and those are seconds
/// on one route and metres on another, differing by three orders of magnitude.
/// Worse, the right value depends on the instance: too low and the search
/// settles into a comfortable late route; too high and it behaves like a
/// feasibility-preserving search, which is the exact failure the time-warp
/// relaxation exists to avoid.
///
/// So it hunts. Infeasible local optimum → push up; feasible → let it decay, so
/// the search drifts back towards the boundary and keeps exploring routes that
/// are briefly late on the way to being good. 5/4 and 4/5 are deliberately
/// gentle: the penalty should move over tens of iterations, not two.
const TW_PENALTY_UP: (i64, i64) = (5, 4);
const TW_PENALTY_DOWN: (i64, i64) = (4, 5);

/// Ceiling on the time-window penalty.
///
/// Chosen so the objective cannot overflow rather than for search reasons: warp
/// is bounded by roughly n × a day ≈ 10⁸ seconds, and 10⁹ × 10⁸ is 10¹⁷, an
/// order of magnitude inside i64. A penalty at this ceiling has long since
/// stopped conveying information anyway.
const MAX_TW_PENALTY: i64 = 1_000_000_000;

/// GLS has no natural stopping point, so it needs one.
///
/// Deliberately huge. A GLS iteration is a two-node wake and a short descent,
/// so they run at six figures per second — at 20x patience the search was
/// declaring itself finished after 148 ms of a 1 s budget and losing to ILS
/// while doing it. The only job this constant has is making sure a five-stop
/// route does not sit out the whole clock; on anything larger the host's
/// deadline should be what stops the search.
const GLS_PATIENCE_FACTOR: u32 = 500;

/// How the driver escapes a local optimum.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Strategy {
    /// Perturb the ROUTE: double bridge, ruin-and-recreate, restarts.
    Ils,
    /// Perturb the LANDSCAPE: raise the price of arcs the search keeps choosing,
    /// so the same local optimum stops being one.
    Gls,
    /// ILS until it gives up, then GLS with whatever budget is left.
    ///
    /// Neither is better than the other everywhere, and the measurements say so
    /// plainly: ILS wins at n = 300, GLS wins at n = 1000, and at n = 100 ILS
    /// finds its answer in a third of a second and then stops with two thirds of
    /// the budget unspent. That unspent time is the whole opportunity here —
    /// ILS's own barren-restart rule is a reliable signal that route
    /// perturbation has nothing left to offer, and it is exactly the moment
    /// changing the landscape instead becomes worth trying.
    IlsThenGls,
}

/// Guided local search state.
///
/// ── Why the penalty lives inside the matrix ───────────────────────────────
///
/// The textbook formulation evaluates an augmented cost g(i,j) = d(i,j) +
/// λ·p(i,j) at every lookup. Done literally that is a second random read on the
/// hottest path in the crate, roughly doubling its memory traffic.
///
/// Instead the penalty is folded into the matrix when it changes — a handful of
/// cells per iteration — so the local search reads one array and never knows
/// GLS is happening. `d` is recovered where it is actually needed (scoring a
/// finished route, O(n) once per local optimum) by subtracting λ·p back off.
struct Gls {
    /// Times each directed arc has been penalised. Directed, because on an
    /// asymmetric matrix `i → j` and `j → i` are different features.
    penalty: Vec<u16>,
    lambda: i64,
}

impl Gls {
    fn new(n: usize) -> Self {
        Gls {
            penalty: vec![0u16; n * n],
            lambda: 0,
        }
    }
}

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

    /*
      ── Two bests, because "cheapest" and "on time" are different questions ──

      `best_feasible` is the cheapest route that meets EVERY window. If one
      exists it is what the driver returns, always — handing back a cheaper late
      route when an on-time one was found would be answering a question nobody
      asked.

      `best` is the fallback: the least-late route, and among equally late ones
      the cheapest. It is what a genuinely over-constrained day gets, and the
      host reports its lateness rather than hiding it.

      With no windows the warp is always zero, `best_feasible` is the only one
      that ever fills, and the behaviour is exactly M10's.
    */
    best: Vec<i32>,
    best_objective: i64,
    /// Lateness of the route in `best`. Zero whenever windows do not bind.
    best_warp: i64,
    best_feasible: Vec<i32>,
    best_feasible_objective: i64,

    current_objective: i64,
    /// What a second of lateness currently costs, in arc units. See `adapt`.
    tw_penalty: i64,

    phase: Phase,
    strategy: Strategy,
    gls: Option<Gls>,
    iterations: u32,
    since_improvement: u32,
    barren_restarts: u32,
    patience: u32,
    /// Zero unless the cap binds — see `settle_ils`.
    drift_permille: i64,
}

impl Driver {
    pub fn new(problem: Problem, seed: u32, seed_order: Option<Vec<i32>>) -> Self {
        Driver::with_strategy(problem, seed, seed_order, Strategy::Ils)
    }

    pub fn with_strategy(
        problem: Problem,
        seed: u32,
        seed_order: Option<Vec<i32>>,
        strategy: Strategy,
    ) -> Self {
        let n = problem.n();
        Driver {
            tour: Tour::new(n),
            search: LocalSearch::new(n),
            rng: Rng::new(seed),
            seed_order,
            best: Vec::new(),
            best_objective: i64::MAX,
            best_warp: i64::MAX,
            best_feasible: Vec::new(),
            best_feasible_objective: i64::MAX,
            current_objective: i64::MAX,
            tw_penalty: 0,
            phase: Phase::Construct,
            strategy,
            // The penalty array is n² u16 — 2 MB at n = 1000 — so it is only
            // allocated when it will actually be used.
            // n² u16 is 2 MB at n = 1000, so it waits until it is needed —
            // which for IlsThenGls may be never.
            gls: match strategy {
                Strategy::Gls => Some(Gls::new(n)),
                Strategy::Ils | Strategy::IlsThenGls => None,
            },
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
                    /*
                      Seed the time-window penalty from the instance's own scale.

                      One second of lateness starts out costing about one average
                      arc, which is the only starting point that means the same
                      thing whether the matrix holds seconds or metres. A fixed
                      constant would be invisible on one instance and
                      overwhelming on the other; `adapt` takes it from here.

                      Construction runs twice for this: once unpenalised to learn
                      the scale, then again with the penalty in hand, because a
                      first route built with no regard for the clock can be so
                      late that the descent spends its whole budget climbing out.
                    */
                    if self.problem.windows_bind() && self.tw_penalty == 0 {
                        construct(&self.problem, &mut self.tour, self.seed_order.as_deref(), 0);
                        let arcs = (self.tour.len.saturating_sub(1)).max(1) as i64;
                        self.tw_penalty = (self.tour.cost() / arcs).max(1);
                        self.search.set_tw_penalty(self.tw_penalty);
                    }
                    construct(
                        &self.problem,
                        &mut self.tour,
                        self.seed_order.as_deref(),
                        self.tw_penalty,
                    );

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
                    self.record_best();
                    self.current_objective = self.penalised();

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
                            match self.strategy {
                                Strategy::Ils | Strategy::IlsThenGls => {
                                    self.settle_ils();
                                    if self.phase == Phase::Done {
                                        return true;
                                    }
                                    // `settle_ils` may have just switched us over.
                                    if self.strategy == Strategy::Gls {
                                        continue;
                                    }
                                    self.perturb();
                                    self.search.reset(&self.problem, &self.tour);
                                }
                                Strategy::Gls => {
                                    self.settle_gls();
                                    if self.phase == Phase::Done {
                                        return true;
                                    }
                                }
                            }
                            budget -= self.problem.n() as i64;
                        }
                    }
                }
                Phase::Done => return true,
            }
        }
        false
    }

    /// What an arc really costs, with any GLS penalty taken back off.
    #[inline]
    fn true_arc(&self, a: usize, b: usize) -> i64 {
        let augmented = i64::from(self.problem.matrix.at(a, b));
        match &self.gls {
            Some(gls) => {
                augmented - gls.lambda * i64::from(gls.penalty[a * self.problem.n() + b])
            }
            None => augmented,
        }
    }

    /// The route's real objective: true arcs plus a penalty per optional node
    /// left out.
    ///
    /// Under ILS this is exactly `tour.objective()`. Under GLS it is not, and
    /// the difference is the whole reason it exists — the search is minimising a
    /// deliberately distorted landscape, and `best` must be judged on the real
    /// one or the engine would return whichever route the penalties currently
    /// happen to flatter.
    fn true_objective(&self) -> i64 {
        let mut sum = 0i64;
        for t in 0..self.tour.len.saturating_sub(1) {
            sum += self.true_arc(self.tour.order[t] as usize, self.tour.order[t + 1] as usize);
        }
        let mut skipped = 0i64;
        for node in 0..self.problem.n() {
            if self.problem.is_optional(node) && self.tour.pos[node] < 0 {
                skipped += 1;
            }
        }
        sum + self.problem.skip_penalty * skipped
    }

    /// The route's lateness, in seconds. Zero when no window can be missed.
    #[inline]
    fn warp(&self) -> i64 {
        self.tour.time_warp(&self.problem)
    }

    /// What the SEARCH compares: the real objective plus the current price of
    /// being late.
    ///
    /// Not comparable across iterations once `adapt` has moved the penalty,
    /// which is exactly why `best` and `best_feasible` are judged on their own
    /// unpenalised terms instead.
    fn penalised(&self) -> i64 {
        self.true_objective() + self.tw_penalty.saturating_mul(self.warp())
    }

    /// Adopt the current route if it is genuinely the best seen. Shared by both
    /// strategies, and the only place `best` is ever written after construction.
    ///
    /// Two bests, judged on two criteria that never move:
    ///   - feasible routes compete on cost alone;
    ///   - everything else competes on lateness first and cost second.
    /// Neither uses the adaptive penalty, so a route recorded early is still
    /// comparable with one recorded a thousand iterations later.
    fn record_best(&mut self) -> bool {
        let objective = self.true_objective();
        let warp = self.warp();
        let mut improved = false;

        if warp == 0 && objective < self.best_feasible_objective {
            self.best_feasible_objective = objective;
            self.best_feasible = self.tour.snapshot();
            improved = true;
        }
        if (warp, objective) < (self.best_warp, self.best_objective) {
            self.best_warp = warp;
            self.best_objective = objective;
            self.best = self.tour.snapshot();
            improved = true;
        }
        improved
    }

    /// Move the price of lateness towards the feasibility boundary.
    ///
    /// Called at every local optimum, with that optimum's own lateness rather
    /// than the best-so-far — the penalty is steering the SEARCH, and where the
    /// search currently is, is the only thing it can steer.
    fn adapt(&mut self, warp: i64) {
        if !self.problem.windows_bind() {
            return;
        }
        let (up_n, up_d) = TW_PENALTY_UP;
        let (down_n, down_d) = TW_PENALTY_DOWN;
        self.tw_penalty = if warp > 0 {
            ((self.tw_penalty * up_n) / up_d + 1).min(MAX_TW_PENALTY)
        } else {
            ((self.tw_penalty * down_n) / down_d).max(1)
        };
        self.search.set_tw_penalty(self.tw_penalty);
    }

    // ────────────────────────────────────────────────── guided local search

    /// A GLS descent has converged: score it, then make this local optimum a
    /// worse place to be.
    fn settle_gls(&mut self) {
        self.iterations += 1;
        let warp = self.warp();
        if self.record_best() {
            self.since_improvement = 0;
        } else {
            self.since_improvement += 1;
        }
        self.adapt(warp);

        // GLS has no natural end — every local optimum can be penalised again —
        // so without this a five-stop route would sit there burning the full
        // budget on a problem it solved in the first millisecond.
        if self.since_improvement >= self.patience.saturating_mul(GLS_PATIENCE_FACTOR) {
            self.phase = Phase::Done;
            return;
        }

        self.penalise();
    }

    /// Raise the price of the arcs this local optimum leans on hardest.
    ///
    /// Utility is `d(i,j) / (1 + p(i,j))` — long arcs are the ones worth
    /// discouraging, and dividing by the penalty already applied stops the
    /// search from hammering the same arc forever. Every arc achieving the
    /// maximum is penalised, which is the standard formulation.
    fn penalise(&mut self) {
        if self.tour.len < 2 {
            return;
        }

        // λ is set once, from the first local optimum, as a fraction of the
        // average arc cost. Fixing it in advance is impossible: these matrices
        // are seconds on one route and metres on another, and a λ that is
        // meaningful for one is either invisible or overwhelming for the other.
        if let Some(gls) = &self.gls {
            if gls.lambda == 0 {
                let arcs = (self.tour.len - 1).max(1) as i64;
                let mut total = 0i64;
                for t in 0..self.tour.len - 1 {
                    total += self
                        .true_arc(self.tour.order[t] as usize, self.tour.order[t + 1] as usize);
                }
                let lambda = ((total * GLS_ALPHA_PERMILLE) / 1000 / arcs).max(1);
                if let Some(gls) = &mut self.gls {
                    gls.lambda = lambda;
                }
            }
        }

        let n = self.problem.n();
        let mut best_utility = f64::NEG_INFINITY;
        let mut chosen: Vec<(usize, usize)> = Vec::new();

        for t in 0..self.tour.len - 1 {
            let a = self.tour.order[t] as usize;
            let b = self.tour.order[t + 1] as usize;
            let penalty = self.gls.as_ref().map_or(0, |g| g.penalty[a * n + b]);
            if penalty >= MAX_PENALTY {
                continue;
            }
            let utility = self.true_arc(a, b) as f64 / (1.0 + f64::from(penalty));
            if utility > best_utility + 1e-9 {
                best_utility = utility;
                chosen.clear();
                chosen.push((a, b));
            } else if (utility - best_utility).abs() <= 1e-9 {
                chosen.push((a, b));
            }
        }

        let lambda = self.gls.as_ref().map_or(0, |g| g.lambda);
        for (a, b) in chosen {
            if let Some(gls) = &mut self.gls {
                gls.penalty[a * n + b] = gls.penalty[a * n + b].saturating_add(1);
            }
            // The matrix already holds d + λ·p_old, so one λ makes it p_old + 1.
            // Folding it in here is what keeps the inner loop at a single read.
            self.problem
                .matrix
                .add_at(a, b, lambda.clamp(0, i64::from(i32::MAX)) as i32);
            self.search.wake_external(&self.tour, a);
            self.search.wake_external(&self.tour, b);
        }

        // The prefix sums are sums of matrix cells, and cells just changed.
        self.tour.refresh(&self.problem);
    }

    /// A descent has converged. Judge it, and decide whether to carry on.
    fn settle_ils(&mut self) {
        // The PENALISED objective, so a route that is cheap only because it is
        // late does not look like an improvement. `record_best` still judges
        // what to keep on unpenalised terms.
        let objective = self.penalised();
        let warp = self.warp();
        self.iterations += 1;

        if self.record_best() {
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
            // Recomputed rather than reused: `best_objective` is unpenalised so
            // that it stays comparable across iterations, and `current_objective`
            // is penalised so that the drift test above compares like with like.
            self.current_objective = self.penalised();
        }

        self.adapt(warp);

        if self.barren_restarts >= BARREN_RESTARTS {
            if self.strategy == Strategy::IlsThenGls {
                // ILS is out of ideas. Hand the rest of the budget to a
                // different landscape rather than to the wall clock, starting
                // from the best route ILS managed to find.
                let best = std::mem::take(&mut self.best);
                self.tour.restore(&self.problem, &best);
                self.best = best;
                self.strategy = Strategy::Gls;
                self.gls = Some(Gls::new(self.problem.n()));
                self.since_improvement = 0;
                self.search.reset(&self.problem, &self.tour);
            } else {
                self.phase = Phase::Done;
            }
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
            restart(&self.problem, &mut self.tour, &mut self.rng, self.tw_penalty);
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
        // Confined to the unpinned middle. Reaching into the first or last block
        // would move a stop the driver explicitly placed there, and the local
        // search — which respects the zones — could not put it back.
        let Some((mid_lo, mid_hi)) = self.tour.middle(&self.problem) else {
            return false;
        };
        let a_min = mid_lo.max(1);
        let c_max = mid_hi + 1;
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
            let placed = self.tour.best_insertion(&self.problem, seed, self.tw_penalty);
            self.tour.insert_at(&self.problem, seed, placed.at);
        }

        greedy_refill(&self.problem, &mut self.tour, self.tw_penalty);
    }

    // ────────────────────────────────────────────────────────── reporting

    /// The answer: on time if we ever found one, least-late otherwise.
    pub fn best(&self) -> &[i32] {
        if self.best_feasible.is_empty() {
            &self.best
        } else {
            &self.best_feasible
        }
    }

    pub fn best_objective(&self) -> i64 {
        if self.best_feasible.is_empty() {
            self.best_objective
        } else {
            self.best_feasible_objective
        }
    }

    /// Lateness of the route `best()` returns, in seconds. Zero when it is on
    /// time, which is also the only value a problem without windows can report.
    pub fn best_time_warp(&self) -> i64 {
        if self.best_feasible.is_empty() {
            if self.best_warp == i64::MAX {
                0
            } else {
                self.best_warp
            }
        } else {
            0
        }
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
    use crate::problem::{PIN_AUTO, PIN_FIRST, PIN_LAST};

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
        solve_with(problem, seed, Strategy::Ils)
    }

    fn solve_with(problem: Problem, seed: u32, strategy: Strategy) -> (Vec<i32>, i64) {
        let mut driver = Driver::with_strategy(problem, seed, None, strategy);
        for _ in 0..200_000 {
            if driver.step(64) {
                break;
            }
        }
        (driver.best().to_vec(), driver.best_objective())
    }

    /// Recompute a route's cost from the ORIGINAL matrix.
    ///
    /// Built before the driver runs, because GLS mutates the matrix in place —
    /// this is the only way to check that what the engine reports is what the
    /// route actually costs rather than what the penalties made it look like.
    fn scorer(problem: &Problem) -> impl Fn(&[i32]) -> i64 {
        let n = problem.n();
        let mut cells = vec![0i32; n * n];
        for i in 0..n {
            for j in 0..n {
                cells[i * n + j] = problem.matrix.at(i, j);
            }
        }
        move |order: &[i32]| {
            let mut sum = 0i64;
            for w in order.windows(2) {
                sum += i64::from(cells[w[0] as usize * n + w[1] as usize]);
            }
            sum
        }
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

    /// GLS distorts the matrix it searches. The objective it REPORTS must still
    /// be the real cost of the route it returns — otherwise the engine is
    /// grading itself against a landscape it invented, and the number that
    /// reaches the user is fiction.
    #[test]
    fn gls_reports_the_true_cost_of_the_route_it_returns() {
        for seed in 1..10u32 {
            let n = 40;
            let problem = problem_with(n, seed, None, Some(0), Some(n - 1));
            let score = scorer(&problem);
            let (order, objective) = solve_with(problem, seed, Strategy::Gls);
            assert_eq!(
                objective,
                score(&order),
                "seed {seed}: reported {objective}, the route really costs {}",
                score(&order)
            );
        }
    }

    #[test]
    fn gls_finds_the_optimum_on_small_instances() {
        for n in 6..=8usize {
            for seed in 1..=10u32 {
                let problem = problem_with(n, seed, None, Some(0), Some(n - 1));
                let matrix_n = problem.n();
                let score = scorer(&problem);

                let interior: Vec<i32> = (1..n as i32 - 1).collect();
                let mut best = i64::MAX;
                permute(&interior, &mut |perm: &[i32]| {
                    let mut order = vec![0i32];
                    order.extend_from_slice(perm);
                    order.push(matrix_n as i32 - 1);
                    best = best.min(score(&order));
                });

                let (_, objective) = solve_with(problem, seed, Strategy::Gls);
                assert_eq!(objective, best, "n={n} seed={seed}: GLS missed the optimum");
            }
        }
    }

    #[test]
    fn gls_respects_the_cap_and_the_pins() {
        for seed in 1..8u32 {
            let n = 40;
            let problem = problem_with(n, seed, Some(12), Some(0), Some(39));
            let (order, _) = solve_with(problem, seed, Strategy::Gls);
            assert_eq!(order[0], 0);
            assert_eq!(*order.last().unwrap(), 39);
            assert_eq!(order.len(), 14, "seed {seed}: two pins plus twelve stops");
            let mut seen = order.clone();
            seen.sort();
            seen.dedup();
            assert_eq!(seen.len(), order.len());
        }
    }

    /// The hybrid must actually change over, and must never return a route
    /// worse than the ILS phase had already found.
    #[test]
    fn the_hybrid_hands_over_to_gls_without_losing_ground() {
        for seed in 1..8u32 {
            let n = 25;
            let problem = problem_with(n, seed, None, Some(0), Some(n - 1));
            let score = scorer(&problem);

            let mut driver = Driver::with_strategy(problem, seed, None, Strategy::IlsThenGls);
            // Run until ILS gives up and the switch happens.
            let mut switched = false;
            for _ in 0..200_000 {
                let finished = driver.step(64);
                if driver.strategy == Strategy::Gls {
                    switched = true;
                }
                if finished {
                    break;
                }
            }
            assert!(switched, "seed {seed}: never handed over to GLS");

            let order = driver.best().to_vec();
            assert_eq!(
                driver.best_objective(),
                score(&order),
                "seed {seed}: reported cost is not the route's real cost"
            );

            let (_, ils_only) = solve_with(
                problem_with(n, seed, None, Some(0), Some(n - 1)),
                seed,
                Strategy::Ils,
            );
            assert!(
                driver.best_objective() <= ils_only,
                "seed {seed}: the hybrid ({}) is worse than ILS alone ({ils_only})",
                driver.best_objective()
            );
        }
    }

    /// GLS must stop on its own for a route it has clearly finished, or a
    /// three-stop delivery would sit burning a five-second budget.
    #[test]
    fn gls_terminates_on_a_tiny_instance() {
        let problem = problem_with(6, 3, None, Some(0), Some(5));
        let mut driver = Driver::with_strategy(problem, 3, None, Strategy::Gls);
        let mut steps = 0;
        while !driver.step(64) {
            steps += 1;
            assert!(steps < 100_000, "GLS never declared itself finished");
        }
    }

    /// First and Last must hold through a complete search, not merely through
    /// construction.
    ///
    /// The pins are enforced in candidate generation, so a bug here does not
    /// produce an error — it produces a route that quietly ignores the driver.
    /// Several stops are pinned each way on purpose: one is the easy case, and a
    /// BLOCK is where an off-by-one in the zone boundaries shows up.
    #[test]
    fn first_and_last_blocks_survive_the_whole_search() {
        for seed in 1..8u32 {
            let n = 24;
            let mut rng = Rng::new(seed);
            let mut cells = vec![0i32; n * n];
            for i in 0..n {
                for j in 0..n {
                    if i != j {
                        cells[i * n + j] = 1 + (rng.next_f64() * 10_000.0) as i32;
                    }
                }
            }
            // Nodes 1 and 2 first, 20 and 21 last, 0 and 23 the depots.
            let mut pin = vec![PIN_AUTO; n];
            pin[1] = PIN_FIRST;
            pin[2] = PIN_FIRST;
            pin[20] = PIN_LAST;
            pin[21] = PIN_LAST;
            let mut optional = vec![1u8; n];
            optional[0] = 0;
            optional[n - 1] = 0;

            let problem = Problem::build(
                Matrix::new(n, cells),
                optional,
                None,
                10_000_000,
                Some(0),
                Some(n - 1),
                None,
                pin.clone(),
            );
            let (order, _) = solve(problem, seed);

            assert_eq!(order[0], 0, "seed {seed}: start moved");
            assert_eq!(*order.last().unwrap(), (n - 1) as i32, "seed {seed}: end moved");

            let classes: Vec<u8> = order.iter().map(|&node| pin[node as usize]).collect();
            // Positions 1 and 2 are the first block, in some order; 22 and 23
            // counting from the end are the last block.
            assert_eq!(
                &classes[1..3],
                &[PIN_FIRST, PIN_FIRST],
                "seed {seed}: the first block is not at the front ({order:?})"
            );
            let tail = classes.len() - 3;
            assert_eq!(
                &classes[tail..classes.len() - 1],
                &[PIN_LAST, PIN_LAST],
                "seed {seed}: the last block is not at the back ({order:?})"
            );
            assert!(
                classes[3..tail].iter().all(|&c| c == PIN_AUTO),
                "seed {seed}: a pinned stop escaped into the middle ({order:?})"
            );

            let mut seen = order.clone();
            seen.sort();
            seen.dedup();
            assert_eq!(seen.len(), order.len(), "seed {seed}: repeated node");
        }
    }

    /// A pinned stop is mandatory even when the caller marked it optional and
    /// the cap would otherwise have removed it. Without this the K cap can
    /// silently delete an ordering constraint.
    #[test]
    fn pinning_a_stop_makes_it_mandatory() {
        let n = 20;
        let mut cells = vec![0i32; n * n];
        let mut rng = Rng::new(3);
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    cells[i * n + j] = 1 + (rng.next_f64() * 10_000.0) as i32;
                }
            }
        }
        let mut pin = vec![PIN_AUTO; n];
        pin[5] = PIN_FIRST;
        pin[6] = PIN_LAST;

        let problem = Problem::build(
            Matrix::new(n, cells),
            // Everything optional, including the two pinned stops.
            vec![1u8; n],
            Some(4),
            10_000_000,
            None,
            None,
            None,
            pin,
        );
        assert!(!problem.is_optional(5));
        assert!(!problem.is_optional(6));

        let (order, _) = solve(problem, 3);
        assert_eq!(order[0], 5, "the first-pinned stop is missing or misplaced");
        assert_eq!(*order.last().unwrap(), 6, "the last-pinned stop is missing or misplaced");
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
