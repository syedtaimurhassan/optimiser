import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GOOGLE_WAYPOINTS_DESKTOP,
  GOOGLE_WAYPOINTS_MOBILE,
  appleMapsDirectionsUrl,
  googleMapsDirectionsBatches,
  googleWaypointCap,
  navDirectionsBatches,
  navPlaceUrl,
  wazeNavigateUrl,
  type DirectionsBatch,
} from './googleMaps.ts'
import type { LatLng } from '../types.ts'

/** n points on a line, distinct enough to be told apart in a URL. */
const line = (n: number): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 55 + i / 1000, lng: 12 + i / 1000 }))

const paramsOf = (url: string) => new URL(url).searchParams

/** How many intermediate waypoints a Google leg actually carries. */
const waypointCount = (url: string): number => {
  const wp = paramsOf(url).get('waypoints')
  return wp ? wp.split('|').length : 0
}

/**
 * The property that matters: following the legs in order drives the whole
 * route, once. Every consecutive pair of stops must be covered by exactly one
 * leg, with no gap between legs and no stop visited twice.
 */
function assertChainsWholeRoute(batches: DirectionsBatch[], pointCount: number) {
  assert.ok(batches.length > 0, 'expected at least one leg')
  assert.equal(batches[0].fromIndex, 0, 'first leg must start at the route start')
  assert.equal(
    batches[batches.length - 1].toIndex,
    pointCount - 1,
    'last leg must finish at the route end',
  )
  for (let i = 1; i < batches.length; i++) {
    assert.equal(
      batches[i].fromIndex,
      batches[i - 1].toIndex,
      `leg ${i} must start where leg ${i - 1} finished`,
    )
  }
  for (const b of batches) {
    assert.ok(b.toIndex > b.fromIndex, 'a leg that goes nowhere is not a leg')
  }
}

// ------------------------------------------------------------------- the cap

test('the cap is three on a phone and nine on a desktop', () => {
  assert.equal(googleWaypointCap('ios'), GOOGLE_WAYPOINTS_MOBILE)
  assert.equal(googleWaypointCap('android'), GOOGLE_WAYPOINTS_MOBILE)
  assert.equal(googleWaypointCap('desktop'), GOOGLE_WAYPOINTS_DESKTOP)
})

test('an unrecognised platform is treated as mobile, not as desktop', () => {
  // Guessing desktop on a phone drops stops; guessing mobile on a desktop
  // costs a tap. Only one of those is a wrong route.
  assert.equal(googleWaypointCap('unknown'), GOOGLE_WAYPOINTS_MOBILE)
})

// --------------------------------------------------------------- google legs

test('no leg exceeds the mobile cap', () => {
  const batches = googleMapsDirectionsBatches(line(20), GOOGLE_WAYPOINTS_MOBILE)
  for (const b of batches) {
    assert.ok(
      waypointCount(b.url) <= GOOGLE_WAYPOINTS_MOBILE,
      `leg carried ${waypointCount(b.url)} waypoints, over the limit of ${GOOGLE_WAYPOINTS_MOBILE}`,
    )
  }
})

test('a 20-stop route chains without gaps at either cap', () => {
  assertChainsWholeRoute(googleMapsDirectionsBatches(line(20), GOOGLE_WAYPOINTS_MOBILE), 20)
  assertChainsWholeRoute(googleMapsDirectionsBatches(line(20), GOOGLE_WAYPOINTS_DESKTOP), 20)
})

test('the mobile cap needs more legs than the desktop one for the same route', () => {
  const mobile = googleMapsDirectionsBatches(line(20), GOOGLE_WAYPOINTS_MOBILE)
  const desktop = googleMapsDirectionsBatches(line(20), GOOGLE_WAYPOINTS_DESKTOP)
  // 19 hops. A leg covers cap + 1 of them, so mobile needs ceil(19/4) = 5 and
  // desktop needs ceil(19/10) = 2.
  assert.equal(mobile.length, 5)
  assert.equal(desktop.length, 2)
})

