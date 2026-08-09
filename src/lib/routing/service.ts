/**
 * The routing service: one object the app talks to, two providers behind it.
 *
 * Three jobs, none of which belong in an adapter:
 *
 *   1. **Splitting.** A caller asks for the band it wants; the service asks for
 *      the bands the provider will accept. Which is which depends on numbers
 *      that differ 4× between our two providers.
 *   2. **Pacing.** Both services are free, both ask for ≤1 request per second,
 *      and both are shared with everyone else using them. Requests to one
 *      provider are serialised through a queue with a gap — not merely delayed,
 *      because two parallel callers each sleeping 1.1 s still make two
 *      simultaneous requests.
 *   3. **Failover.** A rate limit or an outage on the demo server is a normal
 *      Tuesday, not an exception. The fallback is keyless for exactly this
 *      reason, and the service reports a DEGRADED state the UI can show calmly.
 *
 * `tooBig` never fails over. Every fallback we have accepts LESS than the
 * primary, so retrying a too-large request elsewhere converts a caller bug into
 * a slower caller bug. It re-splits instead.
 */

import {
  RoutingError,
  isFailoverWorthy,
  type MatrixBand,
  type MatrixProvider,
  type ProviderLimits,
  type RouteGeometry,
} from './types.ts'

/** Progress across a multi-request fetch: (completed, total). */
export type MatrixProgress = (done: number, total: number) => void

export interface RoutingStatus {
  /** True when work is coming from the fallback rather than the primary. */
  degraded: boolean
  activeProviderId: string
  reason?: 'rateLimited' | 'network' | 'badResponse'
  attribution: string
}

export interface RoutingService {
  /**
   * The band, whole, however many requests that takes.
   *
   * Returns `sources.length` rows of `destinations.length` cells in the order
   * asked for. Cells are raw provider values — `null` for unroutable — because
   * the caller decides what an unroutable arc costs, and rounding here would
   * throw away the only information that distinguishes "no road" from "far".
   */
  table(band: MatrixBand, onProgress?: MatrixProgress): Promise<(number | null)[][]>
  route(points: readonly { lat: number; lng: number }[], signal?: AbortSignal): Promise<RouteGeometry>
  /** The active provider's limits — what `cover.ts` plans against. */
  limits(): ProviderLimits
  getStatus(): RoutingStatus
}

export interface RoutingServiceOptions {
  primary: MatrixProvider
  fallback?: MatrixProvider
  /** How long a rate-limited primary is left alone before we try it again. */
  cooldownMs?: number
  now?: () => number
  /** Test seam: pacing is real time, and a test should not spend it. */
  sleep?: (ms: number) => Promise<void>
  /**
   * Called with the outcome of every real request: did we reach anything.
   *
   * This is where the app's offline signal actually comes from. `navigator.onLine`
   * reports whether an interface is up, which a van in a tunnel and a laptop
   * behind a captive portal both answer yes to. Requests that time out are the
   * truth, and this is the only layer that sees them all.
   */
  onOutcome?: (reached: boolean) => void
}

const DEFAULT_COOLDOWN_MS = 60_000

/**
 * Split a band into pieces the provider will accept.
 *
 * Rows first, because a matrix API's natural unit is "these origins against
 * those destinations" and splitting rows keeps every piece a contiguous slice
 * of the answer. Columns only when a SINGLE row is still too wide, which
 * happens when destinations alone exceed the cell budget or the point cap.
 *
 * `maxPoints` doubles as the URL guard. For OSRM the 450-point cap IS the
 * 8,192-byte ceiling expressed in coordinates, so a band that satisfies the
 * point cap satisfies the URL cap by construction.
 */
