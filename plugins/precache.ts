import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Work out what the app shell actually IS, and hand the list to the service
 * worker at build time.
 *
 * ── The bug this exists to fix ────────────────────────────────────────────
 *
 * M13's worker precached `index.html` and nothing else, and relied on its
 * fetch handler to fill the rest in "on the way past". It cannot: a newly
 * installed worker does not control the page that registered it, and
 * registration happens on `load` — after every asset has already been fetched.
 * So the first visit puts the HTML in the cache and NONE of the JavaScript it
 * names. Cold-launching offline then served a cached document that asked for
 * `/assets/index-*.js`, missed, hit the network, and got nothing: a white
 * screen. Offline only started working on the third launch, and only if the
 * second one was online.
 *
 * Precaching the shell during `install` fixes it at the first visit, which is
 * the only version of "works offline" a driver can rely on.
 *
 * ── Why the list is derived rather than globbed ───────────────────────────
 *
 * `dist/assets` is 29 MB. The shell is about 1.9 MB of it. The rest is the
 * ONNX runtime (26.8 MB), the OCR models (12 MB) and the barcode reader
 * (1.1 MB) — every one of them behind a dynamic import, and OCR is off by
 * default. Precaching by glob would make a driver who has never opened the
 * scanner download all of it before the app would open offline.
 *
 * A denylist would work until someone adds the next big lazy feature and
 * forgets to extend it. So the shell is defined structurally instead: the
 * entry chunks and the closure of their STATIC imports. Anything reached by
 * `import()` is by construction not in that closure, so new lazy features stay
 * out of the precache without anyone remembering to exclude them.
 */

const PLACEHOLDER = '__PRECACHE_MANIFEST__'

/**
 * Shell files the static import graph cannot see.
 *
 * Both are referenced by URL rather than imported — `new Worker(new URL(...))`
 * and `new URL(...)` + `instantiateStreaming` — so no amount of graph walking
 * finds them, and both are needed to solve a route. Without them the app opens
 * offline and then cannot compute anything, which is a worse failure than not
 * opening: it looks like it works.
 *
 * Matched by pattern because Vite hashes the names. A pattern that matches
 * NOTHING fails the build rather than quietly shipping a shell that can't
 * solve — see the assertion in `generateBundle`.
 */
const SHELL_EXTRAS = [
  // The negative lookahead is load-bearing. Without it the scalar pattern also
  // matches `engine-simd-<hash>.wasm`, so deleting the scalar artefact would
  // leave BOTH patterns satisfied by the SIMD one and the assertion below
  // would wave through a build that cannot solve on a device without SIMD.
  { what: 'solver engine (scalar)', match: /^assets\/engine-(?!simd-)[^/]+\.wasm$/ },
  { what: 'solver engine (SIMD)', match: /^assets\/engine-simd-[^/]+\.wasm$/ },
  { what: 'solver worker', match: /^assets\/solveWorker-[^/]+\.js$/ },
]

/**
 * Shell files copied verbatim from `public/`, which never enter the bundle and
 * so have to be named. All are tiny and all are stable — no hashes here.
 *
 * The icons are included even though the page never requests them (the OS
 * fetches those at install time) because together they are under 10 kB and it
 * makes the manifest resolvable with no network at all.
 */
const PUBLIC_SHELL = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
]

export function precacheManifest(): Plugin {
  let outDir = 'dist'
  let shell: string[] = []

  return {
    name: 'precache-manifest',
    apply: 'build',

    configResolved(config) {
      outDir = config.build.outDir
    },

    generateBundle(_options, bundle) {
      // Entry chunks, then the closure of their STATIC imports. `imports` is
      // static-only; `dynamicImports` is deliberately not followed, and that
      // is the whole mechanism keeping 39 MB of optional WASM out of here.
      const seen = new Set<string>()
      const queue = Object.values(bundle)
        .filter((c) => c.type === 'chunk' && c.isEntry)
        .map((c) => c.fileName)

      const css = new Set<string>()
      while (queue.length > 0) {
        const fileName = queue.pop()!
        if (seen.has(fileName)) continue
        seen.add(fileName)

        const chunk = bundle[fileName]
        if (chunk?.type !== 'chunk') continue
        for (const imported of chunk.imports) queue.push(imported)
        // Stylesheets are linked from the HTML, not imported by the chunk, so
        // they are carried on the chunk's metadata rather than in `imports`.
        for (const sheet of chunk.viteMetadata?.importedCss ?? []) css.add(sheet)
      }

      // Fall back to every emitted stylesheet if the metadata was not there.
      // A shell without its CSS opens offline as unstyled HTML, which reads as
      // a broken app rather than an offline one.
      if (css.size === 0) {
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === 'asset' && fileName.endsWith('.css')) css.add(fileName)
        }
      }

      const extras: string[] = []
      for (const { what, match } of SHELL_EXTRAS) {
        const hit = Object.keys(bundle).filter((f) => match.test(f))
        if (hit.length === 0) {
          this.error(
            `precache: nothing matched ${match} (${what}). It was renamed or is no ` +
              `longer emitted. Fix the pattern — do not delete it — or the app will ` +
              `open offline and be unable to solve a route.`,
          )
        }
        extras.push(...hit)
      }

      // Deduped: `cache.add` on the same URL twice is a wasted request, and
      // the list is read by humans in the built worker.
      shell = [...new Set([...PUBLIC_SHELL, ...seen, ...css, ...extras])].sort()
    },

    /**
     * Rewritten on disk rather than emitted, because `public/sw.js` is copied
     * verbatim by Vite and would overwrite anything emitted under the same
     * name. `closeBundle` is after that copy, so this is the one point where
     * the result is deterministic.
     */
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      const source = readFileSync(swPath, 'utf8')
      if (!source.includes(PLACEHOLDER)) {
        this.error(
          `precache: ${PLACEHOLDER} not found in ${swPath}. public/sw.js must ` +
            `contain it, or the worker ships with an empty precache and offline ` +
            `cold launch silently regresses to a white screen.`,
        )
      }

      let bytes = 0
      for (const file of shell) {
        try {
          bytes += statSync(join(outDir, file)).size
        } catch {
          // A listed file that isn't on disk is not fatal — `cache.addAll` is
          // all-or-nothing, so the worker adds them individually and tolerates
          // a miss. Reported below so it is not invisible.
          console.warn(`precache: listed but not on disk — ${file}`)
        }
      }

      writeFileSync(swPath, source.replace(PLACEHOLDER, JSON.stringify(shell)))
      console.log(
        `precache: ${shell.length} shell file(s), ${(bytes / 1e6).toFixed(2)} MB ` +
          `(of ${(dirSize(join(outDir, 'assets')) / 1e6).toFixed(0)} MB emitted)`,
      )
    },
  }
}

/** Total emitted bytes, so the log says what the precache is a fraction OF. */
function dirSize(dir: string): number {
  try {
    return readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
  } catch {
    return 0
  }
}
