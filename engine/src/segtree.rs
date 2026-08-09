//! Labels for arbitrary interior subsequences, forwards and backwards, in
//! O(log n).
//!
//! ── Why this file exists, and why it is not a prefix array ────────────────
//!
//! The milestone brief asked for prefix and suffix labels over forward and
//! reverse subsequences so that 2-opt — which reverses a segment — stays O(1).
//! Prefix and suffix labels do exist, on `Tour`, and they answer "everything
//! before position t" and "everything from position t on" in constant time.
//!
//! Arbitrary INTERIOR ranges cannot be answered that way, and the reason is
//! worth stating plainly, because the analogy with the arc-cost prefix sums is
//! what makes it look possible:
//!
//! ```text
//! cost:  F[j] − F[i]  recovers any interior range, because subtraction
//!                     inverts addition.
//! label: merge has no inverse. It contains max and min, which destroy
//!                     information — given merge(a, b) and a you cannot
//!                     recover b.
//! ```
//!
//! So there is no pair of prefix/suffix arrays from which `label(i..=j)` can be
//! extracted for arbitrary i and j, in either direction. What merge IS, is
//! associative — proved in `tour::tests::duration_segment_merge_is_associative` —
//! and associativity is exactly the property a segment tree needs.
//!
//! Hence: a segment tree over tour POSITIONS, each node holding TWO labels for
//! its range, one per direction of travel. Any interior range is then a disjoint
//! decomposition into O(log n) nodes, merged in the direction asked for.
//!
//! Both directions are needed and neither is redundant:
//!   - 2-opt reverses `i..=j`, so it wants the range BACKWARDS;
//!   - Or-opt lifts a short segment out and drops it elsewhere, which leaves an
//!     interior stretch of the original route between the hole and the gap —
//!     that stretch is traversed FORWARDS.
//! Storing both in one node means one traversal builds them together and the
//! two can never disagree about the tour they describe.
//!
//! ── What it costs ─────────────────────────────────────────────────────────
//!
//! Build is O(n) and happens on an accepted move, which is exactly when the
//! prefix sums are already being rebuilt — so the asymptotics of `Tour::refresh`
//! do not change, only its constant. A query is O(log n) rather than O(1), which
//! makes a move evaluation about ten merges instead of one at n = 1000.
//!
//! That cost is paid ONLY when some node has a closing time. With no windows no
//! labels are built, nothing here is called, and the search is exactly the one
//! M10 measured. A driver with no windows must not pay for a feature they are
//! not using.
//!
//! ── Rebuilt whole, not updated ────────────────────────────────────────────
//!
//! A move permutes positions, so every label from the leftmost touched position
//! onwards changes. Point updates would mean O(k log n) for k moved positions
//! and a great deal of care about which; a full O(n) rebuild is simpler, is what
//! the prefix sums already do, and at n = 1000 is a few thousand merges against
//! a descent that is doing millions.

use crate::tour::DurationSegment;

/// Both directions of one range.
#[derive(Clone, Copy)]
struct Both {
    forward: DurationSegment,
    reversed: DurationSegment,
}

/// One piece of a query, and the positions it covers.
///
/// The range travels with the label because merging two pieces needs the arc
/// BETWEEN them, and only their positions identify it.
#[derive(Clone, Copy)]
struct Piece {
    label: DurationSegment,
    lo: usize,
    hi: usize,
}

pub struct RangeLabels {
    /// Heap-ordered, 1-based: node `k` has children `2k` and `2k+1`.
    nodes: Vec<Both>,
    /// Positions currently covered, i.e. the tour's length.
    len: usize,
}

const EMPTY_BOTH: Both = Both {
    forward: DurationSegment::EMPTY,
    reversed: DurationSegment::EMPTY,
};

impl RangeLabels {
    pub fn new(capacity: usize) -> Self {
        RangeLabels {
            // 4n is the standard safe bound for a recursive segment tree over
            // an arbitrary n, and avoids rounding the capacity up to a power of
            // two — which at n = 1001 would nearly double the allocation.
            nodes: vec![EMPTY_BOTH; 4 * capacity.max(1)],
            len: 0,
        }
    }

    /// Rebuild over the first `len` positions.
    ///
    /// `leaf` supplies a position's own label (its service time and window), and
    /// `edge` the travel time from one position's occupant to another's. Both
    /// are closures, so this module needs to know nothing about the matrix, the
    /// problem, or what a node is.
    pub fn build(
        &mut self,
        len: usize,
        leaf: impl Fn(usize) -> DurationSegment,
        edge: impl Fn(usize, usize) -> i64,
    ) {
        self.len = len;
        if len == 0 {
            return;
        }
        let needed = 4 * len;
        if self.nodes.len() < needed {
            self.nodes.resize(needed, EMPTY_BOTH);
        }
        self.build_at(1, 0, len - 1, &leaf, &edge);
    }

