import { useLocation } from 'wouter'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { groupRoutesByRecency, toISODate } from '../../lib/routeGrouping'
import { FullWidthButton, Sheet } from '../ui'
import { HelpIcon, PlusIcon, SettingsIcon } from '../ui/icons'
import { InstallInvitation } from '../pwa/InstallInvitation'
import { RouteListRow } from './RouteListRow'

/**
 * The account band.
 *
 * This app has no accounts and never will — it is entirely client-side, with
 * no backend to sign in to. Spoke's band shows the signed-in email and a plan
 * line; the honest local equivalent is what device the data is on and where it
 * lives, which is also the single most useful thing to tell someone whose
 * routes exist in exactly one place.
 *
 * M4 owns Settings; when it lands, this reads a stored identity from there.
 */
const ACCOUNT = {
  title: 'This device',
  subtitle: 'Saved on this device only',
}

/**
 * The routes drawer: a left side sheet over the route screen.
 *
 * Roughly 90% wide, so a strip of the route underneath stays visible. That
 * strip is the scrim, so tapping it dismisses — see Sheet.
 */
export function RoutesDrawer() {
  const [, navigate] = useLocation()

  const open = useUiStore((s) => s.drawerOpen)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const openRouteEditor = useUiStore((s) => s.openRouteEditor)
  const setOverflowRouteId = useUiStore((s) => s.setOverflowRouteId)

  const routes = useRoutesStore((s) => s.routes)
  const activeRouteId = useRoutesStore((s) => s.activeRouteId)
  const setActiveRoute = useRoutesStore((s) => s.setActiveRoute)

  const sections = groupRoutesByRecency(Object.values(routes), toISODate(new Date()))

  function goTo(path: string) {
    setDrawerOpen(false)
    navigate(path)
  }

  /**
   * Set the active route BEFORE navigating.
   *
   * The route screen reads its id from the URL and syncs the store in an
   * effect, which runs after paint — so navigating first would paint one frame
   * of the previous route's stops on the new route's screen. Doing it in this
   * order means the screen's first render is already correct.
   */
  function openRoute(routeId: string) {
    setActiveRoute(routeId)
    goTo(`/route/${routeId}`)
  }

  return (
    <Sheet open={open} onClose={() => setDrawerOpen(false)} side="left" label="Your routes">
      <div className="flex items-center justify-end gap-1 px-2 pt-3">
        <button
          type="button"
          onClick={() => goTo('/help')}
          aria-label="Help"
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface-variant"
        >
          <HelpIcon className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => goTo('/settings')}
          aria-label="Settings"
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface-variant"
        >
          <SettingsIcon className="h-6 w-6" />
        </button>
      </div>

      {/* A header, not a row: nothing here is tappable, so nothing here
          pretends to be. */}
      <div className="mx-3 mt-1 rounded-row bg-primary-container px-4 py-3">
        <p className="truncate text-row font-semibold text-on-primary-container">{ACCOUNT.title}</p>
        <p className="truncate text-label text-on-primary-container/80">{ACCOUNT.subtitle}</p>
      </div>

      <nav aria-label="Your routes" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
        {sections.length === 0 ? (
          <p className="px-4 py-6 text-body text-on-surface-variant">
            No routes yet. Create one to get started.
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.key}>
              <h2 className="px-4 pb-1 pt-4 text-label font-semibold text-on-surface-variant">
                {section.title}
              </h2>
              {section.routes.map((route) => (
                <RouteListRow
                  key={route.id}
                  route={route}
                  active={route.id === activeRouteId}
                  onOpen={() => openRoute(route.id)}
                  onOverflow={() => setOverflowRouteId(route.id)}
                />
              ))}
            </section>
          ))
        )}

        {/* Inside the scroll region, after the list: it must never push the
            "Create route" button around, and must never be between a driver
            and the route they came here to open. */}
        <InstallInvitation />
      </nav>

      {/* Bottom-anchored on purpose: this is the one control in the drawer
          that has to be reachable with a thumb on a tall phone. */}
      <div className="shrink-0 border-t border-outline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <FullWidthButton onClick={() => openRouteEditor({ mode: 'create' })}>
          <PlusIcon className="h-5 w-5" />
          Create route
        </FullWidthButton>
      </div>
    </Sheet>
  )
}
