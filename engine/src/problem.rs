//! The question, as opposed to the answer.
//!
//! Everything here is fixed for the duration of a solve: the cost grid, the
//! candidate lists derived from it, which nodes may be skipped, how many of them
//! may be visited, and what skipping one costs. `Tour` holds the parts that
//! change.
//!
//! The split exists so the borrow checker can express what is actually true —
//! the local search takes `&Problem` and `&mut Tour`, and it is a compile error
//! for a move to modify the question it is being asked.

use crate::matrix::{Candidates, Matrix};
use crate::tour::{DurationSegment, NEVER};

/// Everything the schedule needs, and nothing the objective does.
///
/// ── Why the travel TIME is a second matrix ────────────────────────────────
///
/// The engine's cost matrix is whichever one the objective is measured in, and
/// on a distance objective that is metres. Metres cannot be added to a clock, so
/// a schedule needs seconds separately.
///
/// It is a separate matrix even when the objective IS duration and the two hold
/// the same numbers, and that redundancy is deliberate: guided local search
/// MUTATES the cost matrix in place, folding its arc penalties into the cells so
/// the inner loop stays at one memory read. A schedule computed from that matrix
/// would drift further from the truth with every penalty applied, and would do
/// it silently — the route would still look feasible while its arrival times
/// quietly became fiction. `time` is never written to.
///
/// Four megabytes at n = 1000, and only when the route has a window to miss.
pub struct TimeData {
    /// Travel SECONDS. Never mutated, unlike `Problem::matrix`.
    pub time: Matrix,
    /// Seconds spent at each node.
    pub service: Vec<i64>,
    /// Seconds from midnight. 0 when unconstrained.
    pub tw_open: Vec<i64>,
    /// Seconds from midnight. `NEVER` when unconstrained.
    pub tw_close: Vec<i64>,
    /// When the driver leaves, as a pinned instant.
    pub depart: DurationSegment,
    /// True when at least one node can actually be missed.
    binding: bool,
}

impl TimeData {
    pub fn new(
        time: Matrix,
        service: Vec<i64>,
        tw_open: Vec<i64>,
        tw_close: Vec<i64>,
        depart_at: i64,
    ) -> Self {
        let n = time.n;
        assert_eq!(service.len(), n, "one service time per node");
        assert_eq!(tw_open.len(), n, "one window open per node");
        assert_eq!(tw_close.len(), n, "one window close per node");
        /*
          Only a CLOSING time can make a route infeasible.

          An opening time makes the driver wait, and waiting costs nothing the
          objective measures — the objective is arcs, and waiting adds no arcs.
          A service time is likewise constant over a fixed set of stops. So
          neither can change which ordering is best, and building labels for a
          route that has only those is work with no possible effect on the
          answer. A closing time is the one thing a bad order can violate.

          This is what keeps the no-windows case exactly as fast as M10's: the
          flag is false, no labels are built, and the search never calls into
          the segment tree at all.
        */
        let binding = tw_close.iter().any(|&close| close < NEVER);
        TimeData {
            time,
            service,
            tw_open,
            tw_close,
            depart: DurationSegment::departure(depart_at),
            binding,
        }
    }

    /// The label of one node on its own.
    #[inline]
    pub fn leaf(&self, node: usize) -> DurationSegment {
        DurationSegment::node(self.service[node], self.tw_open[node], self.tw_close[node])
    }

    #[inline(always)]
    pub fn travel(&self, from: usize, to: usize) -> i64 {
        i64::from(self.time.at(from, to))
    }
}

/// Penalty for leaving an optional node unvisited.
///
/// Mirrors `SKIP_PENALTY` in `solverPort.ts`, and is passed in rather than
/// hard-coded here so the two can never drift: it is part of the question, and
/// two engines that disagree about it are not comparable.
pub struct Problem {
    pub matrix: Matrix,
    pub candidates: Candidates,
    /// 1 where the node may be skipped. Pinned endpoints are already forced to 0
    /// by the caller — see `effectiveOptional` in `solverPort.ts`, which is the
    /// single place that reconciliation happens.
    pub optional: Vec<u8>,
    /// How many optional nodes may be visited. Equal to the number of optional
    /// nodes when K does not bind.
    pub cap: usize,
    pub skip_penalty: i64,
    pub start: Option<usize>,
    pub end: Option<usize>,
    /// Present only when the caller has a schedule to honour. See `TimeData`.
    pub time: Option<TimeData>,
}

impl Problem {
    pub fn new(
        matrix: Matrix,
        optional: Vec<u8>,
        select_k: Option<usize>,
        skip_penalty: i64,
        start: Option<usize>,
        end: Option<usize>,
    ) -> Self {
        Problem::with_time(matrix, optional, select_k, skip_penalty, start, end, None)
    }

    /// The same problem, with a schedule attached.
    ///
    /// A separate constructor rather than an extra argument on `new`, because
    /// the overwhelming majority of call sites — every test of the geometry, and
    /// every solve from a driver who has set no windows — have no schedule, and
    /// threading a `None` through all of them would say nothing.
    #[allow(clippy::too_many_arguments)]
    pub fn with_time(
        matrix: Matrix,
        optional: Vec<u8>,
        select_k: Option<usize>,
        skip_penalty: i64,
        start: Option<usize>,
        end: Option<usize>,
        time: Option<TimeData>,
    ) -> Self {
        assert_eq!(optional.len(), matrix.n, "one optional flag per node");
        if let Some(time) = &time {
            assert_eq!(time.time.n, matrix.n, "the time matrix must match the cost matrix");
        }
        let candidates = Candidates::build(&matrix);
        let optional_count = optional.iter().filter(|&&o| o == 1).count();
        // A K larger than the number of optional nodes is clamped rather than
        // rejected: "visit up to 50" of 12 stops is a coherent thing to ask.
        let cap = select_k.unwrap_or(optional_count).min(optional_count);
        Problem {
            matrix,
            candidates,
            optional,
            cap,
            skip_penalty,
            start,
            end,
            time,
        }
    }

    #[inline(always)]
    pub fn n(&self) -> usize {
        self.matrix.n
    }

    #[inline(always)]
    pub fn is_optional(&self, node: usize) -> bool {
        self.optional[node] == 1
    }

    /// True when some node can actually be arrived at too late.
    ///
    /// The switch for every piece of scheduling machinery in the engine. False
    /// is the common case and must stay free: no labels, no segment tree, no
    /// second matrix read, and a search identical to the one M10 shipped.
    #[inline(always)]
    pub fn windows_bind(&self) -> bool {
        matches!(&self.time, Some(time) if time.binding)
    }
}