export function splitBand(band: MatrixBand, limits: ProviderLimits): MatrixBand[] {
  const { sources, destinations } = band
  if (sources.length === 0 || destinations.length === 0) return []

  // Widest column block this provider will take, given it must also carry its
  // own source rows in the same coordinate list.
  const maxCols = Math.max(1, Math.min(destinations.length, limits.maxPoints - 1, limits.maxCells))
  const out: MatrixBand[] = []

  for (let c = 0; c < destinations.length; c += maxCols) {
    const cols = destinations.slice(c, c + maxCols)
    const maxRows = Math.max(
      1,
      Math.min(Math.floor(limits.maxCells / cols.length), limits.maxPoints - cols.length),
    )
    for (let r = 0; r < sources.length; r += maxRows) {
      out.push({ ...band, sources: sources.slice(r, r + maxRows), destinations: cols })
    }
  }
  return out
}

/**
 * Stitch split pieces back into one grid.
 *
 * Every piece knows which sources and destinations it covers, so the join is by
 * index rather than by arrival order — pieces are fetched sequentially today,
 * and an assumption about that would break the first time they are not.
 */
function stitch(
  band: MatrixBand,
  pieces: { band: MatrixBand; rows: (number | null)[][] }[],
): (number | null)[][] {
  const rowAt = new Map(band.sources.map((s, i) => [s, i]))
  const colAt = new Map(band.destinations.map((d, i) => [d, i]))
  const out: (number | null)[][] = band.sources.map(() =>
    Array.from<number | null>({ length: band.destinations.length }).fill(null),
  )
  for (const piece of pieces) {
    piece.band.sources.forEach((s, r) => {
      const row = rowAt.get(s)
      if (row === undefined) return
      piece.band.destinations.forEach((d, c) => {
        const col = colAt.get(d)
        if (col === undefined) return
        out[row][col] = piece.rows[r]?.[c] ?? null
      })
    })
  }
  return out
}

/**
 * Split a long sequence into chunks the provider will draw.
 *
 * Consecutive chunks OVERLAP by one point: the last stop of one is the first
 * stop of the next, so the road between them is drawn exactly once and no leg
 * goes missing. Without the overlap a 500-stop route would come back with a
 * gap in the polyline and 498 legs for 499 gaps, which shifts every arrival
 * after the seam by one stop.
 *
 * The margin below the point cap is deliberate: 450 coordinates is 8,179 URL
 * characters against nginx's 8,192, and a route request that came in three
 * characters under the ceiling would be a bug waiting for a longitude with an
 * extra digit.
 */
export function splitRoute<T>(points: readonly T[], limits: ProviderLimits): T[][] {
  const perChunk = Math.max(2, limits.maxPoints - 50)
  if (points.length <= perChunk) return [[...points]]

  const chunks: T[][] = []
  for (let start = 0; start < points.length - 1; start += perChunk - 1) {
    chunks.push(points.slice(start, start + perChunk))
  }
  return chunks
}

/** Stitch drawn chunks back into one route. */
function joinRoutes(parts: RouteGeometry[]): RouteGeometry {
  const coordinates: number[][] = []
  const legSeconds: number[] = []
  const legMeters: number[] = []
  let distanceMeters = 0
  let durationSeconds = 0

  for (const [index, part] of parts.entries()) {
    // The shared waypoint is the last coordinate of one chunk and the first of
    // the next; drawing it twice would put a zero-length leg in the polyline.
    const shape = part.geometry.coordinates as number[][]
    coordinates.push(...(index === 0 ? shape : shape.slice(1)))
    legSeconds.push(...part.legSeconds)
    legMeters.push(...part.legMeters)
    distanceMeters += part.distanceMeters
    durationSeconds += part.durationSeconds
  }

  return {
    geometry: { type: 'LineString', coordinates },
    distanceMeters,
    durationSeconds,
    // One chunk with a leg-count mismatch poisons the whole list, because a
    // short array shifts every arrival after it. All or nothing.
    legSeconds: parts.every((p) => p.legSeconds.length > 0) ? legSeconds : [],
    legMeters: parts.every((p) => p.legMeters.length > 0) ? legMeters : [],
  }
}

