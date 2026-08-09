//! The route optimiser's search engine, in Rust, compiled to wasm32.
//!
//! ── The one rule ──────────────────────────────────────────────────────────
//!
//! The matrix and every working array live inside WASM linear memory. JS writes
//! the inputs once, calls in, and reads one result buffer back. **No JS closure
//! is ever invoked from inside the search.**
//!
//! That is not a stylistic preference. The engine this replaces —
//! `or-tools-wasm` 0.9.1 — installs a JavaScript transit-cost callback and
//! invokes it once per ARC EVALUATION, which is why `BEST_INSERTION` takes over
//! twelve seconds on a ten-node model. This crate cannot make that mistake even
//! by accident: it declares no imports at all, so there is nothing for it to
//! call. `ffi::tests::the_module_imports_nothing` asserts it against the built
//! artefact rather than trusting this comment.
//!
//! ── Why it is a state machine ─────────────────────────────────────────────
//!
//! A wasm call cannot yield. The TypeScript engine keeps the UI alive by
//! awaiting a macrotask every ~12 ms, and its worker uses those same yields as
//! the only chance a queued `cancel` message has to be delivered. Neither is
//! available here, and since M9 removed cross-origin isolation there is no
//! `SharedArrayBuffer` for a cancel flag either.
//!
//! So the search is resumable. `driver::Driver` is a state machine whose entire
//! state lives in its own fields, and `engine_step` runs it for a bounded amount
//! of work and returns. The host checks the clock and the abort signal between
//! steps and decides whether to call again. Cancellation latency is one step,
//! which the host sizes to about 15 ms.
//!
//! ── Layering ──────────────────────────────────────────────────────────────
//!
//! This crate knows nothing about routes, stops, coordinates, or HTTP. It is
//! handed integers and returns integers. `lib/compute/` on the TypeScript side
//! owns every question about what those integers mean.

pub mod matrix;
pub mod problem;
pub mod rng;
pub mod tour;
