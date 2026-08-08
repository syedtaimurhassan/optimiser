import { detectSync, type Capabilities } from '../device/capabilities.ts'
import { selectEngine, type EngineSelection } from './registry.ts'

/**
 * The engine this session is using.
 *
 * ── Why a module-level singleton ──────────────────────────────────────────
 *
 * Selection depends on capabilities, and capabilities arrive in two waves: the
 * cheap synchronous probes at boot, then SIMD/threads a moment later once
 * something has been compiled. Two callers resolving independently would
 * disagree during that window — the pipeline running one engine while the badge
 * named another — so there is exactly one answer and it is here.
 *
 * ── Why not in a store ────────────────────────────────────────────────────
 *
 * Because `lib/` may not import the store, and `planRoute` lives in `lib/`.
 * The store OWNS the decision to refresh (it is the thing that probes); this
 * module owns the answer. `deviceStore` calls `refreshActiveEngine` when the
 * async probes land, and everything else reads.
 */

let current: EngineSelection | null = null

/**
 * The current selection, resolving from the synchronous probes if nothing has
 * refreshed it yet.
 *
 * The pre-probe answer is deliberately pessimistic rather than absent: a solve
 * that started before SIMD detection finished should run on the engine we are
 * sure of, not wait, and not throw.
 */
export function activeSelection(): EngineSelection {
  if (!current) current = selectEngine({ ...detectSync(), asyncResolved: false })
  return current
}

/** Re-select once fuller capabilities are known. Returns the new selection. */
export function refreshActiveEngine(capabilities: Capabilities): EngineSelection {
  current = selectEngine(capabilities)
  return current
}

/** Forget the selection. Tests only — registering an engine invalidates it. */
export function resetActiveEngine(): void {
  current = null
}
