import { useState } from 'react'
import type { Route } from '../../types'
import { copySourceRoutes } from '../../lib/copyStops'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { ConfirmDialog, DemotedActionGroup, Sheet } from '../ui'
import {
  ClipboardIcon,
  DuplicateIcon,
  FitRouteIcon,
  NavigateIcon,
  PrinterIcon,
  RenumberIcon,
  ScanIcon,
  ShareIcon,
  TransferIcon,
  TrashIcon,
} from '../ui/icons'
import { CopyStopsSheet } from './CopyStopsSheet'
import { ImportStopsSheet } from '../search/ImportStopsSheet'
import { RemoveStopsSheet } from './RemoveStopsSheet'
import { PrintableRoute } from '../print/PrintableRoute'
import { NavAppSheet } from '../nav/NavAppSheet'
import { NAV_APP_LABEL } from '../../lib/googleMaps'
import { routeShareText } from '../../lib/printRoute'

/**
 * The route's own menu — the sheet's overflow.
 *
 * ── Where we fix Spoke's worst information architecture ───────────────────
 *
 * Spoke's version is nine flat items in one undifferentiated list, and
 * "Remove stops…" — the only destructive one — is rendered in the same black
 * as the other eight. That breaks the red-means-destruction convention Spoke
 * itself follows everywhere else in the app, in the one place where breaking
 * it costs a driver their round.
 *
 * Ours keeps all nine and all their behaviour, and changes two things:
 *
 *   1. Three sections with a gap between them — share and move, reorder and
 *      renumber, bulk input and output. Nine items is past the number anyone
 *      scans as a list, and the three groups are the three reasons you would
 *      open this menu at all.
 *   2. The destructive item is red and in a block of its own, last.
 *
 * ── The "…" convention, which we keep ─────────────────────────────────────
 *
 * A trailing ellipsis means the item opens a further sheet rather than acting
 * immediately. It is a real, cheap, informative convention and Spoke is right
 * to use it — so "Copy stops…" asks which route, and "Print route" just
 * prints.
 */
export interface RouteMenuSheetProps {
  open: boolean
  route: Route
  onClose: () => void
}

type Overlay = 'copy' | 'import' | 'remove' | null

