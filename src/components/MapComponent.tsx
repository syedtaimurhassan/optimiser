import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { useShallow } from 'zustand/react/shallow'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, Stop } from '../types'
import { formatLatLng } from '../lib/coordinates'
import { useRouteStore } from '../store/routeStore'

interface MapMarker {
  point: LatLng
  label: string
  color: string
  role: string
  stop?: Stop
  isStart: boolean
  isEnd: boolean
}

const ckey = (p: LatLng) => `${p.lat},${p.lng}`
const sameCoord = (a: LatLng | null, b: LatLng) =>
  !!a && a.lat === b.lat && a.lng === b.lng

// White glyphs for the Start (flag) and End (checkered flag) preview markers,
// so anchors read as anchors at a glance instead of plain "S"/"E" letters.
const START_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M6 3.5a1 1 0 0 1 2 0V21a1 1 0 0 1-2 0Z" fill="#fff"/>' +
  '<path d="M8 4h9.2c.7 0 1 .8.5 1.3L15 8l1.7 2.7c.4.6 0 1.3-.6 1.3H8V4Z" fill="#fff"/></svg>'
const END_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M6 3.5a1 1 0 0 1 2 0V21a1 1 0 0 1-2 0Z" fill="#fff"/>' +
  '<path d="M8 4h10v8H8Z" fill="#fff"/>' +
  '<g fill="#e11d48">' +
  '<rect x="10.5" y="4" width="2.5" height="2"/><rect x="15.5" y="4" width="2.5" height="2"/>' +
  '<rect x="8" y="6" width="2.5" height="2"/><rect x="13" y="6" width="2.5" height="2"/>' +
  '<rect x="10.5" y="8" width="2.5" height="2"/><rect x="15.5" y="8" width="2.5" height="2"/>' +
  '<rect x="8" y="10" width="2.5" height="2"/><rect x="13" y="10" width="2.5" height="2"/>' +
  '</g></svg>'

/**
 * CSS-based circular marker (avoids Leaflet's broken default marker images).
 * Carries `data-stop-id` for hover-sync, a `--next` class for the pulse, and an
 * SVG glyph for Start/End anchors.
 */
