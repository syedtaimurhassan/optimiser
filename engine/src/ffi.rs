//! The entire surface JavaScript can see.
//!
//! ── Eleven functions, and none of them is called during the search ────────
//!
//! Setup crosses the boundary a fixed number of times regardless of n: allocate
//! a buffer, write the matrix into it, create the engine, free the buffer. Then
//! `engine_step` is called repeatedly, and each call runs thousands of move
//! evaluations without returning to JS even once.
//!
//! Compare `or-tools-wasm`, which installs a JavaScript transit-cost callback
//! and invokes it once per arc evaluation. That is the difference between an
//! FFI crossing being a setup cost and being the inner loop, and it is why a
//! ten-node model there takes over twelve seconds.
//!
//! This module declares no imports, so the property is structural rather than
//! aspirational: there is no JavaScript function for the engine to call, and
//! `scripts/build-engine.mjs` fails the build if the compiled artefact ever
//! grows an import section.
//!
//! ── Memory discipline ─────────────────────────────────────────────────────
//!
//! JS never holds a view across a call that can grow linear memory. Growing
//! detaches every existing `TypedArray`, and a stale view reads zeros rather
//! than failing — which would look exactly like a matrix full of free travel.
//! `engine_alloc` is the only entry point that can grow memory, so the loader
//! re-derives its views immediately after each one and at no other time.
//!
//! The inputs are COPIED into the engine rather than adopted in place. Adopting
//! would save one 4 MB allocation at n = 1000, at the price of the loader and
//! the engine having to agree exactly on an allocation's layout forever. The
//! copy is transient — the loader frees its staging buffer the moment
//! `engine_create` returns — and 8 MB against a 256 MB ceiling is not a trade
//! worth taking risk for.

use std::alloc::{alloc, dealloc, Layout};

use crate::driver::{Driver, Strategy};
use crate::matrix::Matrix;
use crate::problem::Problem;

/// i32 and u8 buffers both satisfy this, and it is what `Vec<i32>` would use.
const ALIGN: usize = 4;

/// `flags` bit 0: search the landscape with guided local search instead of
/// perturbing the route with iterated local search.
pub const FLAG_GLS: u32 = 1;

/// `flags` bit 1: iterated local search, then guided local search once ILS has
/// run out of ideas. Takes precedence over `FLAG_GLS`.
pub const FLAG_HYBRID: u32 = 2;

