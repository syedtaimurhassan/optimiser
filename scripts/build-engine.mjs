/**
 * Build the Rust engine to wasm32 — twice — and check the artefacts.
 *
 * ── Two builds, because WebAssembly cannot branch on its own features ─────
 *
 * There is no runtime SIMD detection in wasm. rustc says so directly:
 * "WebAssembly does not currently have dynamic detection at runtime as to
 * whether SIMD is supported." The feature-detection proposal that would fix it
 * is still at the prototype stage. So a module either contains v128
 * instructions and requires an engine that understands them, or it does not.
 *
 * The answer is to compile both and let JavaScript choose, which is what
 * `loadEngine.ts` does with the `wasmSimd()` probe the app already has.
 *
 * ── The artefacts are COMMITTED ───────────────────────────────────────────
 *
 * `npm run build` must work on a machine with no Rust toolchain — a milestone
 * may not leave the app unbuildable, and requiring rustup to build a React app
 * would do exactly that. So this script is run by hand when the engine changes,
 * and its output goes into git.
 *
 * ── The checks are the point ──────────────────────────────────────────────
 *
 * Two properties are asserted here rather than asserted in prose:
 *
 *   1. The module imports NOTHING. This is the whole milestone. An engine that
 *      can call back into JavaScript is an engine that can end up doing it once
 *      per arc, which is precisely why the OR-Tools build takes twelve seconds
 *      on a ten-node model. If an import section ever appears, this build fails.
 *
 *   2. The declared maximum memory is bounded. iOS Safari refuses to construct
 *      a WebAssembly.Memory whose declared maximum is the usual 2 GB — the
 *      allocation fails up front, before a single byte is used.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CRATE = join(ROOT, 'engine')
const OUT = join(ROOT, 'src', 'lib', 'compute', 'wasm')

/** 256 MB — see engine/.cargo/config.toml. */
const MAX_MEMORY_BYTES = 268_435_456

/**
 * Find cargo.
 *
 * Homebrew's rustup formula is keg-only, so its shims are NOT on the default
 * PATH and are NOT in ~/.cargo/bin. A plain `cargo` may also resolve to the
 * Homebrew `rust` formula, which ships only the host target and fails with a
 * confusing "can't find crate for std".
 */
