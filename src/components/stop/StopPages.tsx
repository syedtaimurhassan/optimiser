import { useCallback, useState } from 'react'
import { useLocation } from 'wouter'
import type { LatLng, Route } from '../../types'
import type { StopPage } from '../../lib/stopPages'
import { formatLatLng } from '../../lib/coordinates'
import { clockAt } from '../../lib/routeSummary'
import { liveEta } from '../../lib/arrivals'
import { navPlaceUrl, type NavApp } from '../../lib/googleMaps'
import { useRoutesStore } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { titleFor } from '../../lib/routeList'
import { StopCarousel } from './StopCarousel'
import { FailureReasonSheet } from './FailureReasonSheet'
import { EditStopSheet } from './EditStopSheet'
import { StopDetailCard } from './StopDetailCard'
import { EndLocationCard } from './EndLocationCard'
import { NavAppSheet } from '../nav/NavAppSheet'

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
  /** Predicted arrivals, epoch ms, computed once by the sheet and shared. */
  etaByStopId?: ReadonlyMap<string, number>
}

export function StopPages({ route, pages, index, etaByStopId }: StopPagesProps) {
  const [, navigate] = useLocation()
  /**
   * The stop whose reason sheet is open.
   *
   * Local, not in the store: it is opened by exactly one interaction on this
   * screen and closed by dismissing it, and nothing outside the carousel has
   * any business asking whether it is up.
   */
  const [reasonStopId, setReasonStopId] = useState<string | null>(null)
  const setStopStatus = useRoutesStore((s) => s.setStopStatus)
  const updateStop = useRoutesStore((s) => s.updateStop)
  const undoStopStatus = useRoutesStore((s) => s.undoStopStatus)
  const duplicateStop = useRoutesStore((s) => s.duplicateStop)
  const removeStop = useRoutesStore((s) => s.removeStop)
  const setRouteStatus = useRoutesStore((s) => s.setRouteStatus)
  const setStopEditorId = useUiStore((s) => s.setStopEditorId)
  const editStopId = useUiStore((s) => s.stopEditorId)
  const navApp = useRoutesStore((s) => s.navApp)

  /**
   * Where a Navigate tap is headed, while we ask which app should take it.
   *
   * Only ever set on the first hand-off of the driver's life — after that the
   * app is remembered and the tap opens it directly. Holding the POINT rather
   * than a boolean is what lets the sheet's pick open the right place without
   * the carousel having moved on underneath it.
   */
  const [pendingNav, setPendingNav] = useState<LatLng | null>(null)

  const openNavigation = useCallback(
    (point: LatLng) => {
      // No preference yet: ask, and let the sheet's own tap do the opening.
      if (!navApp) {
        setPendingNav(point)
        return
      }
      openIn(navApp, point)
    },
    [navApp],
  )

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
            arrival={endArrival(route, etaByStopId)}
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
          etaMs={etaByStopId?.get(page.stop.id) ?? null}
          onClose={close}
          onNavigate={() => openNavigation({ lat: page.stop.lat, lng: page.stop.lng })}
          onSetStatus={(status) => {
            // Mark first, ask second. The tap always does the thing it says;
            // the reason is a follow-up that can be dismissed.
            setStopStatus(page.stop.id, status)
            if (status === 'failed') setReasonStopId(page.stop.id)
          }}
          onUndo={() => undoStopStatus(page.stop.id)}
          onAddReason={() => setReasonStopId(page.stop.id)}
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
      etaByStopId,
      close,
      openNavigation,
      setStopStatus,
      setReasonStopId,
      undoStopStatus,
      duplicateStop,
      removeAndMoveOn,
      setRouteStatus,
      setStopEditorId,
      navigate,
    ],
  )

  const reasonStop = reasonStopId ? route.stops.find((s) => s.id === reasonStopId) : undefined
  const editStop = editStopId ? route.stops.find((s) => s.id === editStopId) : undefined

  return (
    <>
      <StopCarousel pages={pages} index={index} onIndexChange={goToPage} renderPage={renderPage} />

      {/*
        The edit form lives here rather than on the screen because it acts on
        the stop the carousel is showing — and because closing it must leave
        the driver looking at that stop's card, which is only true if the card
        is still mounted behind it.
      */}
      {editStop && (
        <EditStopSheet
          route={route}
          stop={editStop}
          onClose={() => setStopEditorId(null)}
          onDuplicate={() => {
            const created = duplicateStop(editStop.id)
            setStopEditorId(null)
            if (created) navigate(`/route/${route.id}/stop/${created}`, { replace: true })
          }}
          onRemove={() => {
            setStopEditorId(null)
            removeAndMoveOn(editStop.id)
          }}
        />
      )}

      {/*
        Asked once, on the first Navigate this app has ever been given. The
        pick opens the URL from inside its own click handler — a hand-off
        deferred to a later tick has lost its user activation and iOS blocks
        it as a popup.
      */}
      <NavAppSheet
        open={pendingNav !== null}
        onClose={() => setPendingNav(null)}
        onPick={(app) => {
          if (pendingNav) openIn(app, pendingNav)
          setPendingNav(null)
        }}
      />

      <FailureReasonSheet
        open={reasonStop !== undefined}
        stopTitle={reasonStop ? titleFor(reasonStop) : ''}
        initialReason={reasonStop?.failureReason}
        initialNote={reasonStop?.failureNote}
        onSave={(failureReason, failureNote) => {
          if (reasonStopId) updateStop(reasonStopId, { failureReason, failureNote })
          setReasonStopId(null)
        }}
        onClose={() => setReasonStopId(null)}
      />
    </>
  )
}

/**
 * Hand one stop to the driver's chosen app.
 *
 * `noopener` is not decoration: without it the opened tab gets a handle on
 * this window through `opener` and can navigate it away.
 */
function openIn(app: NavApp, point: LatLng): void {
  window.open(navPlaceUrl(app, point), '_blank', 'noopener,noreferrer')
}

/**
 * What to call the end location.
 *
 * `Route.end` is a bare coordinate — the model has never had an address for
 * it. When a stop sits on exactly that coordinate (which is what "finish where
 * you started" and "end at the depot" both look like), borrow its address
 * rather than showing a driver two numbers.
 */
/**
 * "17:07" on the end page.
 *
 * The finish is the LAST arrival in the plan, which is the end location's own
 * — so it is read from `liveEta` rather than from the per-stop map, which by
 * construction only contains stops.
 */
function endArrival(
  route: Route,
  etaByStopId: ReadonlyMap<string, number> | undefined,
): string | null {
  if (!route.optimized || !etaByStopId) return null
  const { finishMs } = liveEta({ optimized: route.optimized, stops: route.stops, nowMs: Date.now() })
  return finishMs === null ? null : clockAt(finishMs)
}

function endTitle(route: Route): string {
  const end = route.end
  if (!end) return 'End location'
  const match = route.stops.find((s) => s.lat === end.lat && s.lng === end.lng)
  return match?.address?.title?.trim() || formatLatLng(end)
}
