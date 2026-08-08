/**
 * The geocoding service: one object the app talks to, two providers behind it.
 *
 * What this module is really for is spending as few credits as possible while
 * still feeling instant, because the key is public and the quota is shared with
 * anyone who cares to read our bundle. Four mechanisms, in the order a
 * keystroke meets them:
 *
 *   1. **A minimum query length.** Two characters match half a country; the
 *      request would have been wasted anyway.
 *   2. **Debounce.** Only the query the user stopped typing on is ever sent.
 *   3. **The cache.** Prefix backspacing, repeated streets, and re-opening
 *      search on the same query all cost nothing.
 *   4. **In-flight coalescing.** Two callers asking the same question at the
 *      same time share one request.
 *
 * Only after all four does anything reach the network.
 *
 * ── Failover ──────────────────────────────────────────────────────────────
 *
 * On a rate-limit, an auth rejection or a network failure the call is retried
 * against the keyless fallback, and the service enters a DEGRADED state that
 * the UI is expected to show calmly — the results are still real, they are just
 * from a thinner index. A rate-limited primary is then left alone for a cooldown
 * rather than being retried on the next keystroke, because hammering an
 * exhausted quota is how you stay exhausted.
 */

import type { Address, LatLng } from '../../types.ts'
import { cacheKey, coordKey, type GeocodeCache } from './cache.ts'
import {
  GeocodingError,
  isFailoverWorthy,
  type AutocompleteOptions,
  type GeocodingProvider,
  type ReverseOptions,
  type Suggestion,
} from './types.ts'

/** Below this, no request is made at all. */
export const MIN_QUERY_LENGTH = 3

/**
 * Trailing-edge debounce, in ms.
 *
 * 350 is a deliberate compromise. A comfortable inter-key gap when typing an
 * address sits around 200-300ms, so a shorter window bills a request mid-word;
 * much longer and the list feels like it is lagging the keyboard. At 350 a
 * typical address entry costs 3-5 credits rather than one per character.
 */
export const DEBOUNCE_MS = 350

/** How long a rate-limited primary is left alone before we try it again. */
export const RATE_LIMIT_COOLDOWN_MS = 60_000

export interface GeocodingStatus {
  /** True when answers are coming from the fallback rather than the primary. */
  degraded: boolean
  /** Which provider served the most recent successful call. */
  activeProviderId: string
  reason?: 'rateLimited' | 'unauthorized' | 'network'
  /** Attribution for whichever provider is currently answering. */
  attribution: string
}

export interface GeocodingServiceOptions {
  primary: GeocodingProvider
  /** Optional, but the app is meaningfully worse without one. */
  fallback?: GeocodingProvider
  cache?: GeocodeCache
  minQueryLength?: number
  cooldownMs?: number
  now?: () => number
}

export interface GeocodingService {
  autocomplete(query: string, opts?: AutocompleteOptions): Promise<Suggestion[]>
  reverse(at: LatLng, opts?: ReverseOptions): Promise<Address | null>
  details(placeId: string, opts?: ReverseOptions): Promise<(Address & LatLng) | null>
  getStatus(): GeocodingStatus
  /** Returns an unsubscribe function. The store bridges this into React. */
  subscribe(listener: (status: GeocodingStatus) => void): () => void
}

