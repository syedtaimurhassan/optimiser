import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { cacheKey, coordKey, createGeocodeCache, createMemoryCacheStore } from './cache.ts'
import { createGeocodingService } from './service.ts'
import { GeocodingError, composeAddressLines, isFailoverWorthy } from './types.ts'
import type { GeocodingProvider, Suggestion } from './types.ts'

// ─────────────────────────────────────────────────────────── test doubles

function suggestion(title: string, providerId: string): Suggestion {
  return {
    address: { title, subtitle: '', source: 'geocoder' },
    lat: 55.7,
    lng: 12.4,
    providerId,
  }
}

interface FakeOptions {
  id: string
  fail?: GeocodingError
  onCall?: () => void
}

function fakeProvider({ id, fail, onCall }: FakeOptions): GeocodingProvider {
  return {
    id,
    label: id,
    attribution: `© ${id}`,
    async autocomplete() {
      onCall?.()
      if (fail) throw fail
      return [suggestion(`result from ${id}`, id)]
    },
    async reverse() {
      onCall?.()
      if (fail) throw fail
      return { title: `reverse from ${id}`, subtitle: '', source: 'reverse' as const }
    },
  }
}

const rateLimited = (id: string) => new GeocodingError('rateLimited', id, 'quota')
const unauthorized = (id: string) => new GeocodingError('unauthorized', id, 'bad key')

// ───────────────────────────────────────────────────────────── cache keys

describe('cache keys', () => {
  test('normalisation collapses case and whitespace so one question costs one credit', () => {
    const a = cacheKey('p', 'autocomplete', '  Løvfrøvej   6 ')
    const b = cacheKey('p', 'autocomplete', 'løvfrøvej 6')
    assert.equal(a, b)
  })

  test('decomposed and precomposed Unicode collapse to the same key', () => {
    // "\u00e5" as one codepoint vs "a" + combining ring (U+030A) \u2014 what a keyboard
    // and a macOS-exported CSV respectively tend to produce. They render
    // identically and compare unequal, so without NFC the same street is billed
    // twice. Written as escapes because a literal here would be a test nobody
    // could verify by reading.
    const precomposed = '\u00c5boulevarden'
    const decomposed = 'A\u030Aboulevarden'
    assert.notEqual(precomposed, decomposed, 'the two inputs must genuinely differ')

    assert.equal(
      cacheKey('p', 'autocomplete', precomposed),
      cacheKey('p', 'autocomplete', decomposed),
    )
  })

  test('a different bias is a different question', () => {
    assert.notEqual(
      cacheKey('p', 'autocomplete', 'station road', 'cph'),
      cacheKey('p', 'autocomplete', 'station road', 'aarhus'),
    )
  })

  test('coordinate keys round to ~1m so a hair-width pin drag reuses the answer', () => {
    assert.equal(coordKey(55.747208, 12.453822), coordKey(55.7472081, 12.4538221))
    assert.notEqual(coordKey(55.7472, 12.4538), coordKey(55.7481, 12.4538))
  })
})

// ───────────────────────────────────────────────────────────────── cache

describe('cache', () => {
  test('expires entries past the TTL rather than serving them', async () => {
    let clock = 1_000
    const cache = createGeocodeCache(createMemoryCacheStore(), {
      ttlMs: 500,
      now: () => clock,
    })

    await cache.set('k', 'value')
    assert.equal(await cache.get('k'), 'value')

    clock += 501
    assert.equal(await cache.get('k'), undefined)
  })

  test('a storage failure is a miss, never an exception', async () => {
    const broken = {
      async get(): Promise<never> {
        throw new Error('IndexedDB unavailable')
      },
      async put(): Promise<never> {
        throw new Error('quota exceeded')
      },
      async delete() {},
      async keys() {
        return []
      },
    }
    const cache = createGeocodeCache(broken)
    await assert.doesNotReject(() => cache.set('k', 1))
    assert.equal(await cache.get('k'), undefined)
  })

  test('trims to the entry ceiling oldest-first', async () => {
    let clock = 0
    const store = createMemoryCacheStore()
    const cache = createGeocodeCache(store, { maxEntries: 3, now: () => ++clock })

    for (const k of ['a', 'b', 'c', 'd', 'e']) await cache.set(k, k)

    const keys = await store.keys()
    assert.equal(keys.length, 3)
    assert.ok(!keys.includes('a'), 'the oldest key should have been dropped')
    assert.ok(keys.includes('e'), 'the newest key must survive')
  })
})

// ────────────────────────────────────────────────────────────── failover

