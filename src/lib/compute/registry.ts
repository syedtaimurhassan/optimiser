import type { Capabilities } from '../device/capabilities.ts'
import { engineTs } from './engineTs.ts'
import type { SolverEngine } from './solverPort.ts'

/**
 * Which engine this device gets, and why.
 *
 * ── Tiers are about SPEED, never about features ───────────────────────────
 *
 * This is the rule the whole file exists to enforce. Every tier solves the
 * same problem with the same constraints and returns the same shape; a slower
 * tier takes longer or returns a slightly worse route, and that is the ONLY
 * difference a user can observe. Nothing is gated on a tier.
 *
 * The reason is not purity. A feature gated on a capability becomes a bug
 * report that cannot be reproduced — the person reporting it has a phone where
 * the button does something else, and no amount of reading the code will show
 * you that. Degrading speed is debuggable; degrading behaviour is not.
 *
 * ── The tiers ─────────────────────────────────────────────────────────────
 *
 *   A  Turbo      cross-origin isolated + SIMD + threads — shared-memory
 *                 parallel search.                            (M15)
 *   B  Fast       workers + SIMD, no isolation needed — N independent
 *                 workers, best-of.                           (M9, default)
 *   C  Standard   single-threaded WASM.                       (M10)
 *   D  Basic      pure TypeScript. Always works.               (M9)
 *
 * ── Claimed vs resolved ───────────────────────────────────────────────────
 *
 * A device is CAPABLE of a tier, and separately an engine is REGISTERED for
 * one. Those are different questions and conflating them is how you ship a
 * blank screen: in M9 there is no WASM engine at all, so a phone that could
 * run tier A resolves to tier B, and the badge should say so honestly rather
 * than claiming a Turbo that does not exist.
 *
 * Pure `lib/`: capabilities arrive as an argument. This module never asks the
 * browser anything, which is what makes forcing a tier off in a test possible.
 */

export type EngineTier = 'A' | 'B' | 'C' | 'D'

export interface TierInfo {
  tier: EngineTier
  /** What to show a human. */
  label: string
}

export const TIERS: Record<EngineTier, TierInfo> = {
  A: { tier: 'A', label: 'Turbo' },
  B: { tier: 'B', label: 'Fast' },
  C: { tier: 'C', label: 'Standard' },
  D: { tier: 'D', label: 'Basic' },
}

/** An engine plus the conditions under which it is allowed to run. */
export interface RegisteredEngine {
  id: string
  tier: EngineTier
  /** Built lazily: a tier-C engine must not download its WASM to be rejected. */
  create: () => SolverEngine
  /** Everything this engine needs from the browser. */
  supported: (caps: Capabilities) => boolean
}

/**
 * Highest tier the DEVICE could support, ignoring what we have actually built.
 *
 * `wasmSimd`/`wasmThreads` are undefined until the async probes land, and an
 * undefined capability is treated as absent — reporting a tier we are not yet
 * sure of, and then quietly dropping to a lower one a moment later, would make
 * the badge flicker between two claims about the same device.
 */
export function claimedTier(caps: Capabilities): EngineTier {
  if (!caps.wasm) return 'D'
  if (caps.crossOriginIsolated && caps.sharedArrayBuffer && caps.wasmSimd && caps.wasmThreads) {
    return 'A'
  }
  if (caps.workers && caps.wasmSimd) return 'B'
  return 'C'
}

/**
 * The registry, best tier first.
 *
 * Deliberately a plain array rather than a map: selection walks it in order and
 * takes the first engine this device supports, so the order IS the policy and
 * is visible in one place.
 */
const REGISTRY: RegisteredEngine[] = []

export function registerEngine(engine: RegisteredEngine): void {
  const existing = REGISTRY.findIndex((e) => e.id === engine.id)
  if (existing >= 0) REGISTRY.splice(existing, 1)
  REGISTRY.push(engine)
  REGISTRY.sort((a, b) => a.tier.localeCompare(b.tier))
}

/** Remove an engine. Returns whether there was one to remove. */
export function unregisterEngine(id: string): boolean {
  const at = REGISTRY.findIndex((e) => e.id === id)
  if (at < 0) return false
  REGISTRY.splice(at, 1)
  return true
}

export function registeredEngines(): readonly RegisteredEngine[] {
  return REGISTRY
}

/** Tier D. Needs nothing, which is the point of it. */
registerEngine({
  id: 'ts',
  tier: 'D',
  create: () => engineTs,
  supported: () => true,
})

export interface EngineSelection {
  engine: SolverEngine
  /** The tier we are actually running in. */
  tier: EngineTier
  label: string
  /** The best tier the device could have run, had we built an engine for it. */
  claimed: EngineTier
  /** True when no engine exists for the device's claimed tier. */
  degraded: boolean
}

/**
 * Pick an engine.
 *
 * Walks the registry from the best tier down and takes the first one this
 * device supports. Tier D is unconditional, so this cannot fail — a browser
 * with no WebAssembly, no workers and no isolation still gets a working
 * optimiser, just a slower one.
 */
export function selectEngine(caps: Capabilities): EngineSelection {
  const claimed = claimedTier(caps)

  for (const candidate of REGISTRY) {
    if (!candidate.supported(caps)) continue
    return {
      engine: candidate.create(),
      tier: candidate.tier,
      label: TIERS[candidate.tier].label,
      claimed,
      degraded: candidate.tier > claimed,
    }
  }

  // Unreachable while tier D is registered, and a real error if it ever is not.
  throw new Error('No solver engine is available in this browser.')
}

/**
 * The badge text.
 *
 * Says what is RUNNING, and admits it when the device could have done better —
 * "Basic (device supports Fast)" is a bug report waiting to be filed, which is
 * exactly what we want from it.
 */
export function describeSelection(selection: EngineSelection): string {
  if (!selection.degraded) return selection.label
  return `${selection.label} (device supports ${TIERS[selection.claimed].label})`
}
