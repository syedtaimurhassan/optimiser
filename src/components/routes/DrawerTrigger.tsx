import { useUiStore } from '../../store/uiStore'
import { MenuIcon } from '../ui/icons'

/**
 * The control that opens the routes drawer.
 *
 * A floating button rather than part of a top bar, because the route screen
 * has no top bar until M4 builds one — and on phones the controls sheet is
 * collapsed to a peek, so anything placed inside it would be unreachable.
 *
 * It sits above the map and the controls sheet (z 1500) but below the
 * drawer's own scrim (z 2000), and shifts right of the sidebar column on
 * desktop so it never covers it.
 */
export function DrawerTrigger() {
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Your routes"
      className="fixed left-3 top-3 z-[1550] flex h-touch w-touch items-center justify-center rounded-pill border border-outline bg-surface text-on-surface shadow-md md:left-[25rem]"
    >
      <MenuIcon className="h-6 w-6" />
    </button>
  )
}
