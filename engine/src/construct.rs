//! Building a first route, and rebuilding one after it has been torn up.
//!
//! Cheapest insertion under the K cap, offered nodes in a caller-chosen order.
//! The order matters and the placement does not depend on it: `seed_order` only
//! decides which node is offered next, never where it lands. A space-filling
//! curve therefore makes the insertions cheaper and more sensible without being
//! able to produce a route the cost matrix disagrees with.

use crate::problem::{Problem, PIN_FIRST, PIN_LAST};
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

    /*
      Offer order decides which class of node lands where.

      Sorted by (zone, optional): the first block, then mandatory unpinned, then
      optional unpinned, then the last block. Stable, so the seed order survives
      within each class.

      Zone first, because `insert_all` places each node in the cheapest gap ITS
      OWN zone allows, and a zone's boundary depends on how many pinned nodes are
      already in the route. Offering a last-block stop before the unpinned ones
      would have it inserted into a route whose last block has not been built
      yet, which is not wrong so much as pointless — it would be shuffled into
      place immediately afterwards.

      Mandatory before optional for the reason M10 gives: they are going in
      regardless, and inserting them into a fuller route is more expensive and no
      better.
    */
    offered.sort_by_key(|&node| {
        let node = node as usize;
        let zone = match problem.pin[node] {
            PIN_FIRST => 0,
            PIN_LAST => 2,
            _ => 1,
        };
        (zone, problem.optional[node])
    });

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

/// Which construction to build the first route with.
///
/// ── Why more than one ─────────────────────────────────────────────────────
///
/// OR-Tools ships fourteen first-solution strategies and its JS portfolio cycled
/// seven of them, because with no local search reachable through that binding
/// (see `routing_api.cc`, which only ever sets `first_solution_strategy` and
/// `solution_limit`) the CONSTRUCTION was the only quality lever it had.
///
/// We have a real local search, so the starting point matters far less — but not
/// nothing. Different constructions fail in different shapes, and a descent
/// cannot always walk out of the shape it started in. Three genuinely different
/// starts, spread across a worker pool, cost nothing and cover each other.
///
/// The three chosen ones and what they are bad at:
///
///   `CheapestInsertion`  M10's, and the default. Robust; tends to leave a few
///                        long "stitching" arcs where two dense areas meet.
///   `NearestNeighbour`   OR-Tools' `PATH_CHEAPEST_ARC`. Fast and locally sane,
///                        with one notoriously awful arc at the end where it has
///                        to come back for whatever it skipped.
///   `Savings`            Clarke & Wright (1964), OR-Tools' `SAVINGS`. Builds
///                        from the arcs that save the most against going out and
///                        back, so it produces a globally sensible skeleton and
///                        is the one least like the other two.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Construction {
    CheapestInsertion,
    NearestNeighbour,
    Savings,
}

/// Build a route with a chosen construction.
///
/// Falls back to cheapest insertion whenever the alternative cannot express the
/// problem — see each one. A construction is a starting point, so degrading to a
/// different starting point is always safe; refusing to build would not be.
pub fn construct_with(
    problem: &Problem,
    tour: &mut Tour,
    seed_order: Option<&[i32]>,
    tw_penalty: i64,
    how: Construction,
) {
    match how {
        Construction::CheapestInsertion => construct(problem, tour, seed_order, tw_penalty),
        Construction::NearestNeighbour => nearest_neighbour(problem, tour, tw_penalty),
        Construction::Savings => savings(problem, tour, tw_penalty),
    }
}

/// Nodes this construction is allowed to place itself, in offer order.
///
/// Excludes the pinned depots, and excludes anything with a First/Last pin —
/// those live in blocks whose position is not a matter of cost, so they are
/// inserted afterwards by the shared cheapest-insertion path, which knows about
/// zones. A construction that tried to order them would be answering a question
/// that has already been answered.
fn placeable(problem: &Problem) -> Vec<usize> {
    (0..problem.n())
        .filter(|&node| {
            Some(node) != problem.start
                && Some(node) != problem.end
                && problem.pin[node] == crate::problem::PIN_AUTO
        })
        .collect()
}

