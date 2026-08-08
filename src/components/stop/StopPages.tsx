import { useCallback } from 'react'
import { useLocation } from 'wouter'
import type { Route } from '../../types'
import type { StopPage } from '../../lib/stopPages'
import { formatLatLng } from '../../lib/coordinates'
import { googleMapsSearchUrl } from '../../lib/googleMaps'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { StopCarousel } from './StopCarousel'
import { StopDetailCard } from './StopDetailCard'
import { EndLocationCard } from './EndLocationCard'

/**
 * The carousel, wired to the store and to the URL.
 *
 * `StopCarousel` owns the gesture and the animation and knows nothing about
 * routes; this owns what a page DOES and knows nothing about pixels.
 *
 * ── push vs replace, which is a real decision ─────────────────────────────
 *
 * Opening a stop PUSHES: Back should close the card and return to the list,
 * because that is the journey the driver took.
 *
 * Swiping between stops REPLACES. A round is 44 stops and can be 300 — pushing
 * each one would bury the route under a history stack the driver has to walk
 * back through one card at a time to escape. Swiping is browsing, not
 * navigating, and Back after browsing should still mean "put this away".
 */
export interface StopPagesProps {
  route: Route
  pages: StopPage[]
  index: number
}

export function StopPages({ route, pages, index }: StopPagesProps) {
  const [, navigate] = useLocation()
  const setStopStatus = useRoutesStore((s) => s.setStopStatus)
  const undoStopStatus = useRoutesStore((s) => s.undoStopStatus)
  const duplicateStop = useRoutesStore((s) => s.duplicateStop)
  const removeStop = useRoutesStore((s) => s.removeStop)
  const setRouteStatus = useRoutesStore((s) => s.setRouteStatus)
  const setStopEditorId = useUiStore((s) => s.setStopEditorId)

  const close = useCallback(() => navigate(`/route/${route.id}`), [navigate, route.id])

  const goToPage = useCallback(
    (next: number) => {
      const page = pages[next]
      if (page) navigate(`/route/${route.id}/stop/${page.id}`, { replace: true })
    },
    [navigate, pages, route.id],
  )

  /**
   * Removing the stop you are looking at has to leave you somewhere.
   *
   * The next page is the right answer — it is what the swipe would have shown
   * — and the previous one when the removed stop was last. An empty route
   * closes the carousel entirely.
   */
  const removeAndMoveOn = useCallback(
    (stopId: string) => {
      const successor = pages[index + 1] ?? pages[index - 1] ?? null
      removeStop(stopId)
      if (successor) navigate(`/route/${route.id}/stop/${successor.id}`, { replace: true })
      else navigate(`/route/${route.id}`, { replace: true })
    },
    [pages, index, removeStop, navigate, route.id],
  )

  const renderPage = useCallback(
    (page: StopPage) => {
      if (page.kind === 'end') {
        return (
          <EndLocationCard
            title={endTitle(route)}
            // Real arrivals land later in this milestone; until then the line
            // reads "End location" alone rather than inventing a time.
            arrival={null}
            completed={route.status === 'completed'}
            onClose={close}
            onNavigate={() => openNavigation(page.point)}
            onComplete={() => setRouteStatus(route.id, 'completed')}
          />
        )
      }

      return (
        <StopDetailCard
          stop={page.stop}
          position={page.position}
          total={page.total}
          groups={route.groups}
          etaMs={null}
          onClose={close}
          onNavigate={() => openNavigation({ lat: page.stop.lat, lng: page.stop.lng })}
          onSetStatus={(status) => setStopStatus(page.stop.id, status)}
          onUndo={() => undoStopStatus(page.stop.id)}
          onEdit={() => setStopEditorId(page.stop.id)}
          onDuplicate={() => {
            const created = duplicateStop(page.stop.id)
            // Land on the copy: it is the one that still needs deciding about.
            if (created) navigate(`/route/${route.id}/stop/${created}`, { replace: true })
          }}
          onRemove={() => removeAndMoveOn(page.stop.id)}
        />
      )
    },
    [
      route,
      close,
      setStopStatus,
      undoStopStatus,
      duplicateStop,
      removeAndMoveOn,
      setRouteStatus,
      setStopEditorId,
      navigate,
    ],
  )

  return (
    <StopCarousel pages={pages} index={index} onIndexChange={goToPage} renderPage={renderPage} />
  )
}

/**
 * A URL stub, and nothing more — real hand-off is M13.
 *
 * `noopener` is not decoration: without it the opened tab gets a handle on
 * this window through `opener` and can navigate it away.
 */
function openNavigation(point: { lat: number; lng: number }): void {
  window.open(googleMapsSearchUrl(point), '_blank', 'noopener,noreferrer')
}

/**
 * What to call the end location.
 *
 * `Route.end` is a bare coordinate — the model has never had an address for
 * it. When a stop sits on exactly that coordinate (which is what "finish where
 * you started" and "end at the depot" both look like), borrow its address
 * rather than showing a driver two numbers.
 */
function endTitle(route: Route): string {
  const end = route.end
  if (!end) return 'End location'
  const match = route.stops.find((s) => s.lat === end.lat && s.lng === end.lng)
  return match?.address?.title?.trim() || formatLatLng(end)
}
