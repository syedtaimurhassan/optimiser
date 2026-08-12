import { create } from 'zustand'
import {
  detectSync,
  detectAsync,
  estimateStorage,
  requestPersistentStorage,
  type Capabilities,
} from '../lib/device/capabilities'
import { refreshActiveEngine } from '../lib/compute/active'

/**
 * Coarse capability tier, so components ask "can this device cope" rather than
 * re-deriving policy from a dozen booleans at every call site.
 *
 * Deliberately NOT about raw speed — we can't measure that at boot without
 * spending the very budget we're trying to protect. It's about headroom.
 */
export type DeviceTier = 'full' | 'limited' | 'minimal'

interface DeviceState {
  capabilities: Capabilities
  tier: DeviceTier
  /** True once the async probes have landed. */
  ready: boolean
  /** Kick off the async probes. Idempotent. */
  probe: () => Promise<void>
  /**
   * Re-ask about storage, and re-request protection.
   *
   * Separate from `probe` because `probe` is idempotent by design and this
   * deliberately is not. Chromium grants persistence on engagement heuristics
   * that change as the app is used, so a `false` at boot on day one can become
   * a `true` on day three — and Settings is where someone goes to find out.
   * Asking again is free and occasionally works.
   */
  refreshStorage: () => Promise<void>
}

/**
 * `full`    — desktop-class headroom: 4+ cores and persistent storage granted.
 * `limited` — a normal phone. The default assumption; nothing is disabled.
 * `minimal` — no IndexedDB or no WebAssembly. Something we depend on is absent,
 *             so features should degrade rather than fail.
 */
function classify(caps: Capabilities): DeviceTier {
  if (!caps.indexedDB || !caps.wasm) return 'minimal'
  const cores = caps.hardwareConcurrency ?? 2
  if (cores >= 4 && caps.storagePersisted) return 'full'
  return 'limited'
}

const initial: Capabilities = { ...detectSync(), asyncResolved: false }

export const useDeviceStore = create<DeviceState>()((set, get) => ({
  capabilities: initial,
  tier: classify(initial),
  ready: false,

  probe: async () => {
    if (get().ready) return
    // Never let a capability probe take the app down — an unknown capability is
    // survivable, a boot crash is not.
    try {
      const async = await detectAsync()
      set((s) => {
        const capabilities: Capabilities = { ...s.capabilities, ...async, asyncResolved: true }
        // SIMD and threads are exactly the probes engine selection turns on, so
        // this is the moment the registry can stop being pessimistic. Re-select
        // here rather than letting each caller resolve for itself, or the
        // pipeline and the badge would disagree during the gap.
        refreshActiveEngine(capabilities)
        return { capabilities, tier: classify(capabilities), ready: true }
      })
    } catch {
      set({ ready: true })
    }
  },

  refreshStorage: async () => {
    try {
      const [storagePersisted, storageEstimate] = await Promise.all([
        requestPersistentStorage(),
        estimateStorage(),
      ])
      set((s) => {
        const capabilities: Capabilities = { ...s.capabilities, storagePersisted, storageEstimate }
        // Persistence is one of the two inputs to `classify`, so a grant can
        // legitimately move a device from `limited` to `full`.
        return { capabilities, tier: classify(capabilities) }
      })
    } catch {
      // Same rule as `probe`: a storage question is never worth a crash.
    }
  },
}))
