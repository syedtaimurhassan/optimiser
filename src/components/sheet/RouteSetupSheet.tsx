import { Sheet } from '../ui/Sheet'
import { useUiStore } from '../../store/uiStore'
import { HeaderPanel } from '../HeaderPanel'
import { ColdStartBanner } from '../ColdStartBanner'
import { StopsPanel } from '../StopsPanel'
import { DeliveredPanel } from '../DeliveredPanel'
import { RouteSetupPanel } from '../RouteSetupPanel'
import { ResultsPanel } from '../ResultsPanel'
import { FavoritesPanel } from '../FavoritesPanel'
import { CalculatePanel } from '../CalculatePanel'

/**
 * "Route setup" — the M1 control panels, in a modal, reached from the sheet's
 * overflow.
 *
 * ── This is scaffolding, and it is deliberate ─────────────────────────────
 *
 * M5 replaces the phone screen's sidebar with the route sheet. But the sidebar
 * is still the only place a driver can upload a file, set the endpoints,
 * choose an objective or press Calculate — M6 through M8 rebuild those, and
 * until they do, deleting the sidebar would ship a milestone where the app
 * cannot plan a route.
 *
 * So the panels move rather than go: unchanged, in a bottom sheet, one tap
 * from the overflow. Nothing that worked yesterday stopped working, no
 * throwaway UI was written for them, and the whole thing disappears in one
 * commit when the last panel has a replacement.
 *
 * Desktop keeps the real sidebar. This is the phone's stand-in for it.
 */
export function RouteSetupSheet() {
  const open = useUiStore((s) => s.setupOpen)
  const setOpen = useUiStore((s) => s.setSetupOpen)

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      label="Route setup"
      // Above the persistent sheet (1500) and its FABs (1550), below the
      // routes drawer's scrim (2000) — which can be opened over this one.
      zIndex={1800}
      className="max-h-[88dvh]"
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 className="text-title font-semibold text-on-surface">Route setup</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-touch rounded-pill px-3 text-label font-semibold text-primary"
        >
          Done
        </button>
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-1"
        data-testid="route-setup"
      >
        <HeaderPanel />
        <ColdStartBanner />
        <StopsPanel />
        <DeliveredPanel />
        <RouteSetupPanel />
        <ResultsPanel />
        <FavoritesPanel />
        <div className="pt-1">
          <CalculatePanel />
        </div>
      </div>
    </Sheet>
  )
}
