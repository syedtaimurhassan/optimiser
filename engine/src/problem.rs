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
        assert_eq!(optional.len(), matrix.n, "one optional flag per node");
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
}
