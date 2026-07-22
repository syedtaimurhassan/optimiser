import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRouteStore } from '../store/routeStore'
import { CollapsibleSection } from './CollapsibleSection'

/** Save the current start/end/waypoints as a named favorite, and reload them
 *  later. Favorites live in local storage (persisted with the store). */
export function FavoritesPanel() {
  const favorites = useRouteStore(useShallow((s) => s.favorites))
  const hasWork = useRouteStore(
    (s) => Boolean(s.startLocation || s.endLocation || s.waypoints.length > 0),
  )
  const saveFavorite = useRouteStore((s) => s.saveFavorite)
  const loadFavorite = useRouteStore((s) => s.loadFavorite)
  const deleteFavorite = useRouteStore((s) => s.deleteFavorite)

  const [name, setName] = useState('')

  function handleSave() {
    saveFavorite(name)
    setName('')
  }

  return (
    <CollapsibleSection title="Favorites" badge={favorites.length || undefined}>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hasWork && handleSave()}
          placeholder="Name this list…"
          className="min-h-[44px] min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={!hasWork}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Save
        </button>
      </div>

      {favorites.length === 0 ? (
        <p className="text-xs text-slate-400">
          Save the current start, end &amp; stops to reuse later.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {favorites.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-3 text-sm"
            >
              <button
                onClick={() => loadFavorite(f.id)}
                className="flex min-h-[44px] min-w-0 flex-1 items-center truncate text-left text-slate-700 hover:text-blue-600"
                title="Load this favorite"
              >
                <span className="truncate">
                  {f.name}
                  <span className="ml-2 text-xs text-slate-400">
                    {f.waypoints.length} stop{f.waypoints.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
              <button
                onClick={() => deleteFavorite(f.id)}
                aria-label={`Delete ${f.name}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  )
}
