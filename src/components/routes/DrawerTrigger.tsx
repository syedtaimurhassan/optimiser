import { useUiStore } from '../../store/uiStore'
import { MenuIcon } from '../ui/icons'

/**
 * The control that opens the routes drawer.
 *
 * A floating button rather than part of a top bar: the route screen has no
 * top bar, and on phones the controls sheet is collapsed to a peek, so
 * anything placed inside it would be unreachable.
 *
 * It sits above the map and the controls sheet (z 1500) but below the
 * drawer's own scrim (z 2000), and shifts right of the sidebar column on
 * desktop so it never covers it.
 *
 * The 16dp inset (`left-4 top-4`) matches the map chrome's own insets, so the
 * drawer button, the finish pill and the FAB stack all sit on one margin.
 * MapLibre adds no controls of its own to this corner, so unlike Leaflet
 * there is nothing here to collide with.
 */
export function DrawerTrigger() {
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Your routes"
      className="fixed left-4 top-4 z-[1550] flex h-touch w-touch items-center justify-center rounded-pill border border-outline bg-surface text-on-surface shadow-md md:left-[25rem]"
    >
      <MenuIcon className="h-6 w-6" />
    </button>
  )
}
