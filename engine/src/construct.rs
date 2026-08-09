//! Building a first route, and rebuilding one after it has been torn up.
//!
//! Cheapest insertion under the K cap, offered nodes in a caller-chosen order.
//! The order matters and the placement does not depend on it: `seed_order` only
//! decides which node is offered next, never where it lands. A space-filling
//! curve therefore makes the insertions cheaper and more sensible without being
//! able to produce a route the cost matrix disagrees with.

use crate::problem::Problem;
use crate::rng::Rng;
use crate::tour::Tour;

/// Build a route from scratch.
///
/// Pinned ends go in first and stay put. Mandatory nodes are offered before
/// optional ones because they are going in regardless, and inserting them into
/// a fuller route is more expensive and no better.
pub fn construct(
    problem: &Problem,
    tour: &mut Tour,
    seed_order: Option<&[i32]>,
    tw_penalty: i64,
) {
    tour.len = 0;
    for slot in tour.pos.iter_mut() {
        *slot = -1;
    }

    if let Some(start) = problem.start {
        tour.order[tour.len] = start as i32;
        tour.len += 1;
    }
    if let Some(end) = problem.end {
        tour.order[tour.len] = end as i32;
        tour.len += 1;
    }
    tour.refresh(problem);

    let mut offered: Vec<i32> = Vec::with_capacity(problem.n());
    let is_pinned = |node: usize| Some(node) == problem.start || Some(node) == problem.end;

    if let Some(seed) = seed_order {
        for &node in seed {
            if !is_pinned(node as usize) {
                offered.push(node);
            }
        }
    }
    if offered.is_empty() {
        for node in 0..problem.n() {
            if !is_pinned(node) {
                offered.push(node as i32);
            }
        }
    }

    // Stable, so the seed order survives within each class.
    offered.sort_by_key(|&node| problem.optional[node as usize]);

    insert_all(problem, tour, &offered, tw_penalty);
}

/// Offer each node once, cheapest gap, stopping at the cap.
fn insert_all(problem: &Problem, tour: &mut Tour, offered: &[i32], tw_penalty: i64) {
    let mut optional_in = 0usize;
    for &node in offered {
        let node = node as usize;
        let optional = problem.is_optional(node);
        if optional && optional_in >= problem.cap {
            continue;
        }
        let placed = tour.best_insertion(problem, node, tw_penalty);
        tour.insert_at(problem, node, placed.at);
        if optional {
            optional_in += 1;
        }
    }
}

/// Rebuild from a shuffled offer order — a genuine restart, not a nudge.
///
/// A double bridge explores the basin around one solution. When that basin is
/// exhausted the way out is a different construction entirely, which is what
/// this is for.
pub fn restart(problem: &Problem, tour: &mut Tour, rng: &mut Rng, tw_penalty: i64) {
    let n = problem.n();
    let mut offered: Vec<i32> = (0..n as i32).collect();
    for i in (1..n).rev() {
        let j = rng.below(i + 1);
        offered.swap(i, j);
    }
    // `construct` re-filters the pinned ends and re-sorts mandatory-first, so
    // the shuffle only ever reorders nodes within their class.
    construct(problem, tour, Some(&offered), tw_penalty);
}

