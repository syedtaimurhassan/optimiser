import { test } from 'node:test'
import assert from 'node:assert/strict'
import { END_PAGE_ID, buildStopPages, pageIndexById, pageLabel, pagePoint } from './stopPages.ts'
import type { AddressedStop, Route } from '../types.ts'

function stop(id: string, over: Partial<AddressedStop> = {}): AddressedStop {
  return {
    id,
    stopId: id.toUpperCase(),
    originalPosition: 1,
    lat: 55.68,
    lng: 12.53,
    kind: 'delivery',
    order: 'auto',
    status: 'pending',
    statusHistory: [],
    ...over,
  }
}

const route = (over: Partial<Route> = {}): Pick<Route, 'stops' | 'optimized' | 'end'> => ({
  stops: [stop('a'), stop('b'), stop('c')],
  end: { lat: 55.7, lng: 12.6 },
  optimized: undefined,
  ...over,
})

test('pages are the stops in visit order, then the end location', () => {
  const pages = buildStopPages(route())
  assert.deepEqual(
    pages.map((p) => p.id),
    ['a', 'b', 'c', END_PAGE_ID],
  )
})

test('a stop page carries its position and the route total', () => {
  const pages = buildStopPages(route())
  const second = pages[1]
  assert.equal(second.kind, 'stop')
  if (second.kind !== 'stop') return
  assert.equal(second.position, 2)
  // The end page is not a stop and must not inflate the counter.
  assert.equal(second.total, 3)
})

test('a route with no end anchor has no end page', () => {
  const pages = buildStopPages(route({ end: null }))
  assert.deepEqual(
    pages.map((p) => p.id),
    ['a', 'b', 'c'],
  )
})

test('solved order wins over entry order', () => {
  const pages = buildStopPages(
    route({
      optimized: {
        orderedWaypoints: [],
        orderedStopIds: [null, 'c', 'a', 'b', null],
        arrivalSec: [],
        geometry: { type: 'LineString', coordinates: [] },
        distanceMeters: 0,
        durationSeconds: 0,
        candidatesVisited: 3,
        candidatesTotal: 3,
      },
    }),
  )
  assert.deepEqual(
    pages.map((p) => p.id),
    ['c', 'a', 'b', END_PAGE_ID],
  )
})

test('an unknown id resolves to no page', () => {
  const pages = buildStopPages(route())
  assert.equal(pageIndexById(pages, 'nope'), -1)
  assert.equal(pageIndexById(pages, null), -1)
  assert.equal(pageIndexById(pages, END_PAGE_ID), 3)
})

test('a stop whose id is literally "end" still wins over the end page', () => {
  const pages = buildStopPages(route({ stops: [stop(END_PAGE_ID)], end: { lat: 1, lng: 2 } }))
  assert.equal(pageIndexById(pages, END_PAGE_ID), 0)
  assert.equal(pages[0].kind, 'stop')
})

test('the peek label names the stop by its immutable label and address', () => {
  const pages = buildStopPages(
    route({
      stops: [
        stop('a', {
          stopId: 'D7',
          address: { title: 'Løvfrøvej 6', subtitle: 'Bagsværd, 2880', source: 'geocoder' },
        }),
      ],
    }),
  )
  assert.equal(pageLabel(pages[0]), 'D7 Løvfrøvej 6')
  assert.equal(pageLabel(pages[1]), 'End location')
})

test('a coordinate-only stop labels itself with its coordinates', () => {
  const pages = buildStopPages(route({ stops: [stop('a', { stopId: 'D1' })], end: null }))
  assert.match(pageLabel(pages[0]), /^D1 55\.68/)
})

test('every page yields a camera point', () => {
  const pages = buildStopPages(route())
  assert.deepEqual(pagePoint(pages[0]), { lat: 55.68, lng: 12.53 })
  assert.deepEqual(pagePoint(pages[3]), { lat: 55.7, lng: 12.6 })
})
