import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RouteRow, StopRowModel } from '../../lib/routeList.ts'
import { existingSectionLabel, findStopsInRoute } from '../../lib/searchScreen.ts'
import { getGeocodingService } from '../../lib/geocoding'
import {
  createDebouncedSearch,
  MIN_QUERY_LENGTH,
  type DebouncedSearch,
  type GeocodingStatus,
} from '../../lib/geocoding/service.ts'
import type { Suggestion } from '../../lib/geocoding/types.ts'
import type { LatLng } from '../../types.ts'
import { StopRow } from '../sheet/StopRow'
import { SuggestionRow } from './SuggestionRow'
import { SearchTiles, type SearchTileId } from './SearchTiles'
import { PinPlusDashedIcon } from '../ui/icons'

/**
 * The search screen — the smartest screen in the design, and the one M6 exists
 * for.
 *
 * One field, two answers, no mode switch:
 *
 *   "From this route (N)"   existing stops, rendered with the IDENTICAL StopRow
 *                           the route list uses — sequence, ETA, ID chip,
 *                           status badge and all
 *   "Add a new stop"        geocoder suggestions
 *
 * Reusing StopRow is the trick that makes it work. The driver holding a parcel
 * marked "D7" can type D7 and read the answer in the same visual language as
 * the list they just came from, ID chip included. A bespoke "search result"
 * row would have meant re-deciding what a stop looks like, and getting it
 * subtly different in the one place where being sure matters most.
 *
 * ── Where this deviates from Spoke, on purpose ────────────────────────────
 *
 * Spoke puts scan and mic icons INSIDE the text field as well as on the tiles
 * below it — the same two verbs, twice, on one screen. The inline pair sits at
 * the top of the reach arc where a thumb has to stretch; the tiles sit in the
 * thumb zone. We keep the tiles, drop the inline icons, and leave the field
 * clean. There is also a fourth tile Spoke lacks — "Paste" — because a list of
 * addresses arriving by message or email is the most common way a driver gets
 * one, and re-typing it by hand is the complaint that follows.
 */

export interface SearchScreenProps {
  query: string
  rows: RouteRow[]
  /** Bias the geocoder towards what the driver is looking at. */
  near?: LatLng
  onSelectStop: (stopId: string) => void
  onAddSuggestion: (suggestion: Suggestion) => void
  onTile: (tile: SearchTileId) => void
}

export function SearchScreen({
  query,
  rows,
  near,
  onSelectStop,
  onAddSuggestion,
  onTile,
}: SearchScreenProps) {
  const existing = useMemo(() => findStopsInRoute(rows, query), [rows, query])

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState<GeocodingStatus | null>(null)

  const service = useMemo(() => getGeocodingService(), [])

  // The service is the authority on whether we are degraded; it knows about
  // failovers this component never sees.
  useEffect(() => {
    setStatus(service.getStatus())
    return service.subscribe(setStatus)
  }, [service])

  /**
   * One debouncer for the lifetime of the screen.
   *
   * Rebuilding it per keystroke would reset the timer's identity and defeat the
   * debounce — which is a spending bug, not a rendering one, so it is worth the
   * ref rather than a `useMemo` that a dependency change could quietly discard.
   */
  const searchRef = useRef<DebouncedSearch | null>(null)
  if (!searchRef.current) {
    searchRef.current = createDebouncedSearch(service, {
      onResults: (results) => {
        setSuggestions(results)
        setFailed(false)
      },
      onError: () => {
        // Both providers are gone. Say so quietly — the existing-stops section
        // above is still perfectly usable, and this must not look like the
        // whole screen broke.
        setSuggestions([])
        setFailed(true)
      },
      onPendingChange: setPending,
    })
  }

  const nearKey = near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)}` : ''
  useEffect(() => {
    searchRef.current?.search(query, {
      near,
      limit: 6,
      lang: typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : undefined,
    })
    // `near` is compared by its rounded key, not by identity: a new object with
    // the same coordinates on every map render would otherwise re-issue the
    // search — and re-spend — on every frame the map moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nearKey])

  useEffect(() => () => searchRef.current?.cancel(), [])

  const handleSelectStop = useCallback((id: string) => onSelectStop(id), [onSelectStop])

  const typedEnough = query.trim().length >= MIN_QUERY_LENGTH
  const nothingTyped = query.trim().length === 0

  return (
    <div data-testid="search-screen" className="pb-8">
      {nothingTyped ? (
        <EmptyFocusedState onTile={onTile} />
      ) : (
        <>
          {existing.length > 0 && (
            <Section label={existingSectionLabel(existing.length)} testId="section-existing">
              {existing.map((row: StopRowModel) => (
                <StopRow key={row.id} row={row} selected={false} onSelect={handleSelectStop} />
              ))}
            </Section>
          )}

          <Section label="Add a new stop" testId="section-suggestions">
            {!typedEnough && (
              <Hint>Keep typing to search for an address</Hint>
            )}

            {typedEnough && pending && suggestions.length === 0 && (
              <Hint>Searching…</Hint>
            )}

            {typedEnough && !pending && failed && (
              <Hint>
                Address search is unavailable right now. Your route and its stops are unaffected.
              </Hint>
            )}

            {typedEnough && !pending && !failed && suggestions.length === 0 && (
              <Hint>No addresses found for “{query.trim()}”</Hint>
            )}

            {suggestions.map((s) => (
              <SuggestionRow
                key={`${s.providerId}:${s.placeId ?? `${s.lat},${s.lng}`}`}
                suggestion={s}
                onSelect={onAddSuggestion}
              />
            ))}
          </Section>

          {/*
            Attribution, and it is an obligation rather than a courtesy:
            Geoapify's free tier requires their credit and every provider here
            is OSM-derived, which the ODbL requires us to say. The string comes
            from whichever provider actually answered.
          */}
          {status && suggestions.length > 0 && (
            <p className="px-4 pt-3 text-meta text-on-surface-variant">{status.attribution}</p>
          )}

          {/*
            The degraded notice. Calm on purpose — results are still real, just
            from a thinner index, and a driver mid-round does not need an alarm
            about which upstream service is answering.
          */}
          {status?.degraded && (
            <p
              data-testid="search-degraded"
              className="px-4 pt-1 text-meta text-on-surface-variant"
            >
              Using backup address search — results may be less precise.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The focused-but-empty state.
 *
 * The tiles are the point of this screen, not the illustration: they are the
 * four ways to add a stop that are NOT typing, and they sit low on the screen
 * where a thumb already is with the keyboard up.
 */
function EmptyFocusedState({ onTile }: { onTile: (tile: SearchTileId) => void }) {
  return (
    <div data-testid="search-empty" className="flex flex-col items-center px-4 pt-8">
      <PinPlusDashedIcon className="h-12 w-12 text-on-surface-variant" />
      <p className="mt-3 text-center text-body text-on-surface-variant">
        Add new stops or find stops in your route
      </p>
      <SearchTiles className="mt-6 w-full" onTile={onTile} />
    </div>
  )
}

function Section({
  label,
  testId,
  children,
}: {
  label: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <section data-testid={testId} className="pt-2">
      {/*
        A plain label, not a sticky header. The two sections are short and the
        sheet already has a header; a second sticky bar would eat the small
        amount of list a keyboard-up screen has left.
      */}
      <h2 className="px-4 py-2 text-label font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </h2>
      {children}
    </section>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-body text-on-surface-variant">{children}</p>
}
