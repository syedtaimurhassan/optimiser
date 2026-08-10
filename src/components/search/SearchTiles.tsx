import type { ReactNode } from 'react'
import { ClipboardIcon, MicIcon, PinIcon, ScanIcon } from '../ui/icons'

/**
 * The four non-typing ways to add a stop.
 *
 * ── Why a 2×2 grid and not `ActionRow3Up` ─────────────────────────────────
 *
 * The design calls for three tiles — Map, Scan, Voice — and we are adding a
 * fourth, Paste. `ActionRow3Up` exists and would be the obvious reuse, but its
 * own docstring says it is fixed at three because a fourth "would either shrink
 * the targets or truncate the words" on a 360dp screen. That reasoning does not
 * stop being true because we want another verb, so this is a grid rather than a
 * row: four tiles at full touch size, two up, both rows inside the thumb arc
 * with a keyboard up.
 *
 * Outlined rather than filled: these are alternatives to the field above them,
 * not the primary action. Four filled blocks would out-shout the thing the
 * driver is most likely to do, which is type.
 */

export type SearchTileId = 'map' | 'scan' | 'voice' | 'paste'

interface Tile {
  id: SearchTileId
  label: string
  icon: ReactNode
  /** Voice lands with the rest of M13; Scan is live. */
  comingSoon?: boolean
}

const TILES: Tile[] = [
  { id: 'map', label: 'Map', icon: <PinIcon className="h-5 w-5" /> },
  { id: 'paste', label: 'Paste', icon: <ClipboardIcon className="h-5 w-5" /> },
  { id: 'scan', label: 'Scan', icon: <ScanIcon className="h-5 w-5" /> },
  { id: 'voice', label: 'Voice', icon: <MicIcon className="h-5 w-5" />, comingSoon: true },
]

export function SearchTiles({
  onTile,
  className = '',
}: {
  onTile: (tile: SearchTileId) => void
  className?: string
}) {
  return (
    <div data-testid="search-tiles" className={`grid grid-cols-2 gap-2 ${className}`}>
      {TILES.map((tile) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => onTile(tile.id)}
          disabled={tile.comingSoon}
          data-testid={`search-tile-${tile.id}`}
          // The disabled reason belongs in the accessible name, not only in the
          // grey. "Scan, coming soon" is a complete answer; a dimmed button that
          // announces just "Scan" tells a screen-reader user nothing about why
          // it does not respond.
          aria-label={tile.comingSoon ? `${tile.label}, coming soon` : tile.label}
          className="flex min-h-touch flex-col items-center justify-center gap-1 rounded-row border border-outline px-2 py-3 text-label font-semibold text-on-surface active:bg-surface-variant disabled:opacity-40"
        >
          <span className="flex h-6 w-6 items-center justify-center">{tile.icon}</span>
          <span className="truncate">{tile.label}</span>
          {tile.comingSoon && (
            <span className="text-meta font-normal text-on-surface-variant">Coming soon</span>
          )}
        </button>
      ))}
    </div>
  )
}
