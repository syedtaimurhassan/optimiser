//! The cost grid and the candidate lists built from it.
//!
//! ── One matrix, not two ───────────────────────────────────────────────────
//!
//! The engine receives exactly ONE cost matrix: whichever one the objective is
//! measured in. It never sees the other.
//!
//! That is not a simplification, it is the layering. `toResult` in
//! `solverPort.ts` computes travel seconds, travel metres and arrival times for
//! every engine from the order alone, so no engine is in a position to disagree
//! with another about what a route is worth. An engine that carried both
//! matrices would be an engine that could report its own distance — and then two
//! engines could return the same order and score it differently, which is the
//! one failure the referee exists to make impossible.
//!
//! ── Flat, row-major, i32 ──────────────────────────────────────────────────
//!
//! `cells[i * n + j]`, the identical layout `SolveMatrix.durations` already
//! uses in TypeScript. The buffer is copied into linear memory with one `set()`
//! at the boundary and never reshaped, which is the whole reason M9 made the
//! matrix flat in the first place.

/// How many nearest neighbours each node keeps. Matches `CANDIDATES` in
/// `engineTs.ts` — the two engines must search the same neighbourhood for a
/// difference between them to mean anything.
pub const CANDIDATES: usize = 10;

pub struct Matrix {
    pub n: usize,
    cells: Vec<i32>,
}

impl Matrix {
    /// # Panics
    /// If `cells` is not exactly `n * n` long.
    pub fn new(n: usize, cells: Vec<i32>) -> Self {
        assert_eq!(cells.len(), n * n, "cost matrix must be n × n");
        Matrix { n, cells }
    }

    /// Cost of travelling `i → j`.
    ///
    /// Unchecked, and deliberately so: this is called a few million times per
    /// solve from the local search, and it is the one function in the crate
    /// where a bounds check is measurable. Every caller derives `i` and `j`
    /// from a tour position or a candidate list, both of which are built from
    /// `0..n` and never store anything else — `debug_assert` holds the line in
    /// tests, which run in debug.
    #[inline(always)]
    pub fn at(&self, i: usize, j: usize) -> i32 {
        debug_assert!(i < self.n && j < self.n, "index {i},{j} outside 0..{}", self.n);
        unsafe { *self.cells.get_unchecked(i * self.n + j) }
    }

    /// Add to one cell, saturating.
    ///
    /// The ONLY mutation this type allows, and it exists for exactly one caller:
    /// guided local search, which raises the price of an arc it wants the search
    /// to stop choosing. Folding the penalty into the matrix rather than adding
    /// it at every lookup is what keeps the inner loop at one memory read — a
    /// separate penalty array consulted per arc would double the random access
    /// on the hottest path in the crate to save 2 MB we are not short of.
    #[inline]
    pub fn add_at(&mut self, i: usize, j: usize, delta: i32) {
        debug_assert!(i < self.n && j < self.n);
        let cell = &mut self.cells[i * self.n + j];
        *cell = cell.saturating_add(delta);
    }

    /// The cheaper of the two directions between `i` and `j`.
    #[inline(always)]
    pub fn symmetric_at(&self, i: usize, j: usize) -> i32 {
        let forward = self.at(i, j);
        let backward = self.at(j, i);
        if forward < backward {
            forward
        } else {
            backward
        }
    }
}

/// K nearest neighbours per node, ascending by symmetrised cost.
pub struct Candidates {
    pub width: usize,
    entries: Vec<i32>,
}

impl Candidates {
    /// Build the lists.
    ///
    /// ── Why symmetrised ──────────────────────────────────────────────────
    ///
    /// A candidate list asks "might these two ever be adjacent", and they might
    /// be adjacent in either order. Ranking by the forward cost alone would hide
    /// every pair that is cheap one way and dear the other, which on a one-way
    /// street is most of them. So the key is `min(d[i][j], d[j][i])`, exactly as
    /// `buildCandidates` does in `engineTs.ts`.
    ///
    /// ── Why an insertion window rather than a sort ────────────────────────
    ///
    /// Sorting each row is O(n log n); maintaining a sorted window of the best
    /// `width` is O(n · width) with `width` = 10, and the early-out on the last
    /// slot means most candidates cost one comparison. At n = 1000 that is the
    /// difference between ~10 M and ~10 M — but the constant is far smaller and
    /// it allocates nothing per row.
    pub fn build(matrix: &Matrix) -> Self {
        let n = matrix.n;
        let width = CANDIDATES.min(n.saturating_sub(1).max(1));
        let mut entries = vec![0i32; n * width];
        let mut best_cost = vec![i32::MAX; width];

        for i in 0..n {
            let mut filled = 0usize;
            best_cost.iter_mut().for_each(|c| *c = i32::MAX);
            let base = i * width;

            for j in 0..n {
                if j == i {
                    continue;
                }
                let cost = matrix.symmetric_at(i, j);
                if filled == width && cost >= best_cost[width - 1] {
                    continue;
                }

                let mut slot = if filled < width { filled } else { width - 1 };
                while slot > 0 && best_cost[slot - 1] > cost {
                    best_cost[slot] = best_cost[slot - 1];
                    entries[base + slot] = entries[base + slot - 1];
                    slot -= 1;
                }
                best_cost[slot] = cost;
                entries[base + slot] = j as i32;
                if filled < width {
                    filled += 1;
                }
            }

            // An instance smaller than `width + 1` has fewer than `width` other
            // nodes to offer. Pad with the last real entry rather than leaving a
            // zero, which the search would otherwise read as "node 0" and
            // cheerfully try to move next to.
            let last = entries[base + filled.saturating_sub(1)];
            for slot in filled..width {
                entries[base + slot] = last;
            }
        }

        Candidates { width, entries }
    }

