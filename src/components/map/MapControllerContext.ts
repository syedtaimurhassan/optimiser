import { createContext, useContext } from 'react'
import type { MapController } from '../../lib/map/controller'

/**
 * The live map, shared with the chrome that floats over it.
 *
 * The FABs, the peek pill and the finish pill all sit outside the map's own
 * DOM but act on its camera. Threading a controller ref down through props
 * would mean every one of them re-renders whenever the map does; a context
 * carrying a STABLE object means they read it once and never re-render for
 * camera reasons at all.
 *
 * Null until the map has mounted. Chrome renders regardless and no-ops on a
 * tap in that window, which is a few hundred milliseconds at worst.
 */
export const MapControllerContext = createContext<MapController | null>(null)

export const useMapController = (): MapController | null => useContext(MapControllerContext)
