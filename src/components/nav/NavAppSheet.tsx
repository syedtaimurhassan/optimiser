import {
  NAV_APP_LABEL,
  NAV_APP_LIMIT_NOTE,
  navAppOrder,
  type NavApp,
} from '../../lib/googleMaps'
import { useRoutesStore } from '../../store/routesStore'
import { CheckIcon, NavigateIcon } from '../ui/icons'
import { ListRow, Sheet } from '../ui'

/**
 * Which app the hand-off opens in.
 *
 * ── Why this is asked once and then not again ─────────────────────────────
 *
 * A driver taps Navigate once per stop, forty-four times a day. A picker on
 * every tap is forty-four extra taps, so the choice is remembered and the
 * button goes straight there afterwards. It is changed from the route menu,
 * which is where a setting belongs and where it can be found deliberately
 * rather than stumbled into mid-round.
 *
 * ── Why the limits are on the rows ────────────────────────────────────────
 *
 * These three apps are not interchangeable and the difference is invisible
 * until you are standing in the van. Google carries three intermediate stops
 * per link on a phone; Waze and Apple Maps carry none at all, so a multi-stop
 * hand-off to either is one link per stop. Saying so on the row is the
 * difference between a choice and a trap.
 */
export function NavAppSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  /**
   * Called with the chosen app, synchronously, inside the row's own click
   * handler — which is what lets the caller open a URL without it being
   * treated as a popup. A choice made now and acted on in a later tick has
   * lost its user activation, and iOS blocks it.
   */
  onPick?: (app: NavApp) => void
}) {
  const navApp = useRoutesStore((s) => s.navApp)
  const setNavApp = useRoutesStore((s) => s.setNavApp)

  return (
    <Sheet open={open} onClose={onClose} label="Choose a navigation app" zIndex={2100}>
      <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="px-1 pb-2 pt-1 text-label text-on-surface-variant">
          Open stops in
        </p>

        <div role="radiogroup" aria-label="Navigation app" className="space-y-2">
          {navAppOrder().map((app) => (
            <ListRow
              key={app}
              role="radio"
              checked={navApp === app}
              outlined
              leading={<NavigateIcon className="h-5 w-5 text-on-surface-variant" />}
              title={NAV_APP_LABEL[app]}
              subtitle={NAV_APP_LIMIT_NOTE[app]}
              trailing={
                navApp === app ? <CheckIcon className="h-5 w-5 text-primary" /> : undefined
              }
              onClick={() => {
                setNavApp(app)
                onPick?.(app)
                onClose()
              }}
            />
          ))}
        </div>

        {/* Not a disclaimer — the reason the app you pick changes how many
            times you will tap. */}
        <p className="px-1 pt-3 text-meta text-on-surface-variant">
          Only Google Maps accepts intermediate stops in a link, and only three
          of them on a phone. Longer routes are handed over in order, one leg at
          a time.
        </p>
      </div>
    </Sheet>
  )
}