describe('failover', () => {
  test('a rate-limited primary falls over to the fallback and reports degraded', async () => {
    const service = createGeocodingService({
      primary: fakeProvider({ id: 'primary', fail: rateLimited('primary') }),
      fallback: fakeProvider({ id: 'fallback' }),
    })

    const results = await service.autocomplete('Løvfrøvej')
    assert.equal(results[0].providerId, 'fallback')

    const status = service.getStatus()
    assert.equal(status.degraded, true)
    assert.equal(status.reason, 'rateLimited')
    assert.equal(status.attribution, '© fallback')
  })

  test('a rate-limited primary is left alone for the cooldown, then retried', async () => {
    let clock = 0
    let primaryCalls = 0
    const service = createGeocodingService({
      primary: fakeProvider({
        id: 'primary',
        fail: rateLimited('primary'),
        onCall: () => primaryCalls++,
      }),
      fallback: fakeProvider({ id: 'fallback' }),
      cooldownMs: 1000,
      now: () => clock,
    })

    await service.autocomplete('one')
    assert.equal(primaryCalls, 1)

    // Still inside the cooldown: the primary must not be touched again.
    await service.autocomplete('two')
    assert.equal(primaryCalls, 1, 'an exhausted quota must not be hammered')

    clock += 1001
    await service.autocomplete('three')
    assert.equal(primaryCalls, 2, 'after the cooldown the primary is tried again')
  })

  test('a rejected key stops the primary permanently — it does not heal', async () => {
    let clock = 0
    let primaryCalls = 0
    const service = createGeocodingService({
      primary: fakeProvider({
        id: 'primary',
        fail: unauthorized('primary'),
        onCall: () => primaryCalls++,
      }),
      fallback: fakeProvider({ id: 'fallback' }),
      cooldownMs: 1000,
      now: () => clock,
    })

    await service.autocomplete('one')
    clock += 10_000_000
    await service.autocomplete('two')

    assert.equal(primaryCalls, 1, 'a bad key is not worth a second round trip')
    assert.equal(service.getStatus().reason, 'unauthorized')
  })

  test('an abort is not a failover — the fallback is never asked', async () => {
    let fallbackCalls = 0
    const service = createGeocodingService({
      primary: fakeProvider({ id: 'primary', fail: new GeocodingError('aborted', 'primary', 'x') }),
      fallback: fakeProvider({ id: 'fallback', onCall: () => fallbackCalls++ }),
    })

    // Assert on `kind`, not the message: `kind` is what the service branches on,
    // and a message-shaped assertion would pass for the wrong reason.
    await assert.rejects(
      () => service.autocomplete('Løvfrøvej'),
      (e: unknown) => e instanceof GeocodingError && e.kind === 'aborted',
    )
    assert.equal(fallbackCalls, 0, 'a superseded query must not be re-asked elsewhere')
  })

  test('isFailoverWorthy excludes aborts and non-geocoding errors', () => {
    assert.equal(isFailoverWorthy(rateLimited('p')), true)
    assert.equal(isFailoverWorthy(new GeocodingError('aborted', 'p', 'x')), false)
    assert.equal(isFailoverWorthy(new Error('boom')), false)
  })
})

// ───────────────────────────────────────────────────────── quota discipline

describe('quota discipline', () => {
  test('queries below the minimum length never reach a provider', async () => {
    let calls = 0
    const service = createGeocodingService({
      primary: fakeProvider({ id: 'primary', onCall: () => calls++ }),
    })

    assert.deepEqual(await service.autocomplete('Lø'), [])
    assert.equal(calls, 0)
  })

  test('a cached query costs nothing the second time', async () => {
    let calls = 0
    const service = createGeocodingService({
      primary: fakeProvider({ id: 'primary', onCall: () => calls++ }),
      cache: createGeocodeCache(createMemoryCacheStore()),
    })

    await service.autocomplete('Løvfrøvej')
    await service.autocomplete('  LØVFRØVEJ  ')
    assert.equal(calls, 1, 'the same question in different clothes is still one credit')
  })

  test('concurrent identical queries share one request', async () => {
    let calls = 0
    const service = createGeocodingService({
      primary: fakeProvider({ id: 'primary', onCall: () => calls++ }),
    })

    await Promise.all([
      service.autocomplete('Løvfrøvej'),
      service.autocomplete('Løvfrøvej'),
      service.autocomplete('Løvfrøvej'),
    ])
    assert.equal(calls, 1)
  })

  test('an empty result is not cached, so a provider hiccup is not pinned', async () => {
    let calls = 0
    const empty: GeocodingProvider = {
      id: 'empty',
      label: 'empty',
      attribution: '',
      async autocomplete() {
        calls++
        return []
      },
      async reverse() {
        return null
      },
    }
    const service = createGeocodingService({
      primary: empty,
      cache: createGeocodeCache(createMemoryCacheStore()),
    })

    await service.autocomplete('Løvfrøvej')
    await service.autocomplete('Løvfrøvej')
    assert.equal(calls, 2)
  })
})

// ──────────────────────────────────────────────────────── address composition

describe('composeAddressLines', () => {
  test('street and number make the title, postcode and area the subtitle', () => {
    const { title, subtitle } = composeAddressLines({
      street: 'Løvfrøvej',
      housenumber: '6',
      area: 'Bagsværd',
      postcode: '2880',
      country: 'Denmark',
    })
    assert.equal(title, 'Løvfrøvej 6')
    assert.equal(subtitle, '2880 Bagsværd, Denmark')
  })

  test('a named place keeps its name as the title and demotes the street', () => {
    const { title, subtitle } = composeAddressLines({
      name: 'Netto',
      street: 'Nybrovej',
      housenumber: '12',
      area: 'Vangede',
      postcode: '2820',
    })
    assert.equal(title, 'Netto')
    assert.ok(subtitle.startsWith('Nybrovej 12'))
  })

  test('a name identical to the street is not repeated across both lines', () => {
    const { title, subtitle } = composeAddressLines({
      name: 'Løvfrøvej',
      street: 'Løvfrøvej',
      postcode: '2880',
    })
    assert.equal(title, 'Løvfrøvej')
    assert.ok(!subtitle.includes('Løvfrøvej'), `subtitle should not echo the title: "${subtitle}"`)
  })

  test('missing components degrade instead of leaving empty punctuation', () => {
    const { title, subtitle } = composeAddressLines({ country: 'Denmark' })
    assert.equal(title, 'Denmark')
    assert.equal(subtitle, '')
  })
})
