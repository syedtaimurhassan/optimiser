import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useShallow } from 'zustand/react/shallow'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../types'
import { formatLatLng } from '../lib/coordinates'
import { useRouteStore } from '../store/routeStore'

/**
 * Build a CSS-based circular marker. Using divIcon avoids the classic
 * "broken default marker image" problem with Leaflet under bundlers, and
 * lets us render colored, numbered pins with no external assets.
 */
function markerIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '', // clear Leaflet's default white-box styling
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

/**
 * Imperatively fit the map to the given points whenever they change.
 * `fitKey` is a stable serialization so the effect only re-runs on real change.
 */
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

export function MapComponent() {
  // Re-renders only when one of these four shallow-changes — not on K edits,
  // status ticks, or errors.
  const { startLocation, endLocation, waypoints, optimizedRoute } = useRouteStore(
    useShallow((s) => ({
      startLocation: s.startLocation,
      endLocation: s.endLocation,
      waypoints: s.waypoints,
      optimizedRoute: s.optimizedRoute,
    })),
  )

  // Markers to draw:
  //  - with a route: EVERY ordered stop (first green, last red, middle blue),
  //    numbered by visiting order — works whether or not start/end were fixed.
  //  - without a route: the preview — start (green), end (red), candidates (blue).
  const markers = useMemo(() => {
    if (optimizedRoute) {
      const seq = optimizedRoute.orderedWaypoints
      const last = seq.length - 1
      return seq.map((point, i) => ({
        point,
        label: String(i + 1),
        color: i === 0 ? '#059669' : i === last ? '#e11d48' : '#2563eb',
        role: i === 0 ? 'Start' : i === last ? 'End' : `Stop ${i + 1}`,
      }))
    }
    const list: { point: LatLng; label: string; color: string; role: string }[] = []
    if (startLocation)
      list.push({ point: startLocation, label: 'S', color: '#059669', role: 'Start' })
    waypoints
      .filter((w) => !w.delivered)
      .forEach((point, i) =>
        list.push({ point, label: String(i + 1), color: '#2563eb', role: `Waypoint ${i + 1}` }),
      )
    if (endLocation)
      list.push({ point: endLocation, label: 'E', color: '#e11d48', role: 'End' })
    return list
  }, [optimizedRoute, startLocation, endLocation, waypoints])

  // Route geometry ([lng, lat]) -> Leaflet positions ([lat, lng]).
  const routePositions = useMemo<[number, number][]>(() => {
    if (!optimizedRoute) return []
    return optimizedRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  }, [optimizedRoute])

  const boundsPoints = useMemo(() => markers.map((m) => m.point), [markers])
  const fitKey = boundsPoints.map((p) => `${p.lat},${p.lng}`).join('|')

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="h-full w-full"
      scrollWheelZoom
    >
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
            <strong>{m.role}</strong>
            <br />
            {formatLatLng(m.point)}
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