    fn build_at(
        &mut self,
        node: usize,
        lo: usize,
        hi: usize,
        leaf: &impl Fn(usize) -> DurationSegment,
        edge: &impl Fn(usize, usize) -> i64,
    ) {
        if lo == hi {
            let label = leaf(lo);
            self.nodes[node] = Both {
                forward: label,
                reversed: label,
            };
            return;
        }
        let mid = lo + (hi - lo) / 2;
        self.build_at(node * 2, lo, mid, leaf, edge);
        self.build_at(node * 2 + 1, mid + 1, hi, leaf, edge);

        let left = self.nodes[node * 2];
        let right = self.nodes[node * 2 + 1];
        self.nodes[node] = Both {
            forward: DurationSegment::merge(edge(mid, mid + 1), &left.forward, &right.forward),
            // Backwards, the right half comes first and the arc between the
            // halves runs from position mid+1 back to position mid.
            reversed: DurationSegment::merge(
                edge(mid + 1, mid),
                &right.reversed,
                &left.reversed,
            ),
        };
    }

    /// Label of `order[i..=j]` travelled from `i` up to `j`.
    pub fn forward(&self, i: usize, j: usize, edge: impl Fn(usize, usize) -> i64) -> DurationSegment {
        self.range(i, j, false, &edge)
    }

    /// Label of `order[i..=j]` travelled from `j` down to `i`.
    pub fn reversed(&self, i: usize, j: usize, edge: impl Fn(usize, usize) -> i64) -> DurationSegment {
        self.range(i, j, true, &edge)
    }

    fn range(
        &self,
        i: usize,
        j: usize,
        reversed: bool,
        edge: &impl Fn(usize, usize) -> i64,
    ) -> DurationSegment {
        debug_assert!(i <= j && j < self.len, "range {i}..={j} outside 0..{}", self.len);
        self.query(1, 0, self.len - 1, i, j, reversed, edge)
            .expect("a non-empty range always decomposes")
            .label
    }

