import { useState } from 'react'
import type { Route } from '../../types'
import { useRoutesStore } from '../../store/routesStore'
import { ConfirmDialog, DemotedActionGroup, Sheet } from '../ui'
import { ParcelCheckIcon, ParcelCrossIcon, TrashIcon } from '../ui/icons'

/**
 * "Remove stops…" — the further sheet the ellipsis promises.
 *
 * Three ways to clear stops out, because the bulk removals a driver actually
 * wants are "tidy up what I have finished" far more often than "throw the
 * whole round away". Offering only the last one would mean doing the first two
 * by hand, 40 times.
 *
 * Every one of them is confirmed by name and count. Bulk deletion has no undo
 * in this app, and a sheet that removes 44 stops on one tap is a sheet that
 * eventually removes 44 stops by accident.
 */
export interface RemoveStopsSheetProps {
  open: boolean
  route: Route
  onClose: () => void
}

type Target = 'delivered' | 'failed' | 'all'

const LABEL: Record<Target, string> = {
  delivered: 'Remove delivered stops',
  failed: 'Remove failed stops',
  all: 'Remove all stops',
}

export function RemoveStopsSheet({ open, route, onClose }: RemoveStopsSheetProps) {
  const [pending, setPending] = useState<Target | null>(null)
  const removeStop = useRoutesStore((s) => s.removeStop)
  const clearStops = useRoutesStore((s) => s.clearStops)

  const counts: Record<Target, number> = {
    delivered: route.stops.filter((s) => s.status === 'delivered').length,
    failed: route.stops.filter((s) => s.status === 'failed').length,
    all: route.stops.length,
  }

  function confirm() {
    if (!pending) return
    if (pending === 'all') clearStops()
    else for (const stop of route.stops.filter((s) => s.status === pending)) removeStop(stop.id)
    setPending(null)
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} label="Remove stops" zIndex={2100}>
        <div className="p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="px-1 pb-3 pt-2 text-label text-on-surface-variant">
            Removing stops cannot be undone.
          </p>
          <DemotedActionGroup
            actions={[
              {
                label: LABEL.delivered,
                icon: <ParcelCheckIcon className="h-5 w-5" />,
                hint: String(counts.delivered),
                disabled: counts.delivered === 0,
                onSelect: () => setPending('delivered'),
                testId: 'remove-delivered',
              },
              {
                label: LABEL.failed,
                icon: <ParcelCrossIcon className="h-5 w-5" />,
                hint: String(counts.failed),
                disabled: counts.failed === 0,
                onSelect: () => setPending('failed'),
                testId: 'remove-failed',
              },
            ]}
            destructive={{
              label: LABEL.all,
              icon: <TrashIcon className="h-5 w-5" />,
              hint: String(counts.all),
              disabled: counts.all === 0,
              onSelect: () => setPending('all'),
              testId: 'remove-all',
            }}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${LABEL[pending]}?` : ''}
        body={
          pending
            ? `${counts[pending]} stop${counts[pending] === 1 ? '' : 's'} will be permanently removed from ${route.name}. This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