/// Put the pinned depots in, and nothing else.
fn seed_endpoints(problem: &Problem, tour: &mut Tour) {
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
}

/// Finish a partial route: pinned stops into their blocks, then fill to the cap.
///
/// Shared by both alternative constructions, because both of them build the
/// unpinned middle and neither has any business deciding where a First stop
/// goes.
fn finish(problem: &Problem, tour: &mut Tour, tw_penalty: i64) {
    for node in 0..problem.n() {
        if problem.pin[node] != crate::problem::PIN_AUTO && tour.pos[node] < 0 {
            let placed = tour.best_insertion(problem, node, tw_penalty);
            tour.insert_at(problem, node, placed.at);
        }
    }
    greedy_refill(problem, tour, tw_penalty);
}

/// `PATH_CHEAPEST_ARC`: from the current end of the path, always go to the
/// nearest unvisited node.
///
/// O(n²) and about as simple as a construction gets. Its weakness is structural
/// and well known — it is greedy about the next arc and pays for it at the end,
/// when the only nodes left are the ones it walked past — which is exactly why
/// it is worth having alongside insertion, whose failures look nothing like it.
pub fn nearest_neighbour(problem: &Problem, tour: &mut Tour, tw_penalty: i64) {
    seed_endpoints(problem, tour);
    let mut remaining = placeable(problem);
    if remaining.is_empty() {
        finish(problem, tour, tw_penalty);
        return;
    }

    // Grow from the start if there is one; otherwise from the cheapest first
    // node, which for a free start is simply the first one offered.
    let mut current = problem.start.unwrap_or_else(|| remaining[0]);
    if problem.start.is_none() {
        remaining.retain(|&node| node != current);
        // The free start becomes position 0 of the route.
        tour.insert_at(problem, current, 0);
    }

    let cap = problem.cap;
    let mut optional_in = tour.optional_visited(problem);
    while !remaining.is_empty() {
        if optional_in >= cap && remaining.iter().all(|&node| problem.is_optional(node)) {
            break;
        }
        /*
          Nearest by PENALISED cost, not by arc cost.

          The first version priced the next hop on distance alone, and it cost
          feasibility: on one of the twenty-five TSPTW instances it walked past a
          stop whose window was closing and could not get back in time, and the
          descent could not repair a route that was already an hour late by the
          middle of the day. "Nearest" has to mean nearest given the clock, or
          this construction hands the search a problem it did not have.

          `warp_after_insert` is O(1), and the gap is the one this node would
          actually take, so the estimate is exact rather than indicative.
        */
        let timed = problem.windows_bind() && tw_penalty != 0;
        let warp_now = if timed { tour.time_warp(problem) } else { 0 };
        let gap = tour.hi_gap(problem, tour.len);

        let mut best = usize::MAX;
        let mut best_cost = i64::MAX;
        for (at, &node) in remaining.iter().enumerate() {
            if problem.is_optional(node) && optional_in >= cap {
                continue;
            }
            let mut cost = i64::from(problem.matrix.at(current, node));
            if timed {
                cost += tw_penalty * (tour.warp_after_insert(problem, node, gap) - warp_now);
            }
            if cost < best_cost {
                best_cost = cost;
                best = at;
            }
        }
        if best == usize::MAX {
            break;
        }
        let node = remaining.swap_remove(best);
        // Just before the pinned end when there is one, otherwise at the back.
        tour.insert_at(problem, node, gap);
        if problem.is_optional(node) {
            optional_in += 1;
        }
        current = node;
    }

    finish(problem, tour, tw_penalty);
}