function buildIcon(m: MapMarker): L.DivIcon {
  const classes = ['ro-marker']
  if (m.role === 'Next') classes.push('ro-marker--next')
  const dataId = m.stop ? ` data-stop-id="${m.stop.id}"` : ''
  const inner = m.role === 'Start' ? START_SVG : m.role === 'End' ? END_SVG : m.label
  return L.divIcon({
    className: '',
    html: `<div class="${classes.join(' ')}"${dataId} style="
      width:26px;height:26px;border-radius:50%;
      background:${m.color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 12px system-ui,sans-serif;">${inner}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

/** Toggles the `.is-hovered` class on the marker matching `hoveredStopId`,
 *  mirroring list ↔ map highlight without rebuilding every marker on hover. */
function HoverSync() {
  const hoveredStopId = useRouteStore((s) => s.hoveredStopId)
  const map = useMap()
  useEffect(() => {
    const root = map.getContainer()
    root
      .querySelectorAll('.ro-marker.is-hovered')
      .forEach((el) => el.classList.remove('is-hovered'))
    if (hoveredStopId) {
      const el = root.querySelector(`.ro-marker[data-stop-id="${CSS.escape(hoveredStopId)}"]`)
      el?.classList.add('is-hovered')
    }
  }, [hoveredStopId, map])
  return null
}

/** When "Set on map" is active, the next map click drops the start/end anchor
 *  at the clicked coordinate and exits placement mode. Also toggles the
 *  crosshair cursor (MapContainer's className is init-only, so we set the class
 *  on the live container element instead). */
function PlacementClick() {
  const mode = useRouteStore((s) => s.mapPlacementMode)
  const setStart = useRouteStore((s) => s.setStart)
  const setEnd = useRouteStore((s) => s.setEnd)
  const setMode = useRouteStore((s) => s.setMapPlacementMode)
  const map = useMapEvents({
    click(e) {
      if (!mode) return
      const p = {
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      }
      if (mode === 'start') setStart(p)
      else setEnd(p)
      setMode(null)
    },
  })
  useEffect(() => {
    map.getContainer().classList.toggle('ro-placing', !!mode)
  }, [mode, map])
  return null
}

/** Fit the map to the given points whenever they change. */
function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [50, 50] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  return null
}

/** Small button used inside a marker popup (44px min touch target). */
function PopupBtn({
  onClick,
  danger,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center rounded border px-3 text-xs font-medium ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

interface PopupActionProps {
  m: MapMarker
  setStart: (v: LatLng | null) => void
  setEnd: (v: LatLng | null) => void
  markDone: (lat: number, lng: number) => void
  removeWaypoint: (id: string) => void
}

/** Marker popup content + actions. Uses the map instance to close the popup
 *  immediately after an action (no lingering popup, zero flicker). */
function PopupActions({ m, setStart, setEnd, markDone, removeWaypoint }: PopupActionProps) {
  const map = useMap()
  const close = () => map.closePopup()
  const { lat, lng } = m.point
  return (
    <div className="min-w-[10rem]">
      <strong>
        {m.role}
        {m.stop ? ` #${m.stop.num}` : ''}
      </strong>
      <div className="text-xs text-slate-500">{formatLatLng(m.point)}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {m.isStart ? (
          <PopupBtn onClick={() => (setStart(null), close())}>Unset start</PopupBtn>
        ) : (
          <PopupBtn onClick={() => (setStart({ lat, lng }), close())}>Set start</PopupBtn>
        )}
        {m.isEnd ? (
          <PopupBtn onClick={() => (setEnd(null), close())}>Unset end</PopupBtn>
        ) : (
          <PopupBtn onClick={() => (setEnd({ lat, lng }), close())}>Set end</PopupBtn>
        )}
        {m.stop && !m.stop.delivered && (
          <PopupBtn onClick={() => (markDone(lat, lng), close())}>✓ Delivered</PopupBtn>
        )}
        <PopupBtn
          danger
          onClick={() => {
            if (m.stop) removeWaypoint(m.stop.id)
            else {
              if (m.isStart) setStart(null)
              if (m.isEnd) setEnd(null)
            }
            close()
          }}
        >
          Remove
        </PopupBtn>
      </div>
    </div>
  )
}

export function MapComponent() {
  const { startLocation, endLocation, waypoints, optimizedRoute } = useRouteStore(
    useShallow((s) => ({
      startLocation: s.startLocation,
      endLocation: s.endLocation,
      waypoints: s.waypoints,
      optimizedRoute: s.optimizedRoute,
    })),
  )
  const setStart = useRouteStore((s) => s.setStart)
  const setEnd = useRouteStore((s) => s.setEnd)
  const markDone = useRouteStore((s) => s.markDeliveredByCoord)
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  const setHoveredStopId = useRouteStore((s) => s.setHoveredStopId)
  const placementMode = useRouteStore((s) => s.mapPlacementMode)
  const setPlacementMode = useRouteStore((s) => s.setMapPlacementMode)

  // Markers to draw. With a route: the ordered stops, minus any removed since;
  // delivered fade to grey; the current (next) stop is green, the last red.
  // Without a route: the preview (start green, stops blue, end red).
  const markers = useMemo<MapMarker[]>(() => {
    const stopByKey = new Map(waypoints.map((w) => [ckey(w), w]))
    const isAnchor = (p: LatLng) =>
      sameCoord(startLocation, p) || sameCoord(endLocation, p)
    const mk = (point: LatLng, label: string, color: string, role: string): MapMarker => ({
      point,
      label,
      color,
      role,
      stop: stopByKey.get(ckey(point)),
      isStart: sameCoord(startLocation, point),
      isEnd: sameCoord(endLocation, point),
    })

    if (optimizedRoute) {
      // Each entry keeps its stable route position (`seq`); removed stops drop out.
      const entries = optimizedRoute.orderedWaypoints
        .map((point, idx) => ({ point, seq: idx + 1 }))
        .filter(({ point }) => stopByKey.has(ckey(point)) || isAnchor(point))
      const remainingKeys = entries
        .filter(({ point }) => {
          const st = stopByKey.get(ckey(point))
          return st ? !st.delivered : isAnchor(point)
        })
        .map(({ point }) => ckey(point))
      const currentKey = remainingKeys[0]
      const lastKey = remainingKeys[remainingKeys.length - 1]

      return entries.map(({ point, seq }) => {
        const k = ckey(point)
        const st = stopByKey.get(k)
        const color = st?.delivered
          ? '#cbd5e1'
          : k === currentKey
            ? '#059669'
            : k === lastKey
              ? '#e11d48'
              : '#2563eb'
        const role = st?.delivered
          ? 'Delivered'
          : k === currentKey
            ? 'Next'
            : k === lastKey
              ? 'Last'
              : 'Stop'
        // Marker label = delivery sequence (route position); the popup shows the
        // stable stop identity (#num).
        return mk(point, String(seq), color, role)
      })
    }

    const list: MapMarker[] = []
    if (startLocation) list.push(mk(startLocation, 'S', '#059669', 'Start'))
    waypoints
      .filter((w) => !w.delivered)
      .forEach((point) => list.push(mk(point, String(point.num), '#2563eb', 'Stop')))
    if (endLocation) list.push(mk(endLocation, 'E', '#e11d48', 'End'))
    return list
  }, [optimizedRoute, startLocation, endLocation, waypoints])

  const routePositions = useMemo<[number, number][]>(() => {
    if (!optimizedRoute) return []
    return optimizedRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  }, [optimizedRoute])

  const boundsPoints = useMemo(() => markers.map((m) => m.point), [markers])
  const fitKey = boundsPoints.map((p) => `${p.lat},${p.lng}`).join('|')

  return (
    <div className="relative h-full w-full">
      {placementMode && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-center p-2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm shadow-md">
            <span className="font-medium text-slate-700">
              Click the map to set the {placementMode === 'start' ? 'Start' : 'End'}
            </span>
            <button
              onClick={() => setPlacementMode(null)}
              className="inline-flex min-h-[36px] items-center rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {markers.map((m, i) => (
        <Marker
          key={`${m.point.lat},${m.point.lng},${i}`}
          position={[m.point.lat, m.point.lng]}
          icon={buildIcon(m)}
          eventHandlers={
            m.stop
              ? {
                  mouseover: () => setHoveredStopId(m.stop!.id),
                  mouseout: () => setHoveredStopId(null),
                }
              : undefined
          }
        >
          <Popup>
            <PopupActions
              m={m}
              setStart={setStart}
              setEnd={setEnd}
              markDone={markDone}
              removeWaypoint={removeWaypoint}
            />
          </Popup>
        </Marker>
      ))}

      {routePositions.length > 0 && (
        <Polyline
          positions={routePositions}
          pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }}
        />
      )}

      <FitBounds points={boundsPoints} fitKey={fitKey} />
      <HoverSync />
      <PlacementClick />
      </MapContainer>
    </div>
  )
}
