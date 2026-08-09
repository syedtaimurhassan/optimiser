import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — a plain .mjs helper, shared with the build script so the
// fingerprint is computed by one piece of code rather than two that must agree.
import { sourceFingerprint, MANIFEST, ROOT } from '../../../scripts/engine-fingerprint.mjs'

/**
 * Do the committed `.wasm` files still match the committed Rust?
 *
 * The artefacts are checked in so the app builds without a Rust toolchain. The
 * cost of that is a failure mode with no outward symptom: the binary and the
 * source drift apart, every test still passes — because the tests run the
 * BINARY — and the repository looks entirely healthy.
 *
 * That happened during M10. A constant was changed to run an experiment, the
 * engine rebuilt, the constant reverted, and the experimental binary committed
 * next to the restored source. Twelve engine tests passed against the wrong
 * engine.
 *
 * This is the check that would have caught it, and it deliberately needs nothing
 * but Node: it has to be able to run on a machine that cannot rebuild the thing
 * it is checking.
 */

const REBUILD = 'run `npm run engine:build` and commit the result'

describe('the committed wasm artefacts', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    source: string
    artefacts: Record<string, { bytes: number; sha256: string }>
  }

  test('were built from the Rust that is committed alongside them', () => {
    assert.equal(
      sourceFingerprint(),
      manifest.source,
      `engine/ has changed since the .wasm files were built — ${REBUILD}`,
    )
  })

  test('are byte-for-byte what the build recorded', () => {
    for (const [name, expected] of Object.entries(manifest.artefacts)) {
      const bytes = readFileSync(fileURLToPath(new URL(`./wasm/${name}`, import.meta.url)))
      assert.equal(bytes.length, expected.bytes, `${name}: size changed — ${REBUILD}`)
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        expected.sha256,
        `${name}: contents changed — ${REBUILD}`,
      )
    }
  })

  test('are both present, and small', () => {
    const names = Object.keys(manifest.artefacts)
    assert.deepEqual(names.sort(), ['engine-simd.wasm', 'engine.wasm'])

    // We replaced a ~16 MB dependency. If an artefact ever approaches a
    // megabyte, something has been linked in that has no business being here.
    for (const [name, { bytes }] of Object.entries(manifest.artefacts)) {
      assert.ok(bytes < 1_000_000, `${name} is ${(bytes / 1024).toFixed(0)} KB, which is too big`)
    }
  })

  test('the fingerprint actually reacts to a source change', () => {
    // A fingerprint that ignored its inputs would pass every test above while
    // guaranteeing nothing at all.
    const before = sourceFingerprint()
    const driver = `${ROOT}/engine/src/driver.rs`
    const original = readFileSync(driver)
    try {
      writeFileSync(driver, Buffer.concat([original, Buffer.from('\n// probe\n')]))
      assert.notEqual(sourceFingerprint(), before, 'the fingerprint ignored a source edit')
    } finally {
      // Restored here rather than after the assertion: a failure above must not
      // be able to leave a stray line in the engine's source.
      writeFileSync(driver, original)
    }
    assert.equal(sourceFingerprint(), before, 'the probe was not cleaned up')
  })
})
