import { chromium } from 'playwright'

/**
 * Launch Chromium for a smoke run, on a machine that may or may not allow it.
 *
 * ── The problem this solves ───────────────────────────────────────────────
 *
 * Chromium's renderer is a child process. In a sandboxed shell that child is
 * killed the instant it starts: no console output, no page error, before a
 * single asset is fetched. It looks exactly like an app that will not boot,
 * and every suite in this directory failed that way until M13 measured it.
 *
 * A trivial `setContent` page renders fine, and every GPU, headless-mode, JIT
 * and process flag crashes at the identical point — except `--single-process`,
 * which has no child to kill.
 *
 * ── Why it is the default rather than something you switch on ─────────────
 *
 * Requiring an environment variable meant `npm run smoke` still failed for
 * anyone who did not know to set it, which is the same as still being broken.
 *
 * Detecting the condition cheaply turned out not to be possible: a trivial
 * page, a Worker, a WebGL context, a WASM module, IndexedDB and a 200 MB
 * allocation ALL survive in the default mode that then kills the renderer on
 * the real app. There is no two-line probe that tells the truth, and a probe
 * that lies is worse than no probe.
 *
 * So the harness runs isolated by default. It is a supported Chromium mode,
 * it costs a test harness nothing that matters, and it works on both kinds of
 * host. Escape hatches, for a machine where you want the stock configuration:
 *
 *   SMOKE_ISOLATED=0            run with no extra flags
 *   SMOKE_CHROME_ARGS="--foo"   run with exactly these
 *
 * ── One context per browser, when isolated ────────────────────────────────
 *
 * `--single-process` supports exactly one browser context; asking for a second
 * kills the browser. Several suites open a context per scenario, so rather
 * than restructuring each of them, the browser returned here hands out a fresh
 * underlying browser for every context after the first, and closes them all
 * together. Callers keep writing `browser.newContext()` and never learn.
 */

const ENV_ARGS = (process.env.SMOKE_CHROME_ARGS ?? '').split(/\s+/).filter(Boolean)
const ISOLATED_DEFAULT = ['--no-sandbox', '--single-process']

function resolveArgs() {
  if (ENV_ARGS.length > 0) return ENV_ARGS
  if (process.env.SMOKE_ISOLATED === '0') return []
  return ISOLATED_DEFAULT
}

/**
 * A browser that survives `newContext()` being called more than once.
 *
 * Only used in the isolated case. Each extra context gets its own browser
 * process, which is what `--single-process` forces on us, and `close()` takes
 * them all down so a suite cannot leak one.
 */
function isolatingBrowser(first, launchOptions) {
  const extras = []
  let firstContextTaken = false

  return new Proxy(first, {
    get(target, prop, receiver) {
      if (prop === 'newContext') {
        return async (options) => {
          if (!firstContextTaken) {
            firstContextTaken = true
            return target.newContext(options)
          }
          const extra = await chromium.launch(launchOptions)
          extras.push(extra)
          return extra.newContext(options)
        }
      }
      if (prop === 'newPage') {
        return async (options) => {
          const context = await receiver.newContext(options)
          return context.newPage()
        }
      }
      if (prop === 'close') {
        return async () => {
          await Promise.all(extras.map((b) => b.close().catch(() => {})))
          return target.close()
        }
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export async function launchChromium({ headless = true, args = [] } = {}) {
  const resolved = resolveArgs()
  const merged = [...new Set([...args, ...resolved])]
  const options = { headless, args: merged }

  const browser = await chromium.launch(options)
  return merged.includes('--single-process') ? isolatingBrowser(browser, options) : browser
}

/** How the harness is launching, for a suite that wants to print it. */
export function launchMode() {
  return resolveArgs().includes('--single-process') ? 'isolated renderer' : 'default'
}