    #[allow(clippy::too_many_arguments)]
    fn query(
        &self,
        node: usize,
        lo: usize,
        hi: usize,
        i: usize,
        j: usize,
        reversed: bool,
        edge: &impl Fn(usize, usize) -> i64,
    ) -> Option<Piece> {
        if j < lo || hi < i {
            return None;
        }
        if i <= lo && hi <= j {
            let both = self.nodes[node];
            return Some(Piece {
                label: if reversed { both.reversed } else { both.forward },
                lo,
                hi,
            });
        }
        let mid = lo + (hi - lo) / 2;
        let left = self.query(node * 2, lo, mid, i, j, reversed, edge);
        let right = self.query(node * 2 + 1, mid + 1, hi, i, j, reversed, edge);
        match (left, right) {
            (Some(left), Some(right)) => Some(Piece {
                label: if reversed {
                    // The right piece first, then the arc from its first
                    // position back to the left piece's last.
                    DurationSegment::merge(edge(right.lo, left.hi), &right.label, &left.label)
                } else {
                    DurationSegment::merge(edge(left.hi, right.lo), &left.label, &right.label)
                },
                lo: left.lo,
                hi: right.hi,
            }),
            (Some(only), None) | (None, Some(only)) => Some(only),
            (None, None) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;
    use crate::tour::NEVER;

    struct Instance {
        service: Vec<i64>,
        open: Vec<i64>,
        close: Vec<i64>,
        time: Vec<i64>,
        n: usize,
    }

    impl Instance {
        fn random(n: usize, seed: u32) -> Self {
            let mut rng = Rng::new(seed);
            let mut time = vec![0i64; n * n];
            for i in 0..n {
                for j in 0..n {
                    if i != j {
                        // Asymmetric, because a symmetric instance would let a
                        // reversal bug pass unnoticed — which is the entire
                        // failure this structure exists to prevent.
                        time[i * n + j] = 1 + (rng.next_f64() * 100.0) as i64;
                    }
                }
            }
            let mut service = vec![0i64; n];
            let mut open = vec![0i64; n];
            let mut close = vec![NEVER; n];
            for i in 0..n {
                service[i] = (rng.next_f64() * 20.0) as i64;
                // Roughly half the nodes get a real window, so one instance
                // exercises both the constrained and the unconstrained branch
                // of `merge`.
                if rng.next_f64() < 0.5 {
                    let start = (rng.next_f64() * 400.0) as i64;
                    open[i] = start;
                    close[i] = start + 50 + (rng.next_f64() * 200.0) as i64;
                }
            }
            Instance {
                service,
                open,
                close,
                time,
                n,
            }
        }

        fn leaf(&self, node: usize) -> DurationSegment {
            DurationSegment::node(self.service[node], self.open[node], self.close[node])
        }

        fn edge(&self, from: usize, to: usize) -> i64 {
            self.time[from * self.n + to]
        }

        /// The slow, obviously-correct answer: merge the nodes one at a time.
        fn fold(&self, sequence: &[usize]) -> DurationSegment {
            let mut label = self.leaf(sequence[0]);
            for w in sequence.windows(2) {
                label = DurationSegment::merge(self.edge(w[0], w[1]), &label, &self.leaf(w[1]));
            }
            label
        }
    }

    fn build(instance: &Instance, order: &[usize]) -> RangeLabels {
        let mut tree = RangeLabels::new(order.len());
        tree.build(
            order.len(),
            |position| instance.leaf(order[position]),
            |from, to| instance.edge(order[from], order[to]),
        );
        tree
    }

    fn check_every_range(instance: &Instance, order: &[usize], tree: &RangeLabels, note: &str) {
        let edge = |from: usize, to: usize| instance.edge(order[from], order[to]);
        for i in 0..order.len() {
            for j in i..order.len() {
                let ascending: Vec<usize> = (i..=j).map(|p| order[p]).collect();
                let descending: Vec<usize> = (i..=j).rev().map(|p| order[p]).collect();
                assert_eq!(
                    tree.forward(i, j, edge),
                    instance.fold(&ascending),
                    "{note}: forward({i}..={j}) disagrees with a direct fold"
                );
                assert_eq!(
                    tree.reversed(i, j, edge),
                    instance.fold(&descending),
                    "{note}: reversed({i}..={j}) disagrees with a direct fold"
                );
            }
        }
    }

    /// **The test that matters.** Every (i, j) in both directions, not a sample.
    ///
    /// A segment tree that decomposes a range into the wrong ORDER, or merges
    /// the pieces with the wrong arc between them, is right for every range that
    /// happens to land on a single node and wrong for the rest. Both mistakes
    /// are invisible unless every range is checked, and both would silently make
    /// the local search accept moves that ruin a schedule.
    #[test]
    fn every_range_matches_a_direct_fold_in_both_directions() {
        for n in 1..=17usize {
            for seed in 1..4u32 {
                let instance = Instance::random(n, seed);
                let order: Vec<usize> = (0..n).collect();
                let tree = build(&instance, &order);
                check_every_range(&instance, &order, &tree, &format!("n={n} seed={seed}"));
            }
        }
    }

    /// The same claim on a shuffled order, so nothing can be relying on
    /// positions and node indices coinciding.
    #[test]
    fn a_permuted_order_is_handled_by_position_not_by_node() {
        let n = 13;
        let instance = Instance::random(n, 9);
        let mut order: Vec<usize> = (0..n).collect();
        let mut rng = Rng::new(4);
        for i in (1..n).rev() {
            order.swap(i, rng.below(i + 1));
        }
        let tree = build(&instance, &order);
        check_every_range(&instance, &order, &tree, "permuted");
    }

    /// Rebuilding over a shorter route must not leave the previous one's labels
    /// reachable — a route shrinks every time a stop is dropped.
    #[test]
    fn rebuilding_shorter_forgets_the_longer_route() {
        let n = 12;
        let instance = Instance::random(n, 21);
        let order: Vec<usize> = (0..n).collect();
        let mut tree = build(&instance, &order);

        let short: Vec<usize> = order[..5].to_vec();
        tree.build(
            short.len(),
            |position| instance.leaf(short[position]),
            |from, to| instance.edge(short[from], short[to]),
        );
        check_every_range(&instance, &short, &tree, "after shrinking");
    }

    /// Growing past the initial capacity must reallocate rather than index out
    /// of bounds. `Tour` sizes the tree for n, but a caller that got the
    /// capacity wrong deserves a correct answer, not a panic in release.
    #[test]
    fn building_larger_than_the_initial_capacity_grows() {
        let n = 9;
        let instance = Instance::random(n, 5);
        let order: Vec<usize> = (0..n).collect();
        let mut tree = RangeLabels::new(2);
        tree.build(
            n,
            |position| instance.leaf(order[position]),
            |from, to| instance.edge(order[from], order[to]),
        );
        check_every_range(&instance, &order, &tree, "grown");
    }
}