test('a five-point route is one leg on mobile — three waypoints exactly', () => {
  const batches = googleMapsDirectionsBatches(line(5), GOOGLE_WAYPOINTS_MOBILE)
  assert.equal(batches.length, 1)
  assert.equal(waypointCount(batches[0].url), 3)
})

test('a six-point route is where the old nine-waypoint assumption started lying', () => {
  // Under the old constant this was one URL carrying four waypoints, which
  // Google silently refuses on a phone.
  const batches = googleMapsDirectionsBatches(line(6), GOOGLE_WAYPOINTS_MOBILE)
  assert.equal(batches.length, 2)
  assertChainsWholeRoute(batches, 6)
})

test('two points make one leg with no waypoints parameter at all', () => {
  const [batch] = googleMapsDirectionsBatches(line(2), GOOGLE_WAYPOINTS_MOBILE)
  assert.equal(paramsOf(batch.url).get('waypoints'), null)
  assert.equal(paramsOf(batch.url).get('travelmode'), 'driving')
  assert.equal(paramsOf(batch.url).get('api'), '1')
})

test('fewer than two points is no route to hand off', () => {
  assert.deepEqual(googleMapsDirectionsBatches([], GOOGLE_WAYPOINTS_MOBILE), [])
  assert.deepEqual(googleMapsDirectionsBatches(line(1), GOOGLE_WAYPOINTS_MOBILE), [])
})

// ------------------------------------------------------------ waze and apple

test('Waze and Apple Maps get one leg per hop, because they take no waypoints', () => {
  for (const app of ['waze', 'apple'] as const) {
    const batches = navDirectionsBatches(app, line(6), 'ios')
    assert.equal(batches.length, 5, `${app} should produce one link per hop`)
    assertChainsWholeRoute(batches, 6)
  }
})

test('a Waze link navigates rather than just showing the place', () => {
  const url = wazeNavigateUrl({ lat: 55.75, lng: 12.5 })
  assert.equal(paramsOf(url).get('navigate'), 'yes')
  assert.equal(paramsOf(url).get('ll'), '55.75,12.5')
})

test('an Apple link carries origin, destination and driving mode', () => {
  const url = appleMapsDirectionsUrl({ lat: 55.75, lng: 12.5 }, { lat: 55.7, lng: 12.4 })
  assert.equal(paramsOf(url).get('saddr'), '55.7,12.4')
  assert.equal(paramsOf(url).get('daddr'), '55.75,12.5')
  assert.equal(paramsOf(url).get('dirflg'), 'd')
})

test('an Apple link with no origin omits saddr rather than sending it empty', () => {
  // An empty saddr is a different request from an absent one, and only the
  // absent form means "from wherever I am".
  const url = appleMapsDirectionsUrl({ lat: 55.75, lng: 12.5 })
  assert.equal(paramsOf(url).has('saddr'), false)
})

test('a single place opens in whichever app the driver picked', () => {
  const p = { lat: 55.75, lng: 12.5 }
  assert.match(navPlaceUrl('google', p), /^https:\/\/www\.google\.com\/maps\/search\//)
  assert.match(navPlaceUrl('waze', p), /^https:\/\/waze\.com\/ul\?/)
  assert.match(navPlaceUrl('apple', p), /^https:\/\/maps\.apple\.com\//)
})

test('every generated URL stays inside the 8 KB ceiling M12 measured', () => {
  // M12 established that ~8,192 bytes is where URL handling starts failing.
  // A 1,000-stop route is the cap the planner enforces, so that is the shape
  // this has to survive.
  for (const app of ['google', 'waze', 'apple'] as const) {
    for (const b of navDirectionsBatches(app, line(1000), 'android')) {
      assert.ok(b.url.length < 8192, `${app} produced a ${b.url.length}-byte URL`)
    }
  }
})
