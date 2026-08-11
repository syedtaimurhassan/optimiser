import { launchChromium } from './lib/launch.mjs'
import { startServer } from './lib/server.mjs'
const server = await startServer({ root: '/Users/taimurshah/Downloads/project/optimiser/dist-bench' })
const browser = await launchChromium({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)))
await page.goto(server.url, { waitUntil: 'load' })
await page.waitForFunction(() => !document.body.innerText.includes('Loading your route'), null, { timeout: 20000 })
await page.waitForFunction(() => globalThis.__mapController?.map, null, { timeout: 20000 }).catch(() => console.log('no __mapController'))
await page.waitForTimeout(3000)
console.log(await page.evaluate(() => {
  const m = globalThis.__mapController?.map
  if (!m) return 'no map'
  return {
    styleLoaded: m.isStyleLoaded(),
    loaded: m.loaded(),
    layers: m.getStyle()?.layers?.map(l => l.id).filter(id => /stop|route|cluster/.test(id)) ?? [],
    stopsSource: (() => { try { return m.getSource('stops')?.serialize?.()?.data?.features?.length ?? 'n/a' } catch (e) { return 'err ' + e.message } })(),
    rendered: (() => { try { return m.queryRenderedFeatures({ layers: ['stops'] }).length } catch (e) { return 'err ' + e.message } })(),
    sourceFeatures: (() => { try { return m.querySourceFeatures('stops').length } catch (e) { return 'err ' + e.message } })(),
  }
}))
await browser.close(); await server.close?.()
