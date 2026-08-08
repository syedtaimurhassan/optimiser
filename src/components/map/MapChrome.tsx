import { useCallback, useEffect } from 'react'
import type { AddressedStop, OptimizedRoute } from '../../types'
import { BASEMAPS, type BasemapId } from '../../lib/map/basemap'
import { contextualFab } from '../../lib/map/camera'
import { pageLabel, type StopPage } from '../../lib/stopPages'
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
  /** The page BEFORE the one the carousel is showing, or null. */
  previousPage: StopPage | null
  /** Go back one page. Only called when `previousPage` is set. */
  onPreviousPage: () => void
  /** The solve, for the finish estimate. Undefined on an unsolved route. */
  optimized: OptimizedRoute | undefined
}

export function MapChrome({
  stops,
  selectedStopId,
  previousPage,
  onPreviousPage,
  optimized,
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

  return (
    <>
      {/* Never conditional on the selection: finish time is the one number a
          driver wants all day, and a pill that came and went would make them
          hunt for it. */}
      <FinishPill stops={stops} optimized={optimized} />

      {/*
        The carousel's previous page, which is now the honest answer — M4 had
        to guess from the stop array, and could not name the end location at
        all. The pill both TELLS you what is behind you and takes you there.
      */}
      <PeekPill
        label={previousPage ? pageLabel(previousPage) : null}
        onClick={onPreviousPage}
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
