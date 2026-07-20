// Removes OR-Tools WASM runtimes we never load, to keep the GitHub Pages deploy
// small. The app only ever runs the single-threaded routing solver, i.e. the
// "routing_runtime_asyncify" runtime (see src/lib/solver.ts, which forces the
// asyncify build via setWorkerBridgeEnabled(false)). Every other emitted
// runtime — the JSPI routing build and all the other solvers (cp_sat, mathopt,
// pdlp, graph, set_cover, mp_solver) — is dead weight in dist and is never
// fetched at runtime, so it is safe to delete.
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const assetsDir = 'dist/assets'
const KEEP = /^routing_runtime_asyncify-/ // the only runtime we load
const IS_RUNTIME = /_runtime.*\.(wasm|js)$/

let removed = 0
let freedBytes = 0
for (const file of readdirSync(assetsDir)) {
  if (IS_RUNTIME.test(file) && !KEEP.test(file)) {
    const full = join(assetsDir, file)
    freedBytes += statSync(full).size
    rmSync(full)
    removed++
  }
}

console.log(
  `prune-wasm: removed ${removed} unused runtime file(s), freed ` +
    `${(freedBytes / 1e6).toFixed(0)} MB`,
)