/// `SAVINGS`: Clarke & Wright (1964), adapted to one vehicle.
///
/// ── The idea, and why it survives being single-vehicle ────────────────────
///
/// Start with every node served by its own out-and-back trip from the depot.
/// Merging the trips for `i` and `j` into `… → i → j → …` saves
///
/// ```text
/// s(i,j) = d(i, depot) + d(depot, j) − d(i, j)
/// ```
///
/// Take the merges in descending order of saving, skipping any that would give
/// a node two successors, two predecessors, or close a premature cycle. Clarke
/// and Wright stop when capacity forbids further merging; with one vehicle
/// nothing forbids it, so the merges continue until a single path remains —
/// which is precisely a TSP construction, and a good one.
///
/// The saving is asymmetric here, as it must be: `s(i,j)` and `s(j,i)` are
/// different numbers on a road matrix, and both are offered.
///
/// ── When it declines to build ─────────────────────────────────────────────
///
/// It needs a depot to measure "out and back" against. With both endpoints free
/// there is nothing to measure, so it hands back to cheapest insertion rather
/// than inventing one.
pub fn savings(problem: &Problem, tour: &mut Tour, tw_penalty: i64) {
    let Some(depot) = problem.start.or(problem.end) else {
        construct(problem, tour, None, tw_penalty);
        return;
    };

    let nodes = placeable(problem);
    // Below three nodes there is nothing for a merge to decide.
    if nodes.len() < 3 {
        construct(problem, tour, None, tw_penalty);
        return;
    }

    let m = &problem.matrix;
    let mut pairs: Vec<(i64, usize, usize)> = Vec::with_capacity(nodes.len() * nodes.len());
    for &i in &nodes {
        for &j in &nodes {
            if i == j {
                continue;
            }
            let saving = i64::from(m.at(i, depot)) + i64::from(m.at(depot, j))
                - i64::from(m.at(i, j));
            pairs.push((saving, i, j));
        }
    }
    // Descending saving. Ties broken by index so the construction is
    // deterministic — two workers given the same seed must build the same route
    // or a "different strategy" would just be noise.
    pairs.sort_unstable_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2)));

    let n = problem.n();
    let mut successor = vec![usize::MAX; n];
    let mut predecessor = vec![usize::MAX; n];

    /// Follow successors from `from` and report where the chain ends.
    fn chain_end(successor: &[usize], from: usize) -> usize {
        let mut at = from;
        while successor[at] != usize::MAX {
            at = successor[at];
        }
        at
    }

    for (_, i, j) in pairs {
        if successor[i] != usize::MAX || predecessor[j] != usize::MAX {
            continue;
        }
        // Joining i → j would close a cycle if j already leads back to i.
        if chain_end(&successor, j) == i {
            continue;
        }
        successor[i] = j;
        predecessor[j] = i;
    }

    // Read the chains off, heads first. With every merge applied there is
    // normally one chain; a rejected merge can leave several, and concatenating
    // them in head order is a perfectly good route for a descent to start from.
    seed_endpoints(problem, tour);
    let cap = problem.cap;
    let mut optional_in = tour.optional_visited(problem);
    let mut placed = vec![false; n];

    for &head in &nodes {
        if predecessor[head] != usize::MAX {
            continue;
        }
        let mut at = head;
        loop {
            if !placed[at] && !(problem.is_optional(at) && optional_in >= cap) {
                let gap = tour.hi_gap(problem, tour.len);
                tour.insert_at(problem, at, gap);
                placed[at] = true;
                if problem.is_optional(at) {
                    optional_in += 1;
                }
            }
            match successor[at] {
                usize::MAX => break,
                next => at = next,
            }
        }
    }

    finish(problem, tour, tw_penalty);
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
    use crate::problem::{Problem, PIN_FIRST};

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

    /// Whatever the construction, the route it hands the descent must be a
    /// legal route. A construction that produces a duplicate or drops a
    /// mandatory node does not fail — it hands the local search something that
    /// cannot be repaired, and the failure surfaces much later as a wrong answer.
    #[test]
    fn every_construction_produces_a_valid_route() {
        for how in [
            Construction::CheapestInsertion,
            Construction::NearestNeighbour,
            Construction::Savings,
        ] {
            for seed in 1..8u32 {
                for &(k, start, end) in &[
                    (None, Some(0usize), Some(19usize)),
                    (None, Some(0), None),
                    (Some(8), Some(0), Some(19)),
                    (None, None, None),
                ] {
                    let n = 20;
                    let problem = problem_with(n, seed, k, start, end);
                    let cap = problem.cap;
                    let mut tour = Tour::new(n);
                    construct_with(&problem, &mut tour, None, 0, how);

                    let order = tour.snapshot();
                    assert!(!order.is_empty(), "{how:?} seed {seed}: empty route");

                    let mut seen = order.clone();
                    seen.sort();
                    seen.dedup();
                    assert_eq!(seen.len(), order.len(), "{how:?} seed {seed}: repeated node");

                    if let Some(s) = start {
                        assert_eq!(order[0], s as i32, "{how:?} seed {seed}: start moved");
                    }
                    if let Some(e) = end {
                        assert_eq!(
                            *order.last().unwrap(),
                            e as i32,
                            "{how:?} seed {seed}: end moved"
                        );
                    }
                    assert!(
                        tour.optional_visited(&problem) <= cap,
                        "{how:?} seed {seed}: cap exceeded"
                    );
                    for node in 0..n {
                        assert!(
                            problem.is_optional(node) || tour.pos[node] >= 0,
                            "{how:?} seed {seed}: mandatory node {node} was skipped"
                        );
                    }
                }
            }
        }
    }

    /// The three constructions must actually be three constructions.
    ///
    /// A "portfolio" whose members agree is a portfolio of one, and it would
    /// look exactly like a working portfolio from the outside — the workers
    /// would report different strategies and search the same basin.
    #[test]
    fn the_constructions_disagree_with_each_other() {
        let n = 24;
        let mut differing = 0;
        for seed in 1..10u32 {
            let problem = problem_with(n, seed, None, Some(0), Some(n - 1));
            let mut routes = Vec::new();
            for how in [
                Construction::CheapestInsertion,
                Construction::NearestNeighbour,
                Construction::Savings,
            ] {
                let mut tour = Tour::new(n);
                construct_with(&problem, &mut tour, None, 0, how);
                routes.push(tour.snapshot());
            }
            if routes[0] != routes[1] && routes[1] != routes[2] && routes[0] != routes[2] {
                differing += 1;
            }
        }
        assert!(
            differing >= 7,
            "the three constructions agreed on {} of 9 instances",
            9 - differing
        );
    }

    /// Savings has no depot to measure "out and back" against when both ends are
    /// free, so it must hand back to cheapest insertion rather than invent one.
    #[test]
    fn savings_declines_gracefully_without_a_depot() {
        let n = 12;
        let problem = problem_with(n, 5, None, None, None);
        let mut via_savings = Tour::new(n);
        construct_with(&problem, &mut via_savings, None, 0, Construction::Savings);
        let mut via_insertion = Tour::new(n);
        construct(&problem, &mut via_insertion, None, 0);
        assert_eq!(via_savings.snapshot(), via_insertion.snapshot());
    }

    /// Every construction must place the pinned blocks correctly, because none
    /// of them decides where a pinned stop goes — they build the middle and hand
    /// the blocks to the shared insertion path.
    #[test]
    fn every_construction_honours_pin_blocks() {
        let n = 18;
        for how in [
            Construction::CheapestInsertion,
            Construction::NearestNeighbour,
            Construction::Savings,
        ] {
            for seed in 1..5u32 {
                let mut rng = Rng::new(seed);
                let mut cells = vec![0i32; n * n];
                for i in 0..n {
                    for j in 0..n {
                        if i != j {
                            cells[i * n + j] = 1 + (rng.next_f64() * 10_000.0) as i32;
                        }
                    }
                }
                let mut pin = vec![crate::problem::PIN_AUTO; n];
                pin[4] = PIN_FIRST;
                pin[9] = PIN_LAST;
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
                    pin,
                );

                let mut tour = Tour::new(n);
                construct_with(&problem, &mut tour, None, 0, how);
                let order = tour.snapshot();
                assert_eq!(order[1], 4, "{how:?} seed {seed}: First not at position 1");
                assert_eq!(
                    order[order.len() - 2],
                    9,
                    "{how:?} seed {seed}: Last not just before the end"
                );
            }
        }
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