    /// The candidate list for one node, ascending.
    #[inline(always)]
    pub fn of(&self, node: usize) -> &[i32] {
        let base = node * self.width;
        debug_assert!(base + self.width <= self.entries.len());
        unsafe { self.entries.get_unchecked(base..base + self.width) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    /// An asymmetric matrix, because a symmetric one would let a wrong
    /// implementation pass. Real driving matrices disagree with their reverse on
    /// 98.3% of pairs.
    fn asymmetric(n: usize, seed: u32) -> Matrix {
        let mut rng = Rng::new(seed);
        let mut cells = vec![0i32; n * n];
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    cells[i * n + j] = 1 + (rng.next_f64() * 10_000.0) as i32;
                }
            }
        }
        Matrix::new(n, cells)
    }

    #[test]
    fn at_reads_row_major() {
        let m = Matrix::new(3, vec![0, 1, 2, 10, 0, 12, 20, 21, 0]);
        assert_eq!(m.at(0, 2), 2);
        assert_eq!(m.at(2, 0), 20);
        assert_eq!(m.at(1, 2), 12);
    }

    #[test]
    fn symmetric_at_takes_the_cheaper_direction() {
        let m = Matrix::new(2, vec![0, 7, 3, 0]);
        assert_eq!(m.symmetric_at(0, 1), 3);
        assert_eq!(m.symmetric_at(1, 0), 3);
    }

    /// The property that matters: the list really is the K nearest, checked
    /// against a full sort rather than against another implementation of the
    /// same idea.
    #[test]
    fn candidates_are_the_true_k_nearest() {
        for seed in 1..12u32 {
            let n = 40;
            let m = asymmetric(n, seed);
            let c = Candidates::build(&m);
            assert_eq!(c.width, CANDIDATES);

            for i in 0..n {
                let mut all: Vec<(i32, usize)> = (0..n)
                    .filter(|&j| j != i)
                    .map(|j| (m.symmetric_at(i, j), j))
                    .collect();
                all.sort();

                let got = c.of(i);
                // Compare COSTS, not node ids: ties are broken by insertion
                // order here and by index in the sort, and a tie means the two
                // choices are equally good.
                for (slot, &node) in got.iter().enumerate() {
                    assert_eq!(
                        m.symmetric_at(i, node as usize),
                        all[slot].0,
                        "seed {seed}, node {i}, slot {slot}"
                    );
                }
            }
        }
    }

    #[test]
    fn candidates_are_ascending() {
        let m = asymmetric(30, 5);
        let c = Candidates::build(&m);
        for i in 0..30 {
            let list = c.of(i);
            for w in list.windows(2) {
                assert!(
                    m.symmetric_at(i, w[0] as usize) <= m.symmetric_at(i, w[1] as usize),
                    "candidate list for {i} is not ascending"
                );
            }
        }
    }

    /// A three-node instance has only two neighbours per node, so the list is
    /// padded. The padding must be a real node — never an uninitialised zero,
    /// which the search would read as node 0.
    #[test]
    fn tiny_instances_pad_with_a_real_node() {
        let m = asymmetric(3, 9);
        let c = Candidates::build(&m);
        assert_eq!(c.width, 2);
        for i in 0..3 {
            for &node in c.of(i) {
                assert!(node >= 0 && (node as usize) < 3);
                assert_ne!(node as usize, i, "a node is its own candidate");
            }
        }

        let m2 = asymmetric(2, 9);
        let c2 = Candidates::build(&m2);
        assert_eq!(c2.width, 1);
        assert_eq!(c2.of(0), &[1]);
        assert_eq!(c2.of(1), &[0]);
    }
}
