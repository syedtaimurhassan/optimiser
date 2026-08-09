import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Remove the cross-origin-isolation hack from a built bundle.
 *
 *   node bench/strip-coi.mjs dist-bench-nocoi
 *
 * The bench build injects coi-serviceworker because the OR-Tools oracle needs
 * SharedArrayBuffer to start. Production does not, and M11's definition of done
 * is that the DEFAULT engine works without it — which is a claim about a page
 * that did not have it, not about a source file that does not mention it.
 *
 * So: copy the bench build, take the script out, and run the benchmark against
 * that. `bench/tsptw.mjs --no-coi` then refuses to report at all unless
 * `crossOriginIsolated` really is false on the page it measured.
 */
const dist = process.argv[2]
if (!dist) {
  console.error('usage: node bench/strip-coi.mjs <dist-dir>')
  process.exit(1)
}

const path = join(dist, 'index.html')
const html = readFileSync(path, 'utf8')
const stripped = html.replace(/\s*<script[^>]+coi-serviceworker[^>]*><\/script>/g, '')
if (stripped === html) {
  console.log(`${path}: no coi-serviceworker script to remove`)
} else {
  writeFileSync(path, stripped)
  console.log(`${path}: coi-serviceworker script removed`)
}
