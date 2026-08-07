import { useCallback, useEffect, useMemo } from 'react'
import type { AddressedStop } from '../../types'
import { BASEMAPS, type BasemapId } from '../../lib/map/basemap'
import { contextualFab } from '../../lib/map/camera'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useUiStore } from '../../store/uiStore'
import { useMapController } from './MapControllerContext'
import { FabStack } from './FabStack'
import { FinishPill } from './FinishPill'
import { PeekPill } from './PeekPill'

/**
 * Everything that floats over the map.
 *
 * Kept out of MapComponent so the map's data effects and the chrome's
 * interaction state do not share a render: a driver dragging the basemap
 * toggle should not cause 300 markers to be rebuilt.
 *
 * The routes-drawer trigger is NOT here — it belongs to the screen, because
 * it opens something that is not part of the map. See DrawerTrigger.
 */

/**
 * Deliberately no `routeBounds` or endpoint props. The controller already
 * holds the stop features and the route geometry, so asking the chrome to
 * compute a bounds and hand it back would be passing the map its own data.
 */
export interface MapChromeProps {
  stops: AddressedStop[]
  selectedStopId: string | null
  onSelectStop: (id: string | null) => void
  durationSeconds: number | undefined
}

export function MapChrome({
  stops,
  selectedStopId,
  onSelectStop,
  durationSeconds,
}: MapChromeProps) {
  const controller = useMapController()
  const basemap = useUiStore((s) => s.basemap)
  const setBasemap = useUiStore((s) => s.setBasemap)
  const geo = useGeolocation()

  const contextual = contextualFab({ selectedStopId, stopCount: stops.length })

  // Feed fixes straight through to the map. The dot is the controller's
  // business; this component only decides when to start asking.
  useEffect(() => {
    controller?.setUserPosition(geo.position, geo.heading)
  }, [controller, geo.position, geo.heading])

  const handleContextual = useCallback(() => {
    if (!controller) return
    if (contextual === 'my-location') {
      // First tap asks permission and starts the watch; once there is a fix,
      // the same button becomes "recentre on me".
      if (!controller.followUser()) geo.request()
      return
    }
    if (contextual === 'focus-stop' && selectedStopId) {
      controller.focusStop(selectedStopId)
      return
    }
    // fit-route: repeated taps widen through the cycle rather than doing the
    // same thing over and over.
    controller.recenter(selectedStopId)
  }, [controller, contextual, geo, selectedStopId])

  const toggleBasemap = useCallback(() => {
    const order: BasemapId[] = ['streets', 'light']
    setBasemap(order[(order.indexOf(basemap) + 1) % order.length])
  }, [basemap, setBasemap])

  // The item before the selected one, in the route's own order. M7 replaces
  // this with the carousel's notion of "previous", which will also cover the
  // end location; until then the previous stop is the honest answer.
  const previous = useMemo(() => {
    if (!selectedStopId) return null
    const index = stops.findIndex((s) => s.id === selectedStopId)
    return index > 0 ? stops[index - 1] : null
  }, [stops, selectedStopId])

  const pendingCount = stops.filter((s) => s.status === 'pending').length

  return (
    <>
      <FinishPill
        durationSeconds={durationSeconds}
        pendingCount={pendingCount}
        totalCount={stops.length}
      />

      <PeekPill
        label={previous ? `${previous.stopId} ${previous.address?.title ?? ''}`.trim() : null}
        onClick={() => previous && onSelectStop(previous.id)}
      />

      <FabStack
        contextual={contextual}
        basemapLabel={BASEMAPS[basemap].label}
        onToggleBasemap={toggleBasemap}
        onContextual={handleContextual}
      />

      {geo.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <p className="pointer-events-auto rounded-pill bg-on-surface/90 px-4 py-2 text-label text-white">
            {geo.error}
          </p>
        </div>
      )}
    </>
  )
}
