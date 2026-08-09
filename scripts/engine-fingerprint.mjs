/**
 * What the committed `.wasm` files were built from.
 *
 * ── The problem this solves ───────────────────────────────────────────────
 *
 * The artefacts are committed so that `npm run build` works without a Rust
 * toolchain. That is worth having, and it costs a new failure mode: the binary
 * and the source can disagree, and nothing about the repository looks wrong when
 * they do.
 *
 * It is not hypothetical. While measuring whether a longer budget helped, the
 * driver's `BARREN_RESTARTS` was temporarily set to 100000, the engine rebuilt,
 * the constant reverted — and the throwaway build was committed alongside the
 * restored source. Everything passed. The tests exercise the artefact, so they
 * happily verified the wrong engine.
 *
 * So the build records a fingerprint of every input, and a test recomputes it.
 * The check needs nothing but Node, which is the point: it has to run on a
 * machine that cannot rebuild the thing it is checking.
 *
 * ── The deliberate false positive ─────────────────────────────────────────
 *
 * `#[cfg(test)]` blocks are hashed even though they never reach a release
 * build, so editing a Rust test asks for a rebuild it does not strictly need.
 * That is the honest trade: deciding which bytes affect codegen is not something
 * this script can know, and the invariant stays one sentence — the artefact was
 * built from exactly this tree. The fix is `npm run engine:build`, which takes
 * about a second.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const MANIFEST = join(ROOT, 'src', 'lib', 'compute', 'wasm', 'manifest.json')

/**
 * Every file whose contents can change what the compiler emits.
 *
 * `build-engine.mjs` is in here because the RUSTFLAGS it passes are not in any
 * Cargo file — the SIMD switch and the memory cap live only in that script, and
 * a change to either produces a different artefact from identical Rust.
 */
function inputs() {
  const files = ['engine/Cargo.toml', 'engine/Cargo.lock', 'engine/.cargo/config.toml', 'scripts/build-engine.mjs']

  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory)).sort()) {
      const relativePath = `${directory}/${entry}`
      const full = join(ROOT, relativePath)
      if (statSync(full).isDirectory()) walk(relativePath)
      else if (entry.endsWith('.rs')) files.push(relativePath)
    }
  }
  walk('engine/src')

  return files.sort()
}

/** One hash over every input, path included so a rename counts as a change. */
export function sourceFingerprint() {
  const hash = createHash('sha256')
  for (const file of inputs()) {
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(join(ROOT, file)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export { ROOT }
