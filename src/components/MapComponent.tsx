import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, OptimizedRoute } from '../types'
import { formatLatLng } from '../lib/coordinates'

interface Props {
  startLocation: LatLng | null
  endLocation: LatLng | null
  waypoints: LatLng[]
  optimizedRoute: OptimizedRoute | null
}

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

const START_ICON = markerIcon('#059669', 'S') // emerald
const END_ICON = markerIcon('#e11d48', 'E') // rose

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

export function MapComponent({
  startLocation,
  endLocation,
  waypoints,
  optimizedRoute,
}: Props) {
  // Which blue waypoints to draw, and what number to label them with.
  // After optimization we use the reordered sequence (start=1 ... end=last),
  // so an intermediate stop at orderedWaypoints[i] is stop number i+1.
  const blueStops = useMemo(() => {
    if (optimizedRoute) {
      const seq = optimizedRoute.orderedWaypoints
      return seq.slice(1, -1).map((point, i) => ({
        point,
        number: i + 2, // +1 for 1-based, +1 because start occupies slot 1
        optimized: true,
      }))
    }
    return waypoints.map((point, i) => ({
      point,
      number: i + 1,
      optimized: false,
    }))
  }, [optimizedRoute, waypoints])

  // Route geometry ([lng, lat]) -> Leaflet positions ([lat, lng]).
  const routePositions = useMemo<[number, number][]>(() => {
    if (!optimizedRoute) return []
    return optimizedRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  }, [optimizedRoute])

  // Every point the map should frame, plus a stable key to trigger re-fitting.
  const boundsPoints = useMemo(() => {
    const pts: LatLng[] = []
    if (startLocation) pts.push(startLocation)
    blueStops.forEach((s) => pts.push(s.point))
    if (endLocation) pts.push(endLocation)
    return pts
  }, [startLocation, endLocation, blueStops])

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

      {startLocation && (
        <Marker
          position={[startLocation.lat, startLocation.lng]}
          icon={START_ICON}
        >
          <Popup>
            <strong>Start</strong>
            <br />
            {formatLatLng(startLocation)}
          </Popup>
        </Marker>
      )}

      {blueStops.map((stop, i) => (
        <Marker
          key={`${stop.point.lat},${stop.point.lng},${i}`}
          position={[stop.point.lat, stop.point.lng]}
          icon={markerIcon('#2563eb', String(stop.number))}
        >
          <Popup>
            <strong>
              {stop.optimized
                ? `Stop ${stop.number} (optimized)`
                : `Waypoint ${stop.number}`}
            </strong>
            <br />
            {formatLatLng(stop.point)}
          </Popup>
        </Marker>
      ))}

      {endLocation && (
        <Marker position={[endLocation.lat, endLocation.lng]} icon={END_ICON}>
          <Popup>
            <strong>End</strong>
            <br />
            {formatLatLng(endLocation)}
          </Popup>
        </Marker>
      )}

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
