import { useEffect, useRef } from 'react'
import type { AddressedStop, OptimizedRoute } from '../../types'
import type { SheetSnap } from '../../lib/sheetSnap'
import { MenuIcon, MoreIcon, SearchIcon } from '../ui/icons'
import { SummaryStrip } from './SummaryStrip'

/**
 * The header that morphs.
 *
 * ── Why one row and not two ───────────────────────────────────────────────
 *
 * Collapsed, this row is the summary plus two icons. Expanded, it is a
 * hamburger, a search field and an overflow. Those are the same physical row
 * at the same height, cross-fading their contents — not two rows swapped.
 *
 * The difference is worth the trouble: a sheet whose header changes HEIGHT
 * between states makes every snap offset a moving target, so the collapsed
 * detent would have to be re-measured mid-animation and the list underneath
 * would reflow on every drag. Holding the height constant means the geometry
 * is measured once and the morph is pure paint.
 *
 * It also buys the space trick the design is after: the driver never loses the
 * summary to a search bar they are not using, and never loses the search bar
 * to a summary they have already read.
 *
 * ── The search field ──────────────────────────────────────────────────────
 *
 * M5 built this input as a real one that wrote to the store and had no
 * consumer. M6 gave it one: the sheet swaps the route list for the search
 * screen whenever the field is active. The header's own job did not change.
 *
 * While search is active the overflow button becomes Cancel. That is a swap
 * rather than an addition because the row is full at three controls on a
 * 360dp screen, and route options are not what anyone reaches for mid-search —
 * whereas "get me out of here" is exactly what they reach for.
 */
export interface SheetHeaderProps {
  snap: SheetSnap
  routeName: string
  /** Changes with the route's state: "Tap to add stops" when it is empty. */
  placeholder: string
  stops: readonly AddressedStop[]
  optimized: OptimizedRoute | undefined
  searchQuery: string
  searchActive: boolean
  onSearchQuery: (value: string) => void
  /** Focusing search opens the sheet all the way — that is what `full` is for. */
  onSearchFocus: () => void
  /** Collapsed: the search icon stands in for the field there is no room for. */
  onSearchTap: () => void
  onSearchCancel: () => void
  onMenu: () => void
  onOverflow: () => void
}

export function SheetHeader({
  snap,
  routeName,
  placeholder,
  stops,
  optimized,
  searchQuery,
  searchActive,
  onSearchQuery,
  onSearchFocus,
  onSearchTap,
  onSearchCancel,
  onMenu,
  onOverflow,
}: SheetHeaderProps) {
  const expanded = snap === 'expanded' || snap === 'full'
  const inputRef = useRef<HTMLInputElement>(null)

  // Leaving the expanded state with focus still in the search field would keep
  // the keyboard up over a sheet that is no longer showing it.
  useEffect(() => {
    if (!expanded && document.activeElement === inputRef.current) inputRef.current?.blur()
  }, [expanded])

  // The search icon in the collapsed layer promises a field. Honour that:
  // opening the sheet from there should land with the caret already in it,
  // otherwise the driver taps search and then has to tap search again.
  useEffect(() => {
    if (expanded && searchActive) inputRef.current?.focus()
  }, [expanded, searchActive])

  return (
    <div
      data-testid="sheet-header"
      data-morph={expanded ? 'expanded' : 'collapsed'}
      // Fixed height, and both layers stacked inside it. See the note above:
      // a header that changes height makes every snap offset a moving target.
      className="relative h-14 shrink-0 px-4"
    >
      <Layer visible={!expanded}>
        <SummaryStrip stops={stops} optimized={optimized} />
        <div className="ml-auto flex shrink-0 items-center">
          <IconButton label="Search stops" onClick={onSearchTap} testId="header-search-icon">
            <SearchIcon className="h-5 w-5" />
          </IconButton>
          <IconButton label="Route options" onClick={onOverflow} testId="header-overflow-collapsed">
            <MoreIcon className="h-5 w-5" />
          </IconButton>
        </div>
      </Layer>

      <Layer visible={expanded}>
        <IconButton label="Your routes" onClick={onMenu} testId="header-menu">
          <MenuIcon className="h-6 w-6" />
        </IconButton>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-pill bg-surface-variant px-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-on-surface-variant" />
          {/*
            No scan or mic icon in here, deliberately. Spoke puts both inline
            AND on the tiles below — the same two verbs twice on one screen,
            with the inline copies at the far end of the thumb's reach. The
            tiles keep them; the field stays a field.
          */}
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder={placeholder}
            data-testid="sheet-search"
            aria-label={`Add or find stops on ${routeName}`}
            // `min-w-0` is what lets the field shrink inside the flex row
            // instead of pushing the overflow button off the edge.
            className="min-w-0 flex-1 bg-transparent py-2.5 text-body text-on-surface outline-none placeholder:text-on-surface-variant"
          />
        </div>

        {searchActive ? (
          <button
            type="button"
            onClick={onSearchCancel}
            data-testid="header-search-cancel"
            className="shrink-0 rounded-pill px-2 py-2 text-label font-semibold text-primary active:bg-surface-variant"
          >
            Cancel
          </button>
        ) : (
          <IconButton label="Route options" onClick={onOverflow} testId="header-overflow">
            <MoreIcon className="h-6 w-6" />
          </IconButton>
        )}
      </Layer>
    </div>
  )
}

/**
 * One of the two morph states.
 *
 * `inert` rather than just `pointer-events-none`: the hidden layer still
 * contains a focusable input and two buttons, and a tab stop you cannot see is
 * worse than one that isn't there.
 */
function Layer({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={`absolute inset-0 flex items-center gap-2 px-4 transition-opacity duration-150 motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {children}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  testId,
  children,
}: {
  label: string
  onClick: () => void
  testId: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
    >
      {children}
    </button>
  )
}