export function createRoutingService(options: RoutingServiceOptions): RoutingService {
  const { primary, fallback } = options
  const now = options.now ?? (() => Date.now())
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS

  let status: RoutingStatus = {
    degraded: false,
    activeProviderId: primary.id,
    attribution: primary.attribution,
  }
  /** When the primary may be tried again. Zero means "now". */
  let primaryBlockedUntil = 0

  /** Per-provider serialisation, so pacing is a real gap and not a hope. */
  const queues = new Map<string, Promise<unknown>>()
  const lastRequestAt = new Map<string, number>()

  function paced<T>(provider: MatrixProvider, work: () => Promise<T>): Promise<T> {
    const previous = queues.get(provider.id) ?? Promise.resolve()
    const next = previous.then(async () => {
      // The gap is BETWEEN requests. Sleeping before the first one would put a
      // second of latency on every cold solve to buy nobody anything.
      const last = lastRequestAt.get(provider.id)
      const wait = last === undefined ? 0 : provider.limits.minRequestGapMs - (now() - last)
      if (wait > 0) await sleep(wait)
      try {
        const result = await work()
        options.onOutcome?.(true)
        return result
      } catch (e) {
        // Only a NETWORK failure says anything about reachability. A 429 or a
        // malformed response means we got there and were turned away, which is
        // the opposite of being offline.
        if (e instanceof RoutingError && e.kind === 'network') options.onOutcome?.(false)
        throw e
      } finally {
        lastRequestAt.set(provider.id, now())
      }
    })
    // A failed call must not poison the queue for the next one.
    queues.set(
      provider.id,
      next.catch(() => undefined),
    )
    return next
  }

  function markDegraded(e: RoutingError, switchingTo: MatrixProvider) {
    status = {
      degraded: switchingTo.id !== primary.id,
      activeProviderId: switchingTo.id,
      reason:
        e.kind === 'rateLimited' ? 'rateLimited' : e.kind === 'network' ? 'network' : 'badResponse',
      attribution: switchingTo.attribution,
    }
    // Hammering an exhausted quota is how you stay exhausted. Same cooldown
    // rule `lib/geocoding/service.ts` already applies to the geocoder.
    if (e.kind === 'rateLimited' && switchingTo.id !== primary.id) {
      primaryBlockedUntil = now() + cooldownMs
    }
  }

  function markHealthy() {
    if (!status.degraded) return
    status = { degraded: false, activeProviderId: primary.id, attribution: primary.attribution }
  }

  /** Whichever provider we should be asking right now. */
  const preferred = () => (fallback && now() < primaryBlockedUntil ? fallback : primary)

  async function withFailover<T>(
    run: (provider: MatrixProvider) => Promise<T>,
    supports: (provider: MatrixProvider) => boolean,
  ): Promise<T> {
    const candidates = [preferred(), primary, fallback].filter(
      (p): p is MatrixProvider => p !== undefined && supports(p),
    )
    const first = candidates[0]
    if (!first) {
      throw new RoutingError('badResponse', primary.id, 'No configured provider can do that.')
    }
    try {
      const result = await run(first)
      if (first === primary) markHealthy()
      return result
    } catch (e) {
      const second = candidates.find((p) => p !== first)
      if (!second || !isFailoverWorthy(e)) throw e
      markDegraded(e as RoutingError, second)
      return run(second)
    }
  }

  return {
    async table(band, onProgress) {
      if (band.sources.length === 0 || band.destinations.length === 0) return []

      return withFailover(
        async (provider) => {
          const pieces = splitBand(band, provider.limits)
          const done: { band: MatrixBand; rows: (number | null)[][] }[] = []
          for (const piece of pieces) {
            const rows = await paced(provider, () => provider.table(piece))
            done.push({ band: piece, rows })
            onProgress?.(done.length, pieces.length)
          }
          return stitch(band, done)
        },
        () => true,
      )
    },

    async route(points, signal) {
      return withFailover(
        async (provider) => {
          const chunks = splitRoute(points, provider.limits)
          if (chunks.length === 1) {
            return paced(provider, () => provider.route!(chunks[0], signal))
          }
          const drawn = []
          for (const chunk of chunks) {
            drawn.push(await paced(provider, () => provider.route!(chunk, signal)))
          }
          return joinRoutes(drawn)
        },
        (provider) => typeof provider.route === 'function',
      )
    },

    limits: () => preferred().limits,
    getStatus: () => status,
  }
}
