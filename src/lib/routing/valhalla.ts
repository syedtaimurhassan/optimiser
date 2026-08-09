/**
 * Valhalla on FOSSGIS — the fallback nobody needs a key for.
 *
 * The demo OSRM server is free, shared, and explicitly best-effort: it may be
 * withdrawn without notice and it rate-limits under load. A fallback that
 * needed a key would be no fallback at all for a route that has to work at a
 * kerb on one bar of signal, so this one deliberately needs nothing.
 *
 * ── Why it is a fallback and not a peer ───────────────────────────────────
 *
 * It is SLOW. Measured against the live service: 50×50 (2,500 cells) takes
 * ~8-12 s where OSRM answers 100×100 in 0.3 s. A 1×2,000 band took 85 s. It is
 * a degraded mode, and the service reports it as one.
 *
 * ── What it buys ──────────────────────────────────────────────────────────
 *
 * POST, so no URL ceiling — the one hard wall OSRM has. A 2,000-column band
 * that OSRM would 414 on goes through here untouched, which makes this the
 * escape hatch for a route too big for a GET.
 *
 *   cells      2,500 exactly — 50×50 succeeds, 100×100 returns
 *              {"error_code":150,"error":"Exceeded max locations: 2500"}
 *   CORS       `access-control-allow-origin: *`, and the preflight allows
 *              `X-Client-Id` — so the identifying header FOSSGIS asks for is
 *              one a browser can actually send. We send it.
 *   policy     Same fair-use lineage as the OSRM demo: 1 call/user/second,
 *              100/second across everyone.
 *
 * ── No geometry ───────────────────────────────────────────────────────────
 *
 * `route()` is deliberately not implemented. Valhalla returns an encoded
 * polyline at precision 6, which is a decoder's worth of code to draw a line
 * the app already knows how to draw straight and label `estimated`. If the
 * road geometry ever becomes load-bearing while OSRM is down, that is the
 * moment to write it — not before.
 */

import {
  RoutingError,
  fits,
  type MatrixBand,
  type MatrixProvider,
} from './types.ts'

export const VALHALLA_ID = 'valhalla'

const MATRIX_URL = 'https://valhalla1.openstreetmap.de/sources_to_targets'

/**
 * The header FOSSGIS asks apps to identify themselves with.
 *
 * Their request is that anyone shipping to end users says who they are, so
 * abuse can be traced to an app rather than to "browsers". Costs nothing and
 * is the only part of their policy a client-side app CAN honour — `User-Agent`
 * is a forbidden header name for `fetch`.
 */
const CLIENT_ID = 'syedtaimurhassan.github.io/optimiser'

/** It really is this slow. A 2,500-cell band regularly takes ten seconds. */
const TIMEOUT_MS = 90_000

interface ValhallaCell {
  from_index: number
  to_index: number
  /** Seconds, or null when there is no route. */
  time: number | null
  /** KILOMETRES, not metres. */
  distance: number | null
}

interface ValhallaMatrixResponse {
  sources_to_targets?: ValhallaCell[][]
  error?: string
  error_code?: number
}

export function createValhallaProvider(): MatrixProvider {
  const limits = {
    maxCells: 2_500,
    // The cell cap binds long before this does — a 1×2,000 band is legal and
    // was measured working, it just takes a minute and a half.
    maxPoints: 2_000,
    minRequestGapMs: 1_100,
  }

  return {
    id: VALHALLA_ID,
    label: 'Valhalla (FOSSGIS)',
    attribution: '© OpenStreetMap contributors · routing by Valhalla/FOSSGIS',
    limits,

    async table(band: MatrixBand) {
      if (band.sources.length === 0 || band.destinations.length === 0) return []
      if (!fits(limits, band.sources.length, band.destinations.length)) {
        throw new RoutingError(
          'tooBig',
          VALHALLA_ID,
          `Band of ${band.sources.length}×${band.destinations.length} exceeds Valhalla's 2,500 cells.`,
        )
      }

      const body = JSON.stringify({
        sources: band.sources.map((i) => ({
          lat: band.points[i].lat,
          lon: band.points[i].lng,
        })),
        targets: band.destinations.map((i) => ({
          lat: band.points[i].lat,
          lon: band.points[i].lng,
        })),
        costing: 'auto',
      })

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      const onAbort = () => controller.abort()
      band.signal?.addEventListener('abort', onAbort)

      let response: Response
      try {
        response = await fetch(MATRIX_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
          body,
          signal: controller.signal,
        })
      } catch (e) {
        if (band.signal?.aborted) throw new RoutingError('aborted', VALHALLA_ID, 'Cancelled.')
        throw new RoutingError(
          'network',
          VALHALLA_ID,
          `Could not reach Valhalla: ${(e as Error).message}`,
        )
      } finally {
        clearTimeout(timer)
        band.signal?.removeEventListener('abort', onAbort)
      }

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as ValhallaMatrixResponse | null
        // 150 is "Exceeded max locations", which is ours to fix by asking for
        // less — not a reason to go looking for another server.
        const kind =
          detail?.error_code === 150
            ? 'tooBig'
            : response.status === 429
              ? 'rateLimited'
              : 'network'
        throw new RoutingError(
          kind,
          VALHALLA_ID,
          `Valhalla matrix failed: ${detail?.error ?? `${response.status} ${response.statusText}`}`,
          response.status,
        )
      }

      const data = (await response.json()) as ValhallaMatrixResponse
      const rows = data.sources_to_targets
      if (!rows || rows.length !== band.sources.length) {
        throw new RoutingError(
          'badResponse',
          VALHALLA_ID,
          `Valhalla returned ${rows?.length ?? 0} rows, asked for ${band.sources.length}.`,
        )
      }

      /*
        Read each cell by ITS OWN from_index/to_index rather than by where it
        sits in the array. Valhalla reports both on every cell, and trusting
        position instead would make a reordered response silently price the
        wrong pair of stops — the one error class that never surfaces as an
        error, only as a route that is quietly a bit worse than it should be.
      */
      return band.sources.map((_, r) => {
        const out: (number | null)[] = Array.from<number | null>({
          length: band.destinations.length,
        }).fill(null)
        for (const cell of rows[r] ?? []) {
          if (cell.to_index < 0 || cell.to_index >= out.length) continue
          out[cell.to_index] =
            band.objective === 'distance'
              ? cell.distance == null
                ? null
                : cell.distance * 1000 // km → m
              : cell.time
        }
        return out
      })
    },
  }
}
