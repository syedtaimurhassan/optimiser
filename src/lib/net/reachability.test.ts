import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { FAILURES_BEFORE_OFFLINE, createReachability } from './reachability.ts'

describe('reachability', () => {
  test('starts online when there is no navigator to ask', () => {
    assert.equal(createReachability().online, true)
  })

  /*
    The demo servers this app runs on are shared and occasionally answer a 500
    on a perfectly good connection. An indicator that flickers is one nobody
    reads.
  */
  test('one failed request is not an outage', () => {
    const net = createReachability()
    net.report(false)
    assert.equal(net.online, true)
  })

  test('failures in a row are', () => {
    const net = createReachability()
    for (let i = 0; i < FAILURES_BEFORE_OFFLINE; i++) net.report(false)
    assert.equal(net.online, false)
  })

  test('one success clears the count', () => {
    const net = createReachability()
    net.report(false)
    net.report(true)
    net.report(false)
    assert.equal(net.online, true, 'the earlier failure should not still be counting')
  })

  test('coming back is immediate — one answer is proof', () => {
    const net = createReachability()
    for (let i = 0; i < FAILURES_BEFORE_OFFLINE; i++) net.report(false)
    net.report(true)
    assert.equal(net.online, true)
  })

  test('tells subscribers on change, and only on change', () => {
    const net = createReachability()
    const seen: boolean[] = []
    net.subscribe((online) => seen.push(online))

    net.report(true)
    for (let i = 0; i < FAILURES_BEFORE_OFFLINE; i++) net.report(false)
    net.report(false)
    net.report(true)

    assert.deepEqual(seen, [false, true])
  })

  test('unsubscribes', () => {
    const net = createReachability()
    let calls = 0
    const off = net.subscribe(() => calls++)
    off()
    for (let i = 0; i < FAILURES_BEFORE_OFFLINE; i++) net.report(false)
    assert.equal(calls, 0)
  })
})