export function RouteMenuSheet({ open, route, onClose }: RouteMenuSheetProps) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [navPickerOpen, setNavPickerOpen] = useState(false)
  /** What the share attempt did, when it did something worth saying. */
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [printing, setPrinting] = useState(false)

  const addStops = useRoutesStore((s) => s.addStops)
  const allRoutes = useRoutesStore((s) => s.routes)
  const resetStopIds = useRoutesStore((s) => s.resetStopIdsForActive)
  const setSetupOpen = useUiStore((s) => s.setSetupOpen)
  const navApp = useRoutesStore((s) => s.navApp)

  const soon = (label: string, icon: React.ReactNode, testId: string) => ({
    label,
    icon,
    hint: 'Soon',
    disabled: true,
    onSelect: () => {},
    testId,
  })

  return (
    <>
      <Sheet open={open} onClose={onClose} label={`Options for ${route.name}`} zIndex={2050}>
        <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DemotedActionGroup
            sections={[
              // ── share and move ──
              [
                {
                  // A setting, and this is where it can be found deliberately.
                  // The Navigate button itself must not ask — a picker on every
                  // stop is one extra tap forty-four times a day.
                  label: `Navigation app · ${navApp ? NAV_APP_LABEL[navApp] : 'Not set'}`,
                  icon: <NavigateIcon className="h-5 w-5" />,
                  onSelect: () => setNavPickerOpen(true),
                  testId: 'menu-nav-app',
                },
                {
                  label: 'Share route copy',
                  icon: <ShareIcon className="h-5 w-5" />,
                  onSelect: () => void shareRoute(route, setShareNote),
                  testId: 'menu-share',
                },
                soon('Transfer stops', <TransferIcon className="h-5 w-5" />, 'menu-transfer'),
                {
                  label: 'Copy stops…',
                  icon: <DuplicateIcon className="h-5 w-5" />,
                  onSelect: () => setOverlay('copy'),
                  testId: 'menu-copy',
                },
              ],
              // ── reorder and renumber ──
              [
                {
                  // Opens the setup panel, which is where the endpoints, the
                  // objective, the search tier and Calculate still live. That
                  // is transitional, and it is also genuinely the right home
                  // for "reoptimise": it is the only screen that can say what
                  // the reoptimisation would be FOR.
                  label: 'Reoptimise route…',
                  icon: <FitRouteIcon className="h-5 w-5" />,
                  onSelect: () => {
                    onClose()
                    setSetupOpen(true)
                  },
                  testId: 'menu-reoptimise',
                },
                {
                  label: 'Reset Stop IDs…',
                  icon: <RenumberIcon className="h-5 w-5" />,
                  onSelect: () => setConfirmReset(true),
                  testId: 'menu-reset-ids',
                },
              ],
              // ── bulk in, bulk out ──
              [
                soon('Scan route manifest', <ScanIcon className="h-5 w-5" />, 'menu-scan'),
                {
                  label: 'Import route manifest…',
                  icon: <ClipboardIcon className="h-5 w-5" />,
                  onSelect: () => setOverlay('import'),
                  testId: 'menu-import',
                },
                {
                  label: 'Print route',
                  icon: <PrinterIcon className="h-5 w-5" />,
                  onSelect: () => {
                    onClose()
                    setPrinting(true)
                  },
                  testId: 'menu-print',
                },
              ],
            ]}
            destructive={{
              label: 'Remove stops…',
              icon: <TrashIcon className="h-5 w-5" />,
              onSelect: () => setOverlay('remove'),
              testId: 'menu-remove-stops',
            }}
          />
        </div>
      </Sheet>

      <CopyStopsSheet
        open={overlay === 'copy'}
        onClose={() => setOverlay(null)}
        routes={copySourceRoutes(Object.values(allRoutes), route.id)}
        destinationRouteId={route.id}
        onCopy={(copied) => addStops(copied)}
      />

      <ImportStopsSheet open={overlay === 'import'} onClose={() => setOverlay(null)} />

      <RemoveStopsSheet
        open={overlay === 'remove'}
        route={route}
        onClose={() => {
          setOverlay(null)
          onClose()
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset Stop IDs?"
        body={`Every stop will be relabelled from its current position. Any ID already written on a parcel will stop matching — ${route.name} has ${route.stops.length} stop${route.stops.length === 1 ? '' : 's'}.`}
        confirmLabel="Reset"
        onConfirm={() => {
          resetStopIds()
          setConfirmReset(false)
          onClose()
        }}
        onCancel={() => setConfirmReset(false)}
      />

      <NavAppSheet open={navPickerOpen} onClose={() => setNavPickerOpen(false)} />

      {shareNote && (
        <p role="status" className="px-4 pb-2 text-meta text-on-surface-variant">
          {shareNote}
        </p>
      )}

      {/* Mounted only while printing: 300 table rows are 300 table rows. */}
      {printing && <PrintableRoute route={route} onDone={() => setPrinting(false)} />}
    </>
  )
}

/**
 * Hand the route to whatever the OS offers, or to the clipboard.
 *
 * Web Share is the only one of M13's capabilities that is present on all four
 * target contexts, so the fallback exists for desktop rather than for a phone.
 * An abort is the driver changing their mind and says nothing — a toast that
 * announces "cancelled" is the app arguing with a decision.
 */
async function shareRoute(route: Route, note: (text: string | null) => void): Promise<void> {
  const text = routeShareText(route)
  try {
    if (navigator.share) {
      await navigator.share({ title: route.name, text })
      note(null)
      return
    }
    await navigator.clipboard.writeText(text)
    note('Route copied to the clipboard.')
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      note(null)
      return
    }
    note('Could not share the route.')
  }
}
