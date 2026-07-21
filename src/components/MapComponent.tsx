import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
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

/** CSS-based circular marker (avoids Leaflet's broken default marker images). */
function markerIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 12px system-ui,sans-serif;">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
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

/** Small button used inside a marker popup. */
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
      className={`rounded border px-2 py-0.5 text-xs font-medium ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
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
    <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {markers.map((m, i) => (
        <Marker
          key={`${m.point.lat},${m.point.lng},${i}`}
          position={[m.point.lat, m.point.lng]}
          icon={markerIcon(m.color, m.label)}
        >
          <Popup>
            <div className="min-w-[10rem]">
              <strong>
                {m.role}
                {m.stop ? ` #${m.stop.num}` : ''}
              </strong>
              <div className="text-xs text-slate-500">{formatLatLng(m.point)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.isStart ? (
                  <PopupBtn onClick={() => setStart(null)}>Unset start</PopupBtn>
                ) : (
                  <PopupBtn onClick={() => setStart({ lat: m.point.lat, lng: m.point.lng })}>
                    Set start
                  </PopupBtn>
                )}
                {m.isEnd ? (
                  <PopupBtn onClick={() => setEnd(null)}>Unset end</PopupBtn>
                ) : (
                  <PopupBtn onClick={() => setEnd({ lat: m.point.lat, lng: m.point.lng })}>
                    Set end
                  </PopupBtn>
                )}
                {m.stop && !m.stop.delivered && (
                  <PopupBtn onClick={() => markDone(m.point.lat, m.point.lng)}>
                    ✓ Delivered
                  </PopupBtn>
                )}
                <PopupBtn
                  danger
                  onClick={() => {
                    if (m.stop) removeWaypoint(m.stop.id)
                    else {
                      if (m.isStart) setStart(null)
                      if (m.isEnd) setEnd(null)
                    }
                  }}
                >
                  Remove
                </PopupBtn>
              </div>
            </div>
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
    </MapContainer>
  )
}
