import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { formatShortDate, formatStopSummary, summariseStops } from '../../lib/routeGrouping'
import { ConfirmDialog, DemotedActionGroup, Sheet } from '../ui'
import { DuplicateIcon, PencilIcon, TrashIcon } from '../ui/icons'

/**
 * Name exactly what is about to be lost.
 *
 * The stop count is the part that makes the decision, so an empty route says
 * nothing about stops rather than announcing "and its 0 stops" — which reads
 * like a bug and buries the sentence that matters.
 */
function describeDeletion(name: string, dateISO: string, stopCount: number): string {
  const stops = stopCount === 0 ? '' : ` and its ${stopCount} stop${stopCount === 1 ? '' : 's'}`
  return `${name} (${formatShortDate(dateISO)})${stops} will be permanently deleted. This cannot be undone.`
}

/**
 * The per-route 3-dot menu, and the confirmation that guards its last item.
 *
 * A bottom sheet rather than a popover: it is a list of demoted actions with a
 * destructive one at the end, which is exactly what DemotedActionGroup is, and
 * a sheet puts all three inside thumb reach on a tall phone instead of
 * anchoring them next to a row near the top of the screen.
 */
export function RouteOverflowSheet() {
  const [location, navigate] = useLocation()

  const overflowRouteId = useUiStore((s) => s.overflowRouteId)
  const setOverflowRouteId = useUiStore((s) => s.setOverflowRouteId)
  const confirmDeleteRouteId = useUiStore((s) => s.confirmDeleteRouteId)
  const setConfirmDeleteRouteId = useUiStore((s) => s.setConfirmDeleteRouteId)
  const openRouteEditor = useUiStore((s) => s.openRouteEditor)

  const duplicateRoute = useRoutesStore((s) => s.duplicateRoute)
  const deleteRoute = useRoutesStore((s) => s.deleteRoute)

  // The sheet outlives the state that opened it by one exit animation, so the
  // route it describes has to as well — otherwise the title empties out while
  // the sheet is still sliding down.
  const [visibleId, setVisibleId] = useState(overflowRouteId)
  useEffect(() => {
    if (overflowRouteId) setVisibleId(overflowRouteId)
  }, [overflowRouteId])

  const route = useRoutesStore((s) => (visibleId ? (s.routes[visibleId] ?? null) : null))
  const pendingDelete = useRoutesStore((s) =>
    confirmDeleteRouteId ? (s.routes[confirmDeleteRouteId] ?? null) : null,
  )

  function confirmDelete() {
    if (!pendingDelete) return
    const deletedId = pendingDelete.id
    const wasOpen = location === `/route/${deletedId}`

    deleteRoute(deletedId)
    setConfirmDeleteRouteId(null)

    // deleteRoute guarantees an active route survives — the newest remaining
    // one, or a fresh one if that was the last. Follow it, but only if the
    // deleted route was the one on screen: deleting yesterday's round from the
    // drawer should not move you off today's.
    if (wasOpen) {
      const next = useRoutesStore.getState().activeRouteId
      if (next) navigate(`/route/${next}`, { replace: true })
    }
  }

  return (
    <>
      <Sheet
        open={overflowRouteId !== null}
        onClose={() => setOverflowRouteId(null)}
        label={route ? `Options for ${route.name}` : 'Route options'}
        zIndex={2050}
      >
        <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {route && (
            <p className="px-1 pb-3 pt-2 text-label text-on-surface-variant">
              <span className="font-semibold text-on-surface">{route.name}</span>{' '}
              {formatShortDate(route.dateISO)} · {formatStopSummary(summariseStops(route.stops))}
            </p>
          )}

          <DemotedActionGroup
            actions={[
              {
                label: 'Set name and date',
                icon: <PencilIcon className="h-5 w-5" />,
                onSelect: () => {
                  if (visibleId) openRouteEditor({ mode: 'edit', routeId: visibleId })
                },
              },
              {
                label: 'Duplicate route',
                icon: <DuplicateIcon className="h-5 w-5" />,
                onSelect: () => {
                  if (visibleId) duplicateRoute(visibleId)
                  setOverflowRouteId(null)
                },
              },
            ]}
            destructive={{
              label: 'Delete route',
              icon: <TrashIcon className="h-5 w-5" />,
              onSelect: () => {
                if (visibleId) setConfirmDeleteRouteId(visibleId)
              },
            }}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this route?"
        body={pendingDelete ? describeDeletion(pendingDelete.name, pendingDelete.dateISO, pendingDelete.stops.length) : undefined}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteRouteId(null)}
      />
    </>
  )
}