/// Reserve `bytes` of linear memory and return a pointer to it.
///
/// Returns null on failure rather than aborting, so the loader can report
/// "out of memory" as an error the app can show instead of a wasm trap.
///
/// # Safety
/// The caller must pass the same `bytes` to `engine_dealloc`.
#[no_mangle]
pub extern "C" fn engine_alloc(bytes: u32) -> *mut u8 {
    let bytes = bytes as usize;
    if bytes == 0 {
        return std::ptr::null_mut();
    }
    match Layout::from_size_align(bytes, ALIGN) {
        Ok(layout) => unsafe { alloc(layout) },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Release a buffer from `engine_alloc`.
///
/// # Safety
/// `ptr` must have come from `engine_alloc` with the identical `bytes`.
#[no_mangle]
pub unsafe extern "C" fn engine_dealloc(ptr: *mut u8, bytes: u32) {
    let bytes = bytes as usize;
    if ptr.is_null() || bytes == 0 {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(bytes, ALIGN) {
        unsafe { dealloc(ptr, layout) };
    }
}

/// Build an engine. Returns null if the inputs do not describe a solvable
/// problem.
///
/// `cost` is the matrix the OBJECTIVE is measured in — duration or distance,
/// whichever the caller chose. The engine never sees the other one, because
/// `toResult` on the TypeScript side computes every reported figure from the
/// order alone, so no engine is ever in a position to disagree with another
/// about what a route is worth.
///
/// `select_k` negative means "no cap". `start` and `end` negative mean "free".
/// `flags` bit 0 (`FLAG_GLS`) selects guided local search; the default is ILS.
///
/// # Safety
/// `cost` must point to `n * n` readable `i32`s, `optional` to `n` readable
/// `u8`s, and `seed_order` either to `seed_order_len` readable `i32`s or be
/// null. None of them is retained.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn engine_create(
    n: u32,
    cost: *const i32,
    optional: *const u8,
    select_k: i32,
    skip_penalty: i32,
    start: i32,
    end: i32,
    seed: u32,
    seed_order: *const i32,
    seed_order_len: u32,
    flags: u32,
) -> *mut Driver {
    let n = n as usize;
    if n < 2 || cost.is_null() || optional.is_null() {
        return std::ptr::null_mut();
    }

    let in_range = |v: i32| v >= 0 && (v as usize) < n;
    if (start >= 0 && !in_range(start)) || (end >= 0 && !in_range(end)) {
        return std::ptr::null_mut();
    }
    if start >= 0 && start == end {
        return std::ptr::null_mut();
    }

    let cells = unsafe { std::slice::from_raw_parts(cost, n * n) }.to_vec();
    let optional = unsafe { std::slice::from_raw_parts(optional, n) }.to_vec();

    let seed_order = if seed_order.is_null() || seed_order_len == 0 {
        None
    } else {
        let slice = unsafe { std::slice::from_raw_parts(seed_order, seed_order_len as usize) };
        // A malformed hint must not be able to corrupt the search. It is only a
        // suggested offer order, so dropping a bad one costs nothing.
        if slice.iter().any(|&node| node < 0 || node as usize >= n) {
            None
        } else {
            Some(slice.to_vec())
        }
    };

    let problem = Problem::new(
        Matrix::new(n, cells),
        optional,
        if select_k < 0 {
            None
        } else {
            Some(select_k as usize)
        },
        i64::from(skip_penalty),
        if start < 0 { None } else { Some(start as usize) },
        if end < 0 { None } else { Some(end as usize) },
    );

    let strategy = if flags & FLAG_HYBRID != 0 {
        Strategy::IlsThenGls
    } else if flags & FLAG_GLS != 0 {
        Strategy::Gls
    } else {
        Strategy::Ils
    };

    Box::into_raw(Box::new(Driver::with_strategy(
        problem, seed, seed_order, strategy,
    )))
}

/// Release an engine.
///
/// # Safety
/// `driver` must have come from `engine_create` and not been destroyed already.
#[no_mangle]
pub unsafe extern "C" fn engine_destroy(driver: *mut Driver) {
    if !driver.is_null() {
        drop(unsafe { Box::from_raw(driver) });
    }
}

/// Run the search for at most `budget` units of work.
///
/// Returns 1 when the search has converged and further steps would do nothing,
/// 0 when there is more to do. The host is free to stop at any 0 — this is how
/// both the time budget and cancellation are enforced, because nothing inside
/// the engine can read a clock or an `AbortSignal`.
///
/// One unit is roughly one node's candidate sweep. The host calibrates the
/// budget to a wall-clock target by measuring how long the last call took.
///
/// # Safety
/// `driver` must be a live pointer from `engine_create`.
#[no_mangle]
pub unsafe extern "C" fn engine_step(driver: *mut Driver, budget: u32) -> u32 {
    if driver.is_null() {
        return 1;
    }
    let driver = unsafe { &mut *driver };
    u32::from(driver.step(i64::from(budget).max(1)))
}

/// Pointer to the best order found so far, as `i32` matrix indices.
///
/// Valid until the next `engine_step` or `engine_destroy`. The loader copies it
/// out immediately rather than holding it.
///
/// # Safety
/// `driver` must be a live pointer from `engine_create`.
#[no_mangle]
pub unsafe extern "C" fn engine_best_ptr(driver: *const Driver) -> *const i32 {
    if driver.is_null() {
        return std::ptr::null();
    }
    unsafe { &*driver }.best().as_ptr()
}

/// How many entries `engine_best_ptr` points at.
///
/// # Safety
/// `driver` must be a live pointer from `engine_create`.
#[no_mangle]
pub unsafe extern "C" fn engine_best_len(driver: *const Driver) -> u32 {
    if driver.is_null() {
        return 0;
    }
    unsafe { &*driver }.best().len() as u32
}

/// The best objective so far: arcs plus skip penalties.
///
/// Returned as `f64` rather than `i64` so the export can be called from
/// JavaScript without BigInt marshalling. The objective is bounded by roughly
/// n × skip_penalty ≈ 10¹⁰, which is exactly representable in `f64` — the limit
/// is 2⁵³, some four hundred thousand times larger.
///
/// The host re-scores the returned order anyway, and never trusts this number
/// for anything but progress reporting.
///
/// # Safety
/// `driver` must be a live pointer from `engine_create`.
#[no_mangle]
pub unsafe extern "C" fn engine_best_objective(driver: *const Driver) -> f64 {
    if driver.is_null() {
        return f64::INFINITY;
    }
    unsafe { &*driver }.best_objective() as f64
}

/// Completed perturbation-and-descent cycles, for progress reporting.
///
/// # Safety
/// `driver` must be a live pointer from `engine_create`.
#[no_mangle]
pub unsafe extern "C" fn engine_iterations(driver: *const Driver) -> u32 {
    if driver.is_null() {
        return 0;
    }
    unsafe { &*driver }.iterations()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    /// Drive the engine exactly as the loader will, through raw pointers.
    fn solve_through_ffi(n: usize, seed: u32, select_k: i32, start: i32, end: i32) -> Vec<i32> {
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
        if start >= 0 {
            optional[start as usize] = 0;
        }
        if end >= 0 {
            optional[end as usize] = 0;
        }

        unsafe {
            let driver = engine_create(
                n as u32,
                cells.as_ptr(),
                optional.as_ptr(),
                select_k,
                10_000_000,
                start,
                end,
                seed,
                std::ptr::null(),
                0,
                0,
            );
            assert!(!driver.is_null());

            for _ in 0..100_000 {
                if engine_step(driver, 64) == 1 {
                    break;
                }
            }

            let len = engine_best_len(driver) as usize;
            let ptr = engine_best_ptr(driver);
            let order = std::slice::from_raw_parts(ptr, len).to_vec();
            assert!(engine_best_objective(driver).is_finite());
            engine_destroy(driver);
            order
        }
    }

    #[test]
    fn a_solve_through_raw_pointers_returns_a_valid_route() {
        let order = solve_through_ffi(30, 4, -1, 0, 29);
        assert_eq!(order.len(), 30);
        assert_eq!(order[0], 0);
        assert_eq!(*order.last().unwrap(), 29);
        let mut seen = order.clone();
        seen.sort();
        assert_eq!(seen, (0..30i32).collect::<Vec<_>>());
    }

    #[test]
    fn the_k_cap_survives_the_boundary() {
        let order = solve_through_ffi(40, 7, 12, 0, 39);
        assert_eq!(order.len(), 14, "two pinned ends plus twelve optional stops");
    }

    /// Bad input must produce a null handle, not a trap. A wasm trap is
    /// unrecoverable and would take the worker down with it.
    #[test]
    fn malformed_requests_return_null() {
        let cells = vec![0i32; 9];
        let optional = vec![1u8; 3];
        unsafe {
            // Fewer than two nodes.
            assert!(engine_create(1, cells.as_ptr(), optional.as_ptr(), -1, 1, -1, -1, 0, std::ptr::null(), 0, 0).is_null());
            // Null matrix.
            assert!(engine_create(3, std::ptr::null(), optional.as_ptr(), -1, 1, -1, -1, 0, std::ptr::null(), 0, 0).is_null());
            // Endpoint outside the matrix.
            assert!(engine_create(3, cells.as_ptr(), optional.as_ptr(), -1, 1, 9, -1, 0, std::ptr::null(), 0, 0).is_null());
            // The same node pinned to both ends.
            assert!(engine_create(3, cells.as_ptr(), optional.as_ptr(), -1, 1, 2, 2, 0, std::ptr::null(), 0, 0).is_null());
        }
    }

    /// Null handles must be inert rather than fatal, so a loader bug degrades
    /// into a failed solve rather than a dead worker.
    #[test]
    fn null_handles_are_inert() {
        unsafe {
            assert_eq!(engine_step(std::ptr::null_mut(), 10), 1);
            assert_eq!(engine_best_len(std::ptr::null()), 0);
            assert!(engine_best_ptr(std::ptr::null()).is_null());
            assert_eq!(engine_iterations(std::ptr::null()), 0);
            assert!(engine_best_objective(std::ptr::null()).is_infinite());
            engine_destroy(std::ptr::null_mut());
        }
    }

    #[test]
    fn allocation_round_trips() {
        let ptr = engine_alloc(4096);
        assert!(!ptr.is_null());
        unsafe {
            std::ptr::write_bytes(ptr, 0xab, 4096);
            assert_eq!(*ptr, 0xab);
            engine_dealloc(ptr, 4096);
        }
        assert!(engine_alloc(0).is_null());
    }
}