function findCargo() {
  const candidates = [
    process.env.CARGO,
    '/opt/homebrew/opt/rustup/bin/cargo',
    '/usr/local/opt/rustup/bin/cargo',
    join(process.env.HOME ?? '', '.cargo', 'bin', 'cargo'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return 'cargo'
}

const CARGO = findCargo()

function hasWasmTarget() {
  try {
    const out = execFileSync(CARGO, ['--version'], { encoding: 'utf8' })
    return out.includes('cargo')
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────── wasm inspection

/** Unsigned LEB128. */
function readVarUint(bytes, at) {
  let result = 0
  let shift = 0
  let index = at
  for (;;) {
    const byte = bytes[index++]
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return [result >>> 0, index]
}

/**
 * The declared limits of the module's memory, or null when it declares none.
 *
 * Section 5 is the memory section: a vector of limits, each a flags byte then a
 * minimum and — when flags bit 0 is set — a maximum, all in 64 KiB pages.
 * There is no JavaScript API that reports the declared maximum, so this reads
 * the bytes.
 */
function memoryLimits(bytes) {
  let at = 8 // magic + version
  while (at < bytes.length) {
    const id = bytes[at++]
    const [size, afterSize] = readVarUint(bytes, at)
    at = afterSize
    if (id === 5) {
      const [count, afterCount] = readVarUint(bytes, at)
      if (count === 0) return null
      let cursor = afterCount
      const [flags, afterFlags] = readVarUint(bytes, cursor)
      cursor = afterFlags
      const [min, afterMin] = readVarUint(bytes, cursor)
      cursor = afterMin
      let max = null
      if (flags & 0x01) {
        ;[max] = readVarUint(bytes, cursor)
      }
      return { min, max, shared: Boolean(flags & 0x02) }
    }
    at += size
  }
  return null
}

const PAGE = 65_536

function inspect(label, file) {
  const bytes = readFileSync(file)
  const module = new WebAssembly.Module(bytes)
  const imports = WebAssembly.Module.imports(module)
  const exports = WebAssembly.Module.exports(module).map((e) => e.name)
  const limits = memoryLimits(bytes)
  const problems = []

  // ── The milestone's central property ──
  if (imports.length > 0) {
    problems.push(
      `imports ${imports.length} item(s): ${imports
        .map((i) => `${i.module}.${i.name}`)
        .join(', ')}. The engine must not be able to call JavaScript — ` +
        `that is the mistake M10 exists to avoid.`,
    )
  }

  if (!limits) {
    problems.push('declares no memory at all')
  } else if (limits.max === null) {
    problems.push(
      'declares no MAXIMUM memory. iOS Safari needs a bounded declaration; ' +
        'check the --max-memory link arg in engine/.cargo/config.toml.',
    )
  } else if (limits.max * PAGE > MAX_MEMORY_BYTES) {
    problems.push(
      `declares a maximum of ${(limits.max * PAGE) / 1e6} MB, above the ` +
        `${MAX_MEMORY_BYTES / 1e6} MB ceiling.`,
    )
  }

  const required = [
    'engine_alloc',
    'engine_dealloc',
    'engine_create',
    'engine_destroy',
    'engine_step',
    'engine_best_ptr',
    'engine_best_len',
    'engine_best_objective',
    'engine_iterations',
  ]
  const missing = required.filter((name) => !exports.includes(name))
  if (missing.length > 0) problems.push(`missing exports: ${missing.join(', ')}`)

  return {
    label,
    bytes: statSync(file).size,
    imports: imports.length,
    maxMemoryMb: limits?.max != null ? (limits.max * PAGE) / 1e6 : null,
    problems,
  }
}

// ────────────────────────────────────────────────────────────────── build

function build({ label, simd, targetDir }) {
  const env = { ...process.env }

  /*
    Put cargo's own directory FIRST on PATH.

    Calling the rustup shim by absolute path is not enough: the shim execs the
    real cargo, which then looks up `rustc` on PATH. With Homebrew's `rust`
    formula installed that resolves to /opt/homebrew/bin/rustc — a different,
    older toolchain that ships only the host target. The build then fails with

        error[E0463]: can't find crate for `std`
        note: the `wasm32-unknown-unknown` target may not be installed

    which is a true statement about the wrong compiler, and sends you off to
    re-add a target that is already there.
  */
  env.PATH = `${dirname(CARGO)}:${env.PATH ?? ''}`

  /*
    Every flag, on every build, from HERE.

    Setting RUSTFLAGS makes cargo ignore the `rustflags` key in
    .cargo/config.toml entirely — it replaces them, it does not merge with them.
    So the first version of this script, which set RUSTFLAGS only for the SIMD
    build, produced a SIMD artefact with no --max-memory link arg and therefore
    no declared memory maximum.

    That is the exact configuration iOS Safari refuses to instantiate, in the
    build that only modern iPhones would ever load. It would have passed every
    desktop test and failed on the devices it was built for. The artefact check
    below caught it; keeping all the flags in one place is what stops it coming
    back.
  */
  const flags = [`-C link-arg=--max-memory=${MAX_MEMORY_BYTES}`]
  if (simd) flags.push('-C target-feature=+simd128')
  env.RUSTFLAGS = flags.join(' ')

  process.stdout.write(`building ${label}…\n`)
  execFileSync(
    CARGO,
    ['build', '--release', '--target', 'wasm32-unknown-unknown', '--target-dir', targetDir],
    { cwd: CRATE, env, stdio: 'inherit' },
  )
  return join(targetDir, 'wasm32-unknown-unknown', 'release', 'optimiser_engine.wasm')
}

function main() {
  if (!hasWasmTarget()) {
    console.error(
      `Could not run cargo (tried ${CARGO}).\n` +
        'Install the toolchain with:\n' +
        '  brew install rustup && rustup default stable\n' +
        '  rustup target add wasm32-unknown-unknown\n' +
        'or set CARGO to its path.',
    )
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })

  const builds = [
    { label: 'scalar', simd: false, targetDir: join(CRATE, 'target'), out: 'engine.wasm' },
    { label: 'simd', simd: true, targetDir: join(CRATE, 'target-simd'), out: 'engine-simd.wasm' },
  ]

  const reports = []
  for (const spec of builds) {
    const artefact = build(spec)
    const destination = join(OUT, spec.out)
    copyFileSync(artefact, destination)
    reports.push(inspect(spec.label, destination))
  }

  console.log('')
  console.log('artefact      size      imports   max memory')
  console.log('─────────────────────────────────────────────')
  for (const r of reports) {
    console.log(
      `${r.label.padEnd(12)}  ${(r.bytes / 1024).toFixed(1).padStart(6)} KB  ` +
        `${String(r.imports).padStart(7)}   ${r.maxMemoryMb ?? '?'} MB`,
    )
  }
  console.log('')

  const failed = reports.filter((r) => r.problems.length > 0)
  if (failed.length > 0) {
    for (const r of failed) {
      for (const problem of r.problems) console.error(`✗ ${r.label}: ${problem}`)
    }
    process.exit(1)
  }
  console.log('✓ both artefacts import nothing and declare a bounded memory')
}

main()
