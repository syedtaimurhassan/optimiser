import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createValhallaProvider } from './valhalla.ts'
import { RoutingError, type MatrixBand } from './types.ts'

const points = [
  { lat: 52.517, lng: 13.388 },
  { lat: 52.529, lng: 13.397 },
  { lat: 52.523, lng: 13.428 },
]

const band = (sources: number[], destinations: number[], objective: 'duration' | 'distance'): MatrixBand => ({
  points,
  sources,
  destinations,
  objective,
})

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const seen: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: string, requestInit: RequestInit) => {
    seen.push({ url: String(url), init: requestInit })
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: '',
      json: async () => body,
    } as Response
  }) as typeof fetch
  return seen
}

const cell = (from: number, to: number, time: number | null, distance: number | null) => ({
  from_index: from,
  to_index: to,
  time,
  distance,
})

describe('valhalla provider', () => {
  test('sends the identifying header FOSSGIS asks for', async () => {
    const seen = stubFetch({ sources_to_targets: [[cell(0, 0, 60, 1)]] })
    await createValhallaProvider().table(band([0], [1], 'duration'))

    const headers = seen[0].init.headers as Record<string, string>
    assert.equal(headers['X-Client-Id'], 'syedtaimurhassan.github.io/optimiser')
    assert.equal(seen[0].init.method, 'POST')
  })

  test('converts kilometres to metres on a distance objective', async () => {
    stubFetch({ sources_to_targets: [[cell(0, 0, 548, 3.844)]] })
    const rows = await createValhallaProvider().table(band([0], [1], 'distance'))
    assert.deepEqual(rows, [[3844]])
  })

  test('returns seconds untouched on a duration objective', async () => {
    stubFetch({ sources_to_targets: [[cell(0, 0, 548, 3.844)]] })
    const rows = await createValhallaProvider().table(band([0], [1], 'duration'))
    assert.deepEqual(rows, [[548]])
  })

  /*
    The failure that never announces itself: a response whose cells are not in
    the order they were asked for prices the wrong pair of stops, and the route
    is merely a bit worse rather than visibly broken.
  */
  test('reads each cell by its own indices, not by its position', async () => {
    stubFetch({
      sources_to_targets: [[cell(0, 1, 200, 2), cell(0, 0, 100, 1)]],
    })
    const rows = await createValhallaProvider().table(band([0], [1, 2], 'duration'))
    assert.deepEqual(rows, [[100, 200]])
  })

  test('an unroutable pair stays null rather than becoming zero', async () => {
    stubFetch({ sources_to_targets: [[cell(0, 0, null, null)]] })
    const rows = await createValhallaProvider().table(band([0], [1], 'duration'))
    assert.deepEqual(rows, [[null]])
  })

  test('“exceeded max locations” is tooBig, not a reason to look elsewhere', async () => {
    stubFetch({ error_code: 150, error: 'Exceeded max locations: 2500.000000' }, { ok: false, status: 400 })
    await assert.rejects(
      () => createValhallaProvider().table(band([0], [1], 'duration')),
      (e: RoutingError) => e.kind === 'tooBig',
    )
  })

  test('refuses a band over the cell cap before it reaches the network', async () => {
    const seen = stubFetch({ sources_to_targets: [] })
    const many = Array.from({ length: 51 }, (_, i) => i % points.length)
    await assert.rejects(
      () => createValhallaProvider().table({ ...band(many, many, 'duration'), points }),
      (e: RoutingError) => e.kind === 'tooBig',
    )
    assert.equal(seen.length, 0)
  })

  test('a row count that disagrees with the request is a bad response', async () => {
    stubFetch({ sources_to_targets: [] })
    await assert.rejects(
      () => createValhallaProvider().table(band([0], [1], 'duration')),
      (e: RoutingError) => e.kind === 'badResponse',
    )
  })
})
