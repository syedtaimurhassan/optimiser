import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  claimedTier,
  describeSelection,
  registerEngine,
  registeredEngines,
  selectEngine,
  unregisterEngine,
} from './registry.ts'
import { engineTs } from './engineTs.ts'
import type { Capabilities } from '../device/capabilities.ts'

/** A device with nothing. Every test turns on only what it is about. */
function caps(overrides: Partial<Capabilities> = {}): Capabilities {
  return {
    wasm: true,
    crossOriginIsolated: false,
    sharedArrayBuffer: false,
    workers: true,
    hardwareConcurrency: 4,
    indexedDB: true,
    opfs: false,
    barcodeDetector: false,
    speechRecognition: false,
    geolocation: true,
    wakeLock: false,
    vibrate: false,
    webShare: false,
    webgpu: false,
    standalone: false,
    platform: 'android',
    devicePixelRatio: 2,
    touchPrimary: true,
    prefersReducedMotion: false,
    asyncResolved: true,
    wasmSimd: false,
    wasmThreads: false,
    storagePersisted: false,
    storageEstimate: null,
    ...overrides,
  }
}

describe('claimedTier', () => {
  test('no WebAssembly at all is tier D', () => {
    assert.equal(claimedTier(caps({ wasm: false })), 'D')
  })

  test('isolation plus SIMD plus threads is tier A', () => {
    const tier = claimedTier(
      caps({
        crossOriginIsolated: true,
        sharedArrayBuffer: true,
        wasmSimd: true,
        wasmThreads: true,
      }),
    )
    assert.equal(tier, 'A')
  })

  test('SIMD and workers without isolation is tier B — the common phone', () => {
    assert.equal(claimedTier(caps({ wasmSimd: true })), 'B')
  })

  test('losing isolation drops A to B and nothing else', () => {
    const full = { sharedArrayBuffer: true, wasmSimd: true, wasmThreads: true }
    assert.equal(claimedTier(caps({ ...full, crossOriginIsolated: true })), 'A')
    assert.equal(claimedTier(caps({ ...full, crossOriginIsolated: false })), 'B')
  })

  test('WASM but no SIMD is tier C', () => {
    assert.equal(claimedTier(caps({ wasmSimd: false })), 'C')
  })

  test('an unresolved probe is treated as absent, so the badge cannot flicker', () => {
    // wasmSimd undefined — the async probe has not landed yet.
    const pending = caps({ asyncResolved: false })
    delete (pending as { wasmSimd?: boolean }).wasmSimd
    assert.equal(claimedTier(pending), 'C')
  })
})

describe('selectEngine', () => {
  test('a browser with no workers still gets a working engine', () => {
    // Single core, no workers, no WebAssembly — the true floor.
    const selection = selectEngine(caps({ wasm: false, workers: false, hardwareConcurrency: 1 }))
    assert.equal(selection.engine, engineTs)
    assert.equal(selection.tier, 'D')
    assert.equal(selection.degraded, false)
  })

  test('a single-core device does not spawn a pool to race itself', () => {
    const selection = selectEngine(caps({ hardwareConcurrency: 1 }))
    assert.equal(selection.tier, 'D')
  })

  test('workers and more than one core get the pool', () => {
    const selection = selectEngine(caps({ hardwareConcurrency: 4, wasmSimd: true }))
    assert.equal(selection.tier, 'B')
    assert.equal(selection.engine.id, 'ts-workers')
    assert.equal(describeSelection(selection), 'Fast')
  })

  test('the pool does not need SIMD, even though the tier is defined by it', () => {
    // claimedTier says this device is a C (WASM, no SIMD). The pure-TypeScript
    // pool needs no vector instructions, so it runs anyway — a tier describes
    // the device, `supported` describes the engine.
    const selection = selectEngine(caps({ wasmSimd: false, hardwareConcurrency: 4 }))
    assert.equal(selection.claimed, 'C')
    assert.equal(selection.tier, 'B')
    assert.equal(selection.degraded, false)
  })

  test('a capable device with nothing built for it degrades, and says so', () => {
    // Turbo-capable, but M9 registers no tier A engine, so it runs Fast.
    const selection = selectEngine(
      caps({
        crossOriginIsolated: true,
        sharedArrayBuffer: true,
        wasmSimd: true,
        wasmThreads: true,
      }),
    )
    assert.equal(selection.claimed, 'A')
    assert.equal(selection.tier, 'B')
    assert.equal(selection.degraded, true)
    assert.equal(describeSelection(selection), 'Fast (device supports Turbo)')
  })

  test('a Turbo-capable device with no workers falls all the way to Basic', () => {
    const selection = selectEngine(
      caps({
        crossOriginIsolated: true,
        sharedArrayBuffer: true,
        wasmSimd: true,
        wasmThreads: true,
        workers: false,
      }),
    )
    assert.equal(describeSelection(selection), 'Basic (device supports Turbo)')
  })

  test('a registered better engine wins, and an unsupported one is skipped', () => {
    const before = registeredEngines().length
    registerEngine({
      id: 'test-b',
      tier: 'B',
      create: () => engineTs,
      supported: (c) => c.wasmSimd === true,
    })
    try {
      // SIMD present -> the tier B engine is chosen.
      const fast = selectEngine(caps({ wasmSimd: true }))
      assert.equal(fast.tier, 'B')

      // SIMD absent -> not supported, so selection falls past it. The worker
      // pool is also a B, so registration order within a tier decides; what
      // matters is that an unsupported engine is never chosen.
      const basic = selectEngine(caps({ wasmSimd: false, workers: false, hardwareConcurrency: 1 }))
      assert.equal(basic.tier, 'D')
    } finally {
      // Registering is global; leaving it behind would make the ORDER of the
      // test files decide what the other tests see.
      unregisterEngine('test-b')
      assert.equal(registeredEngines().length, before)
    }
  })

  test('registering the same id twice replaces rather than duplicates', () => {
    const before = registeredEngines().length
    registerEngine({ id: 'dupe', tier: 'C', create: () => engineTs, supported: () => false })
    registerEngine({ id: 'dupe', tier: 'C', create: () => engineTs, supported: () => false })
    assert.equal(registeredEngines().length, before + 1)
    assert.ok(unregisterEngine('dupe'))
    assert.equal(unregisterEngine('dupe'), false, 'removing twice is not an error')
  })

  test('an engine is not constructed just to be rejected', () => {
    let built = 0
    registerEngine({
      id: 'expensive',
      tier: 'A',
      create: () => {
        built++
        return engineTs
      },
      supported: () => false,
    })
    try {
      selectEngine(caps({ workers: false, hardwareConcurrency: 1 }))
      assert.equal(built, 0, 'an unsupported engine was constructed anyway')
    } finally {
      unregisterEngine('expensive')
    }
  })
})
