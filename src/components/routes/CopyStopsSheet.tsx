import { useMemo, useState } from 'react'
import {
  buildCopyPayload,
  copySourceRoutes,
  copyableStops,
  describeSource,
  type CopyFilter,
} from '../../lib/copyStops.ts'
import { titleFor } from '../../lib/routeList.ts'
import type { Route } from '../../types.ts'
import { FullWidthButton } from '../ui/FullWidthButton'
import { Sheet } from '../ui/Sheet'
import { SegmentedControl } from '../ui/SegmentedControl'
import { CheckIcon, ChevronRightIcon } from '../ui/icons'

/**
 * "Copy stops from a past route", and the M3 "Pick past stops to carry over"
 * checkbox flow — one component, because they are the same two questions asked
 * in the same order: which route, then which of its stops.
 *
 * ── Two steps, not one ────────────────────────────────────────────────────
 *
 * A single screen listing every stop of every past route would be hundreds of
 * rows deep and would make the driver do the filtering. Picking the route
 * first cuts it to one round's worth, and the route rows carry enough
 * ("12 stops · 3 unfinished") that the choice is usually made without opening
 * anything.
 *
 * The second step defaults to everything selected. The common case is "copy
 * that round", and a screen that opens with nothing ticked would charge every
 * user a Select All for the privilege.
 */

export interface CopyStopsSheetProps {
  open: boolean
  onClose: () => void
  routes: Route[]
  /** The route being copied INTO — excluded from the source list. */
  destinationRouteId?: string
  onCopy: (stops: ReturnType<typeof buildCopyPayload>) => void
}

export function CopyStopsSheet({
  open,
  onClose,
  routes,
  destinationRouteId,
  onCopy,
}: CopyStopsSheetProps) {
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [filter, setFilter] = useState<CopyFilter>('all')
  /** null means "everything eligible" — the default, before any box is touched. */
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const sources = useMemo(
    () => copySourceRoutes(routes, destinationRouteId),
    [routes, destinationRouteId],
  )
  const source = sources.find((r) => r.id === sourceId) ?? null
  const eligible = useMemo(() => (source ? copyableStops(source, filter) : []), [source, filter])

  const isSelected = (id: string) => (selected ? selected.has(id) : true)
  const selectedCount = selected
    ? eligible.filter((s) => selected.has(s.id)).length
    : eligible.length

  function reset() {
    setSourceId(null)
    setFilter('all')
    setSelected(null)
  }

  function close() {
    reset()
    onClose()
  }

  function toggle(id: string) {
    // The first tap materialises the implicit "all" into a real set, so
    // unticking one box does not read as "select only this one".
    const base = selected ?? new Set(eligible.map((s) => s.id))
    const next = new Set(base)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      side="full"
      label={source ? 'Pick stops to carry over' : 'Copy stops from a past route'}
      zIndex={2100}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-outline px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-title font-semibold text-on-surface">
            {source ? source.name : 'Copy stops from a past route'}
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-touch rounded-pill px-3 text-row font-semibold text-on-surface"
          >
            Cancel
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!source ? (
            <SourceList sources={sources} onPick={setSourceId} />
          ) : (
            <>
              {/*
                Only offered on a completed route. On a draft every stop is
                pending, so "Unfinished" would filter nothing and imply it had.
              */}
              {source.status === 'completed' && (
                <div className="px-4 pt-3">
                  <SegmentedControl
                    label="Which stops to offer"
                    options={[
                      { value: 'all' as CopyFilter, label: 'All stops' },
                      { value: 'unfinished' as CopyFilter, label: 'Unfinished' },
                    ]}
                    value={filter}
                    onChange={(v) => {
                      setFilter(v as CopyFilter)
                      setSelected(null)
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-label font-semibold uppercase tracking-wide text-on-surface-variant">
                  {selectedCount} of {eligible.length} selected
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(selectedCount === eligible.length ? new Set() : null)
                  }
                  className="min-h-touch rounded-pill px-2 text-label font-semibold text-primary"
                >
                  {selectedCount === eligible.length ? 'Clear all' : 'Select all'}
                </button>
              </div>

              {eligible.length === 0 ? (
                <p className="px-4 py-6 text-center text-body text-on-surface-variant">
                  Nothing to carry over from this route.
                </p>
              ) : (
                eligible.map((stop) => (
                  <label
                    key={stop.id}
                    data-testid="copy-stop-row"
                    className="flex min-h-row w-full cursor-pointer items-center gap-3 px-4 active:bg-surface-variant"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected(stop.id)}
                      onChange={() => toggle(stop.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        isSelected(stop.id)
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-outline'
                      }`}
                    >
                      {isSelected(stop.id) && <CheckIcon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1 py-3">
                      <span className="block truncate text-row font-medium text-on-surface">
                        {titleFor(stop)}
                      </span>
                      {stop.address?.subtitle && (
                        <span className="block truncate text-body text-on-surface-variant">
                          {stop.address.subtitle}
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </>
          )}
        </div>

        {source && (
          <div
            className="border-t border-outline p-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <FullWidthButton
              disabled={selectedCount === 0}
              onClick={() => {
                onCopy(
                  buildCopyPayload(source, {
                    filter,
                    selectedIds: selected ? [...selected] : undefined,
                  }),
                )
                close()
              }}
            >
              {selectedCount === 1 ? 'Copy 1 stop' : `Copy ${selectedCount} stops`}
            </FullWidthButton>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function SourceList({ sources, onPick }: { sources: Route[]; onPick: (id: string) => void }) {
  if (sources.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-body text-on-surface-variant">
        You have no other routes with stops yet.
      </p>
    )
  }

  return (
    <>
      {sources.map((route) => (
        <button
          key={route.id}
          type="button"
          onClick={() => onPick(route.id)}
          data-testid="copy-source-row"
          className="flex min-h-row w-full items-center gap-3 px-4 text-left active:bg-surface-variant"
        >
          <span className="min-w-0 flex-1 py-3">
            <span className="block truncate text-row font-medium text-on-surface">{route.name}</span>
            <span className="block truncate text-body text-on-surface-variant">
              {route.dateISO} · {describeSource(route)}
            </span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
        </button>
      ))}
    </>
  )
}
