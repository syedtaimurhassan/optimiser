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
 * ── The search field is deliberately inert ────────────────────────────────
 *
 * It focuses, it moves the sheet to `full`, and it writes to the store. There
 * is no consumer of `searchQuery` yet and nothing filters — that is M6. It is
 * a real input rather than a fake one so M6 wires a reducer rather than
 * rebuilding the header.
 */
export interface SheetHeaderProps {
  snap: SheetSnap
  routeName: string
  stops: readonly AddressedStop[]
  optimized: OptimizedRoute | undefined
  searchQuery: string
  onSearchQuery: (value: string) => void
  /** Focusing search opens the sheet all the way — that is what `full` is for. */
  onSearchFocus: () => void
  /** Collapsed: the search icon stands in for the field there is no room for. */
  onSearchTap: () => void
  onMenu: () => void
  onOverflow: () => void
}

export function SheetHeader({
  snap,
  routeName,
  stops,
  optimized,
  searchQuery,
  onSearchQuery,
  onSearchFocus,
  onSearchTap,
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
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder={`Search ${routeName}`}
            data-testid="sheet-search"
            aria-label="Search stops on this route"
            // `min-w-0` is what lets the field shrink inside the flex row
            // instead of pushing the overflow button off the edge.
            className="min-w-0 flex-1 bg-transparent py-2.5 text-body text-on-surface outline-none placeholder:text-on-surface-variant"
          />
        </div>

        <IconButton label="Route options" onClick={onOverflow} testId="header-overflow">
          <MoreIcon className="h-6 w-6" />
        </IconButton>
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
