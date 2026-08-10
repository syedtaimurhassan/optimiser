import { chromium } from 'playwright'

/**
 * Launch Chromium for a smoke run.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * Chromium's renderer is a child process, and in a sandboxed shell that child
 * is killed the instant it starts. The symptom is a page that "crashes" before
 * fetching a single asset, with no console output and no page error — which
 * looks exactly like an app that fails to boot, and is not. Every smoke suite
 * in this directory failed that way, on unmodified main, until M13 measured it:
 * a trivial `setContent` page renders fine, and every GPU, headless-mode and
 * process flag crashes identically except `--single-process`, which passes.
 *
 * `--single-process` runs the renderer in the browser process, so there is no
 * child to kill. It is not needed on an unsandboxed machine and is not a
 * workaround for anything in the app, so it is opt-in through the environment
 * rather than baked in:
 *
 *   SMOKE_CHROME_ARGS="--no-sandbox --single-process" npm run smoke
 */
export function launchChromium({ headless = true, args = [] } = {}) {
  const fromEnv = (process.env.SMOKE_CHROME_ARGS ?? '').split(/\s+/).filter(Boolean)
  return chromium.launch({ headless, args: [...args, ...fromEnv] })
}