export function createGeocodingService(opts: GeocodingServiceOptions): GeocodingService {
  const { primary, fallback, cache } = opts
  const minQueryLength = opts.minQueryLength ?? MIN_QUERY_LENGTH
  const cooldownMs = opts.cooldownMs ?? RATE_LIMIT_COOLDOWN_MS
  const now = opts.now ?? Date.now

  let status: GeocodingStatus = {
    degraded: false,
    activeProviderId: primary.id,
    attribution: primary.attribution,
  }
  const listeners = new Set<(s: GeocodingStatus) => void>()
  /** When the primary may be tried again. 0 means "now". */
  let primaryBlockedUntil = 0
  const inFlight = new Map<string, Promise<unknown>>()

  function setStatus(next: Partial<GeocodingStatus>) {
    const merged = { ...status, ...next }
    if (
      merged.degraded === status.degraded &&
      merged.activeProviderId === status.activeProviderId &&
      merged.reason === status.reason
    ) {
      return // Don't wake React for a no-op.
    }
    status = merged
    for (const l of listeners) l(status)
  }

  /**
   * Run `op` against the primary, then the fallback if that failed in a way
   * another provider might survive.
   *
   * An abort is never a failover: the user typed another character, and the
   * correct response to that is to stop, not to ask someone else the stale
   * question.
   */
  async function withFailover<T>(op: (p: GeocodingProvider) => Promise<T>): Promise<T> {
    if (now() >= primaryBlockedUntil) {
      try {
        const out = await op(primary)
        primaryBlockedUntil = 0
        setStatus({
          degraded: false,
          activeProviderId: primary.id,
          reason: undefined,
          attribution: primary.attribution,
        })
        return out
      } catch (e) {
        if (e instanceof GeocodingError && e.kind === 'aborted') throw e
        if (!fallback || !isFailoverWorthy(e)) throw e

        if (e instanceof GeocodingError && e.kind === 'rateLimited') {
          primaryBlockedUntil = now() + cooldownMs
        }
        if (e instanceof GeocodingError && e.kind === 'unauthorized') {
          // A rejected key does not heal on its own. Stop asking entirely
          // rather than burning a round trip per keystroke to be told again.
          primaryBlockedUntil = Number.POSITIVE_INFINITY
        }
        return runFallback(op, e as GeocodingError)
      }
    }

    if (!fallback) throw new GeocodingError('rateLimited', primary.id, 'primary in cooldown')
    return runFallback(op)
  }

  async function runFallback<T>(
    op: (p: GeocodingProvider) => Promise<T>,
    cause?: GeocodingError,
  ): Promise<T> {
    if (!fallback) throw new GeocodingError('network', primary.id, 'no fallback configured')
    const out = await op(fallback)
    setStatus({
      degraded: true,
      activeProviderId: fallback.id,
      // With no fresh cause this is a call taken during a cooldown, i.e. still
      // degraded for the reason established when the primary first failed.
      // Clearing it here would leave the UI saying "degraded" with nothing to
      // explain why, for every request after the first.
      reason:
        cause && cause.kind !== 'aborted'
          ? (cause.kind as GeocodingStatus['reason'])
          : status.reason,
      attribution: fallback.attribution,
    })
    return out
  }

  /** Share one promise between concurrent callers asking the identical question. */
  function coalesce<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key) as Promise<T> | undefined
    if (existing) return existing
    const p = run().finally(() => inFlight.delete(key))
    inFlight.set(key, p)
    return p
  }

  /**
   * The cache key must include everything that changes the ANSWER, or a search
   * biased to Copenhagen would serve its results to the same query typed in
   * Aarhus.
   *
   * The provider is deliberately NOT part of the key: a cached Photon result is
   * a perfectly good answer to the same question later, and re-billing Geoapify
   * for it would defeat the point of caching at all.
   */
  function variantFor(options: AutocompleteOptions): string {
    return [
      options.near ? coordKey(options.near.lat, options.near.lng) : '',
      options.countryCodes?.length ? options.countryCodes.join(',').toLowerCase() : '',
      options.lang ?? '',
      options.limit ? String(options.limit) : '',
    ].join('|')
  }

  return {
    async autocomplete(query, options = {}) {
      const q = query.trim()
      if (q.length < minQueryLength) return []

      const key = cacheKey('shared', 'autocomplete', q, variantFor(options))
      const hit = await cache?.get<Suggestion[]>(key)
      if (hit) return hit

      return coalesce(key, async () => {
        const results = await withFailover((p) => p.autocomplete(q, options))
        // Never cache an empty list: it is as often a transient provider hiccup
        // as a real "no such place", and caching it would pin that failure for
        // the whole TTL.
        if (results.length) await cache?.set(key, results)
        return results
      })
    },

    async reverse(at, options = {}) {
      const key = cacheKey('shared', 'reverse', coordKey(at.lat, at.lng), options.lang ?? '')
      const hit = await cache?.get<Address>(key)
      if (hit) return hit

      return coalesce(key, async () => {
        const address = await withFailover((p) => p.reverse(at, options))
        if (address) await cache?.set(key, address)
        return address
      })
    },

    async details(placeId, options = {}) {
      const key = cacheKey('shared', 'details', placeId, options.lang ?? '')
      const hit = await cache?.get<Address & LatLng>(key)
      if (hit) return hit

      return coalesce(key, async () => {
        // Both current providers return coordinates straight from autocomplete,
        // so neither implements `details`. The interface keeps the seam open for
        // a provider that bills a separate details call (Google's shape) without
        // every caller having to learn about it.
        const provider = now() >= primaryBlockedUntil ? primary : (fallback ?? primary)
        if (!provider.details) return null
        const out = await provider.details(placeId, options)
        if (out) await cache?.set(key, out)
        return out
      })
    },

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * A debounced, self-cancelling wrapper around one search field.
 *
 * Lives here rather than in a hook because the *policy* — how long to wait, and
 * that a superseded request must be aborted rather than merely ignored — is a
 * quota decision, not a rendering one. A component that forgot to abort would
 * silently double our spend, and that should not be possible to forget.
 */
export interface DebouncedSearch {
  search(query: string, opts?: AutocompleteOptions): void
  cancel(): void
}

export function createDebouncedSearch(
  service: Pick<GeocodingService, 'autocomplete'>,
  handlers: {
    onResults: (results: Suggestion[], query: string) => void
    onError?: (error: unknown, query: string) => void
    onPendingChange?: (pending: boolean) => void
  },
  delayMs = DEBOUNCE_MS,
): DebouncedSearch {
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let latest = 0

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = undefined
    controller?.abort()
    controller = undefined
    handlers.onPendingChange?.(false)
  }

  return {
    cancel,
    search(query, options = {}) {
      if (timer) clearTimeout(timer)
      controller?.abort()

      const q = query.trim()
      if (q.length < MIN_QUERY_LENGTH) {
        // Clear immediately rather than after the debounce: an emptied field
        // that keeps showing its old results for another 350ms looks broken.
        handlers.onPendingChange?.(false)
        handlers.onResults([], q)
        return
      }

      handlers.onPendingChange?.(true)
      const seq = ++latest

      timer = setTimeout(() => {
        controller = new AbortController()
        service
          .autocomplete(q, { ...options, signal: controller.signal })
          .then((results) => {
            // Out-of-order guard: a slow earlier request must not overwrite a
            // fast later one. Aborting is not instantaneous, so sequencing is
            // what actually guarantees this, not the AbortController.
            if (seq !== latest) return
            handlers.onPendingChange?.(false)
            handlers.onResults(results, q)
          })
          .catch((e) => {
            if (seq !== latest) return
            if (e instanceof GeocodingError && e.kind === 'aborted') return
            handlers.onPendingChange?.(false)
            handlers.onError?.(e, q)
          })
      }, delayMs)
    },
  }
}
