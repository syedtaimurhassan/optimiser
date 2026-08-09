//! mulberry32, bit-for-bit identical to `makeRng` in `solverPort.ts`.
//!
//! Identical on purpose. The TypeScript engine is this engine's correctness
//! oracle, and a cross-check is only meaningful if both sides can be handed the
//! same seed and be expected to make the same random choices. A different PRNG
//! would turn every disagreement into an argument about whether the engines
//! diverged or merely rolled different numbers.
//!
//! JavaScript's `>>>`, `|0` and `Math.imul` are all 32-bit operations on the
//! same bit patterns Rust's `u32` uses, so the port is mechanical: `>>>` is
//! `>>` on `u32`, and `Math.imul` is `wrapping_mul`.

pub struct Rng {
    state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    /// Uniform in [0, 1).
    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let a = self.state;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }

    /// Uniform integer in [0, bound). Returns 0 when `bound` is 0.
    pub fn below(&mut self, bound: usize) -> usize {
        if bound == 0 {
            return 0;
        }
        let scaled = (self.next_f64() * bound as f64) as usize;
        // `next_f64` is strictly below 1, so this can only reach `bound` through
        // floating-point rounding at the very top of the range. Clamping is
        // cheaper than reasoning about whether it can.
        if scaled >= bound {
            bound - 1
        } else {
            scaled
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Values produced by the TypeScript `makeRng(12345)` for the first eight
    /// draws, transcribed from a Node run. If this test fails, the two engines
    /// have stopped being comparable and every cross-check below is void.
    #[test]
    fn matches_the_typescript_generator() {
        let mut rng = Rng::new(12345);
        let got: Vec<f64> = (0..8).map(|_| rng.next_f64()).collect();
        let want = [
            0.979_728_267_760_947_35,
            0.306_752_264_499_664_31,
            0.484_205_421_525_985_00,
            0.817_934_412_509_202_96,
            0.509_428_369_347_006_08,
            0.347_471_860_470_250_25,
            0.073_757_541_831_582_785,
            0.766_396_467_341_110_11,
        ];
        for (i, (g, w)) in got.iter().zip(want.iter()).enumerate() {
            assert!(
                (g - w).abs() < 1e-15,
                "draw {i}: rust produced {g}, typescript produced {w}"
            );
        }
    }

    #[test]
    fn below_stays_in_range() {
        let mut rng = Rng::new(7);
        for bound in 1..64usize {
            for _ in 0..200 {
                assert!(rng.below(bound) < bound);
            }
        }
        assert_eq!(rng.below(0), 0);
    }
}