/// Fill to the cap, cheapest insertion first, from whatever is still out.
///
/// Unlike `construct`, this picks the globally cheapest (node, gap) pair on each
/// pass rather than taking nodes in a fixed order — it is repairing a route that
/// already has a shape, so the question is which absent node fits it best.
pub fn greedy_refill(problem: &Problem, tour: &mut Tour, tw_penalty: i64) {
    loop {
        if tour.optional_visited(problem) >= problem.cap {
            return;
        }
        let mut best_node = usize::MAX;
        let mut best_at = 0usize;
        let mut best_cost = i64::MAX;
        for node in 0..problem.n() {
            if !problem.is_optional(node) || tour.pos[node] >= 0 {
                continue;
            }
            let placed = tour.best_insertion(problem, node, tw_penalty);
            if placed.cost < best_cost {
                best_cost = placed.cost;
                best_node = node;
                best_at = placed.at;
            }
        }
        if best_node == usize::MAX {
            return;
        }
        tour.insert_at(problem, best_node, best_at);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matrix::Matrix;
    use crate::problem::Problem;

    fn problem_with(n: usize, seed: u32, k: Option<usize>, start: Option<usize>, end: Option<usize>) -> Problem {
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

    #[test]
    fn visits_everything_when_k_does_not_bind() {
        let n = 14;
        let problem = problem_with(n, 2, None, None, None);
        let mut tour = Tour::new(n);
        construct(&problem, &mut tour, None, 0);

        assert_eq!(tour.len, n);
        let mut seen = tour.snapshot();
        seen.sort();
        assert_eq!(seen, (0..n as i32).collect::<Vec<_>>());
    }

    #[test]
    fn honours_pinned_ends() {
        let n = 12;
        for &(start, end) in &[
            (Some(3usize), None),
            (None, Some(7usize)),
            (Some(3usize), Some(7usize)),
        ] {
            let problem = problem_with(n, 4, None, start, end);
            let mut tour = Tour::new(n);
            construct(&problem, &mut tour, None, 0);

            assert_eq!(tour.len, n);
            if let Some(s) = start {
                assert_eq!(tour.order[0], s as i32, "start {start:?} end {end:?}");
            }
            if let Some(e) = end {
                assert_eq!(tour.order[tour.len - 1], e as i32, "start {start:?} end {end:?}");
            }
        }
    }

    #[test]
    fn respects_the_k_cap() {
        let n = 20;
        let problem = problem_with(n, 6, Some(5), Some(0), Some(19));
        let mut tour = Tour::new(n);
        construct(&problem, &mut tour, None, 0);

        // Two mandatory endpoints plus at most five optional nodes.
        assert_eq!(tour.optional_visited(&problem), 5);
        assert_eq!(tour.len, 7);
        assert_eq!(tour.order[0], 0);
        assert_eq!(tour.order[tour.len - 1], 19);
    }

    #[test]
    fn a_seed_order_changes_the_route_but_not_its_validity() {
        let n = 15;
        let problem = problem_with(n, 8, None, None, None);

        let mut plain = Tour::new(n);
        construct(&problem, &mut plain, None, 0);

        let reversed: Vec<i32> = (0..n as i32).rev().collect();
        let mut seeded = Tour::new(n);
        construct(&problem, &mut seeded, Some(&reversed), 0);

        assert_eq!(seeded.len, n);
        let mut seen = seeded.snapshot();
        seen.sort();
        assert_eq!(seen, (0..n as i32).collect::<Vec<_>>());
        // Both are valid; the seed is a hint, not a constraint, so we assert
        // nothing about which is cheaper.
        assert!(plain.cost() > 0 && seeded.cost() > 0);
    }

    #[test]
    fn greedy_refill_fills_to_the_cap_and_stops() {
        let n = 18;
        let problem = problem_with(n, 10, Some(9), Some(0), None);
        let mut tour = Tour::new(n);
        construct(&problem, &mut tour, None, 0);
        assert_eq!(tour.optional_visited(&problem), 9);

        // Tear out three, then refill.
        for _ in 0..3 {
            let p = tour
                .snapshot()
                .iter()
                .position(|&node| problem.is_optional(node as usize))
                .unwrap();
            tour.remove_at(&problem, p);
        }
        assert_eq!(tour.optional_visited(&problem), 6);

        greedy_refill(&problem, &mut tour, 0);
        assert_eq!(tour.optional_visited(&problem), 9);
        assert_eq!(tour.order[0], 0);
    }

    #[test]
    fn restart_produces_a_valid_route() {
        let n = 16;
        let problem = problem_with(n, 12, Some(6), Some(2), Some(11));
        let mut tour = Tour::new(n);
        let mut rng = Rng::new(99);

        for _ in 0..25 {
            restart(&problem, &mut tour, &mut rng, 0);
            assert_eq!(tour.order[0], 2);
            assert_eq!(tour.order[tour.len - 1], 11);
            assert_eq!(tour.optional_visited(&problem), 6);
            let mut seen = tour.snapshot();
            seen.sort();
            seen.dedup();
            assert_eq!(seen.len(), tour.len, "a node was visited twice");
        }
    }
}
