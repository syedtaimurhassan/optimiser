/**
 * Benchmark driver.
 *
 * Loads the real (pruned) production bundle from a header-less static server —
 * the closest reproduction of GitHub Pages that runs locally — drives it with
 * headless Chromium, and scores every engine with the shared referee in
 * lib/objective.mjs.
 *
 * Usage:
 *   npm run bench                    full grid, engine "ortools"
 *   npm run bench -- --engine=ts     once a second engine is registered
 *   npm run bench -- --quick         one rep, small grid (smoke test)
 *   npm run bench -- --probe-only    just the cross-origin-isolation probe
 *   npm run bench -- --headed        watch it run
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { startServer } from './lib/server.mjs'
import { makeInstance, loadSampleMatrix } from './lib/instances.mjs'
import { objectiveOf, validate, SKIP_PENALTY } from './lib/objective.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RESULTS = join(HERE, 'results')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

/**
 * `--engine=all` runs every registered engine over every instance, which is
 * what M9 needs: the question stopped being "how fast is the solver" and became
 * "which of these solvers is better, on the same instance, at the same budget".
 */
const ENGINE = opt('engine', 'all')
const ENGINE_LIST = ENGINE === 'all' ? ['ts', 'ts-workers', 'ortools'] : ENGINE.split(',')
const QUICK = flag('quick')
const REPS = Number(opt('reps', QUICK ? 1 : 3))
const HEADED = flag('headed')
const DIST = join(ROOT, opt('dist', 'dist-bench'))

/**
 * --no-coi runs the whole grid with coi-serviceworker 404'd, so the page stays
 * un-isolated. Paired with the pthread-pool patch (see bench/patch-pthread-pool.mjs)
 * this measures whether the solver produces IDENTICAL results without the
 * cross-origin isolation apparatus.
 */
const NO_COI = flag('no-coi')
const blockSw = NO_COI ? (url) => url.endsWith('coi-serviceworker.js') : undefined

/** The three tiers the app actually offers (SEARCH_BUDGET_MS in routeStore.ts). */
const BUDGETS = { fast: 1000, deep: 3000, maximum: 5000 }

// ---------------------------------------------------------------- instance grid

function buildGrid() {
  const cached = loadSampleMatrix()
  const sampleMatrix = cached?.matrix
  const specs = []

  // The real 107-point instance, at the three K values M0 asked for.
  // NOTE: k counts CANDIDATES. With a fixed start and end there are only 105,
  // so "k = 107" is expressed as k = 105, i.e. "visit everything".
  for (const k of QUICK ? [20] : [20, 50, 105]) {
    specs.push({ family: 'sample', n: 107, k, seed: 1, matrix: sampleMatrix, budget: BUDGETS.deep })
  }

  if (!QUICK) {
    for (const n of [25, 50, 107]) {
      for (const family of ['uniform', 'clustered']) {
        specs.push({ family, n, k: n - 2, seed: 7, budget: BUDGETS.deep })
        specs.push({ family, n, k: Math.floor((n - 2) / 2), seed: 7, budget: BUDGETS.deep })
      }
      // The decoy family only bites when K forces a choice.
      specs.push({ family: 'decoy', n, k: Math.floor((n - 2) * 0.4), seed: 11, budget: BUDGETS.deep })
    }

    // Budget sensitivity on the real instance: does more time buy anything?
    for (const [tier, budget] of Object.entries(BUDGETS)) {
      if (tier === 'deep') continue
      specs.push({ family: 'sample', n: 107, k: 50, seed: 1, matrix: sampleMatrix, budget, tier })
    }
  }

  return { specs, matrixSource: cached?.source ?? 'synthetic-haversine' }
}

// ---------------------------------------------------------------- in-page solve

/**
 * Runs inside the browser. Returns raw measurements only — scoring happens in
 * Node against the shared referee, so an engine can never grade its own work.
 */
async function solveInPage(payload) {
  const seam = window.__bench
  if (!seam) throw new Error('bench seam missing — was the bundle built with VITE_BENCH_SEAM=1?')
  if (seam.version !== 4) throw new Error(`bench seam version ${seam.version}, expected 4`)

  const { engine, matrix, startNode, endNode, k, timeBudgetMs, seed } = payload

  // Sample the JS heap while the solver yields to the event loop. This misses
  // WASM linear memory, which is why measureUserAgentSpecificMemory is also
  // taken when the browser allows it (it requires cross-origin isolation).
  let peakJsHeap = 0
  const sample = () => {
    const used = performance.memory?.usedJSHeapSize ?? 0
    if (used > peakJsHeap) peakJsHeap = used
  }
  sample()
  const sampler = setInterval(sample, 50)

  let uaMemoryBefore = null
  let uaMemoryAfter = null
  try {
    uaMemoryBefore = (await performance.measureUserAgentSpecificMemory?.())?.bytes ?? null
  } catch { /* unavailable without isolation, or blocked — not fatal */ }

  let outcome = null
  let error = null
  try {
    outcome = await seam.solve(engine, matrix, { startNode, endNode, k, timeBudgetMs, seed })
  } catch (e) {
    error = String(e?.message ?? e)
  }

  clearInterval(sampler)
  sample()

  try {
    uaMemoryAfter = (await performance.measureUserAgentSpecificMemory?.())?.bytes ?? null
  } catch { /* as above */ }

  return {
    visited: outcome?.visited ?? null,
    error,
    wallMs: outcome?.wallMs ?? 0,
    progressReports: outcome?.progressReports ?? 0,
    // The seam scores it too. Node scores it again from the raw sequence, and
    // Node's answer is the one that counts — an engine never grades its own work.
    seamObjective: outcome?.objective ?? null,
    peakJsHeapBytes: peakJsHeap,
    uaMemoryBeforeBytes: uaMemoryBefore,
    uaMemoryAfterBytes: uaMemoryAfter,
    crossOriginIsolated: seam.isCrossOriginIsolated(),
  }
}

// ------------------------------------------------------- cross-origin-isolation probe

/**
 * THE ESCAPE-HATCH EXPERIMENT.
 *
 * Serves the identical bundle with coi-serviceworker 404'd, so the page can
 * never become cross-origin isolated — precisely the state Safari and Firefox
 * users, and any browser where the service worker fails to take control, land
 * in. Then it tries to initialise the solver and run a tiny solve.
 *
 * Success here would mean cross-origin isolation is optional and the whole
 * service-worker + forced-reload apparatus can be deleted.
 */
async function probeCrossOriginIsolation(browser) {
  const server = await startServer({
    root: DIST,
    block: (url) => url.endsWith('coi-serviceworker.js'),
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e?.message ?? e)))

  const result = { blockedRequests: server.blocked }
  try {
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 30_000 })

    result.crossOriginIsolated = await page.evaluate(() => globalThis.crossOriginIsolated === true)
    result.sharedArrayBufferDefined = await page.evaluate(() => typeof SharedArrayBuffer !== 'undefined')

    // Can a shared WebAssembly.Memory even be constructed here? This is the
    // exact call the Emscripten glue makes in initMemory(). Chromium allows the
    // construction even when the SharedArrayBuffer *constructor* is withheld,
    // so the interesting question is what the resulting buffer can actually do.
    result.sharedMemoryConstructible = await page.evaluate(() => {
      try {
        const mem = new WebAssembly.Memory({ initial: 256, maximum: 32768, shared: true })
        const buf = mem.buffer
        const probe = { ok: true, bufferCtor: buf.constructor.name }

        // Growable? Emscripten grows the heap as the solver allocates.
        try { mem.grow(1); probe.growable = true } catch (e) { probe.growable = false; probe.growError = String(e?.message ?? e) }

        // Atomics are what pthread synchronisation is built on.
        try { Atomics.store(new Int32Array(mem.buffer), 0, 1); probe.atomicsUsable = true }
        catch (e) { probe.atomicsUsable = false; probe.atomicsError = String(e?.message ?? e) }

        // The real blocker candidate: can shared memory cross to a Worker?
        // Emscripten's pthread pool posts wasmMemory to each of its 4 workers.
        try {
          const w = new Worker(URL.createObjectURL(new Blob(['self.onmessage=()=>{}'], { type: 'text/javascript' })))
          w.postMessage(mem)
          w.terminate()
          probe.postMessageToWorker = true
        } catch (e) {
          probe.postMessageToWorker = false
          probe.postMessageError = String(e?.message ?? e)
        }
        return probe
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) }
      }
    })

    // Bypass src/lib/solver.ts's own crossOriginIsolated guard and ask the WASM
    // runtime directly. Without this we would only be re-measuring our guard.
    //
    // Bounded, because the interesting failure mode here is not an exception:
    // Emscripten's pthread pool registers a run dependency on four workers, and
    // if those never come up the init promise simply never settles. "Hangs
    // forever" is a result we need to record, not a reason to stall the run.
    result.unguardedInit = await page.evaluate(async (timeoutMs) => {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`no settle within ${ms}ms`)), ms)),
        ])
      const t0 = performance.now()
      try {
        // Straight at the OR-Tools engine, with no guard of ours in the way,
        // so the probe finds out what the WASM itself does without isolation.
        await withTimeout(window.__bench.warmUpEngine('ortools'), timeoutMs)
        return { ok: true, ms: Math.round(performance.now() - t0) }
      } catch (e) {
        const msg = String(e?.message ?? e)
        return { ok: false, hung: msg.includes('no settle'), error: msg, ms: Math.round(performance.now() - t0) }
      }
    }, 30_000)

    // Now the real thing: a full solve with no isolation.
    //
    // solveSelectiveTSP() calls warmUpSolver(), which refuses up front when
    // crossOriginIsolated is false. That guard is OUR code, not a browser rule,
    // so we shadow the flag to switch it off. Nothing about the browser's actual
    // isolation state changes — only our own early return — which is exactly
    // what makes the result meaningful: whatever happens next is the WASM's
    // real behaviour without cross-origin isolation.
    result.solve = await page.evaluate(async (timeoutMs) => {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`no settle within ${ms}ms`)), ms)),
        ])
      try {
        Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true })
      } catch (e) {
        return { stage: 'shadow-guard', ok: false, error: String(e?.message ?? e) }
      }
      try {
        await withTimeout(window.__bench.warmUp(), timeoutMs)
      } catch (e) {
        const msg = String(e?.message ?? e)
        return { stage: 'warmUp', ok: false, hung: msg.includes('no settle'), error: msg }
      }
      try {
        const m = [
          [0, 10, 20, 30],
          [10, 0, 12, 22],
          [20, 12, 0, 11],
          [30, 22, 11, 0],
        ]
        const visited = await withTimeout(
          window.__bench.solve('ortools', m, { startNode: 0, endNode: 3, k: 2, timeBudgetMs: 200 }),
          timeoutMs,
        )
        return { stage: 'solve', ok: true, visited }
      } catch (e) {
        const msg = String(e?.message ?? e)
        return { stage: 'solve', ok: false, hung: msg.includes('no settle'), error: msg }
      }
    }, 30_000)
  } catch (e) {
    result.fatal = String(e?.message ?? e)
  }

  result.consoleErrors = consoleErrors.slice(0, 20)
  await context.close()
  await server.close()
  return result
}

// ---------------------------------------------------------------------- main

async function main() {
  mkdirSync(RESULTS, { recursive: true })

  const browser = await chromium.launch({
    headless: !HEADED,
    // measureUserAgentSpecificMemory() is only exposed with this flag.
    args: ['--enable-blink-features=MeasureMemory'],
  })

  console.log('\n━━━ cross-origin-isolation probe (coi-serviceworker blocked) ━━━\n')
  const probe = await probeCrossOriginIsolation(browser)
  console.log(`  crossOriginIsolated ......... ${probe.crossOriginIsolated}`)
  console.log(`  SharedArrayBuffer defined ... ${probe.sharedArrayBufferDefined}`)
  console.log(`  shared Memory constructible . ${probe.sharedMemoryConstructible?.ok}` +
    (probe.sharedMemoryConstructible?.error ? `\n      → ${probe.sharedMemoryConstructible.error}` : ''))
  console.log(`  solver usable ............... ${probe.solve?.ok}` +
    (probe.solve?.error ? `\n      → [${probe.solve.stage}] ${probe.solve.error}` : ''))

  writeFileSync(join(RESULTS, 'coi-probe.json'), JSON.stringify(probe, null, 2))

  if (flag('probe-only')) {
    await browser.close()
    console.log(`\nwrote ${join('bench/results', 'coi-probe.json')}\n`)
    return
  }

  // ---- the benchmark proper, on a normally-isolated page ----
  const { specs, matrixSource } = buildGrid()
  const server = await startServer({ root: DIST, block: blockSw })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('pageerror', (e) => console.error('  page error:', String(e?.message ?? e)))

  await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
  // coi-serviceworker reloads the page once to gain isolation; ride it out.
  await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 60_000 })

  const isolated = await page.evaluate(() => globalThis.crossOriginIsolated === true)
  if (NO_COI && isolated) throw new Error('--no-coi run is still cross-origin isolated; the block failed')

  console.log(`\n━━━ benchmark run ━━━\n`)
  console.log(`  dist: ${opt('dist', 'dist-bench')}  |  crossOriginIsolated: ${isolated}  |  matrix source: ${matrixSource}`)

  if (NO_COI) {
    // solveSelectiveTSP() calls warmUpSolver(), which refuses when
    // crossOriginIsolated is false. That guard is ours, not the browser's, and
    // it is exactly what this run exists to test past.
    await page.evaluate(() =>
      Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true }),
    )
  }

  const warmT0 = Date.now()
  await page.evaluate(() => window.__bench.warmUp())
  const warmUpMs = Date.now() - warmT0
  console.log(`  cold WASM warm-up:   ${warmUpMs} ms\n`)

  // Each config gets a FRESH page.
  //
  // Not hygiene theatre: or-tools-wasm never frees native RoutingModels in a
  // browser (canDeleteNativeRoutingModel() excludes browser runtimes), so the
  // WASM heap grows with every solve attempt until std::bad_alloc aborts the
  // module permanently. Without a reload, config #3 onwards measures nothing but
  // the wreckage of config #2. See the endurance probe below, and AUDIT.md.
  const reload = async () => {
    await page.goto(server.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 60_000 })
    if (NO_COI) {
      await page.evaluate(() =>
        Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true }),
      )
    }
    await page.evaluate(() => window.__bench.warmUp())
  }

  const runs = []
  for (const spec of specs) {
    const instance = makeInstance(spec)
    const budget = spec.budget

    for (const engineId of ENGINE_LIST) {
    const reps = []

    for (let rep = 0; rep < REPS; rep++) {
      // A fresh page per rep, still. It is only OR-Tools that needs it (see
      // the note above), but giving one engine a clean heap and another a used
      // one would make the comparison measure the reload rather than the search.
      await reload()
      const raw = await page.evaluate(solveInPage, {
        engine: engineId,
        matrix: instance.matrix,
        startNode: instance.startNode,
        endNode: instance.endNode,
        k: instance.k,
        timeBudgetMs: budget,
        seed: instance.seed,
      })

      if (raw.error) {
        reps.push({ rep, error: raw.error, wallMs: raw.wallMs })
        continue
      }

      const problems = validate(raw.visited, instance)
      const objective = objectiveOf(raw.visited, instance.matrix, instance.n, SKIP_PENALTY)
      const skipped = instance.n - raw.visited.length
      reps.push({
        rep,
        wallMs: Number(raw.wallMs.toFixed(1)),
        objective,
        // The travel cost alone. When K binds, the objective is dominated by a
        // CONSTANT — 85 skipped stops is 850,000,000 of it — and two engines
        // whose routes differ by 15% of the actual driving both read as
        // "+0.00%". The arc cost is the part that varies.
        arcs: objective - SKIP_PENALTY * skipped,
        visitedCount: raw.visited.length,
        skipped: instance.n - raw.visited.length,
        valid: problems.length === 0,
        problems,
        peakJsHeapBytes: raw.peakJsHeapBytes,
        uaMemoryAfterBytes: raw.uaMemoryAfterBytes,
        progressReports: raw.progressReports,
      })
    }

    const ok = reps.filter((r) => !r.error)
    const median = (xs) => {
      const s = [...xs].sort((a, b) => a - b)
      return s.length ? s[Math.floor((s.length - 1) / 2)] : null
    }

    const summary = {
      id: instance.id,
      engine: engineId,
      family: instance.family,
      n: instance.n,
      k: instance.k,
      tier: spec.tier ?? Object.entries(BUDGETS).find(([, v]) => v === budget)?.[0] ?? null,
      budgetMs: budget,
      reps: reps.length,
      medianWallMs: median(ok.map((r) => r.wallMs)),
      medianObjective: median(ok.map((r) => r.objective)),
      medianArcs: median(ok.map((r) => r.arcs)),
      medianSkipped: median(ok.map((r) => r.skipped)),
      bestObjective: ok.length ? Math.min(...ok.map((r) => r.objective)) : null,
      worstObjective: ok.length ? Math.max(...ok.map((r) => r.objective)) : null,
      medianVisited: median(ok.map((r) => r.visitedCount)),
      allValid: ok.length > 0 && ok.every((r) => r.valid),
      peakJsHeapBytes: ok.length ? Math.max(...ok.map((r) => r.peakJsHeapBytes)) : null,
      errors: reps.filter((r) => r.error).map((r) => r.error),
      detail: reps,
    }
    runs.push(summary)

    const objStr = summary.medianObjective === null ? 'FAILED' : summary.medianObjective.toLocaleString('en-US')
    console.log(
      `  ${instance.id.padEnd(24)} ${engineId.padEnd(11)} ` +
        `${String(summary.medianWallMs ?? '—').padStart(7)} ms  ` +
        `obj ${objStr.padStart(14)}  ` +
        `visited ${String(summary.medianVisited ?? '—').padStart(3)}/${instance.n}  ` +
        `${summary.allValid ? '✓' : '✗ INVALID'}`,
    )
    }
  }

  // ---- engine comparison ----
  //
  // The whole point of --engine=all. Every engine is scored by the SAME referee
  // on the SAME instance at the SAME budget, and the gap is stated against the
  // best any of them managed — not against a published optimum, because the
  // synthetic families have none. TSPLIB is where real gap-to-optimal lives.
  if (ENGINE_LIST.length > 1) {
    console.log('\n━━━ engine comparison (gap to best-of-all, per instance) ━━━\n')
    const byInstance = new Map()
    for (const run of runs) {
      if (!byInstance.has(run.id)) byInstance.set(run.id, [])
      byInstance.get(run.id).push(run)
    }
    const header = ['instance'.padEnd(24), ...ENGINE_LIST.map((e) => e.padStart(14))].join(' ')
    console.log('  ' + header)
    console.log('  (gap on travel cost; instances where engines skipped different counts are marked)')
    const wins = Object.fromEntries(ENGINE_LIST.map((e) => [e, 0]))
    for (const [id, group] of byInstance) {
      const scored = group.filter((g) => g.medianObjective !== null)
      if (scored.length === 0) continue
      // Rank on the true objective — visiting one more stop always beats a
      // prettier route — but MEASURE the gap on arcs when every engine skipped
      // the same number, because then the penalty is a shared constant and only
      // the driving differs.
      const sameSkips = scored.every((g) => g.medianSkipped === scored[0].medianSkipped)
      const field = sameSkips ? 'medianArcs' : 'medianObjective'
      const best = Math.min(...scored.map((g) => g[field]))
      const bestObjective = Math.min(...scored.map((g) => g.medianObjective))
      for (const g of scored) if (g.medianObjective === bestObjective) wins[g.engine]++
      const cells = ENGINE_LIST.map((e) => {
        const run = group.find((g) => g.engine === e)
        if (!run || run.medianObjective === null) return 'FAILED'.padStart(14)
        const gap = ((run[field] - best) / best) * 100
        return `${gap === 0 ? 'best' : '+' + gap.toFixed(2) + '%'}`.padStart(14)
      })
      console.log('  ' + [id.padEnd(24), ...cells].join(' ') + (sameSkips ? '' : '  (objective)')) 
    }
    console.log('\n  instances won: ' + ENGINE_LIST.map((e) => `${e} ${wins[e]}`).join('   '))
  }

  // ---- endurance: how many solves does one page survive? ----
  //
  // The app never reloads between Calculate presses, so this is the number that
  // actually matters to a user: press Calculate this many times in one session
  // and the optimizer dies until they refresh.
  // A SMALL instance is the harsh case, counter-intuitively: each attempt
  // finishes in milliseconds, so a 3 s budget burns through far more model
  // allocations than a big instance does. Leakage tracks attempts, not seconds.
  console.log('\n━━━ endurance probe (no reload between solves) ━━━\n')
  await reload()
  const enduranceInstance = makeInstance({ family: 'uniform', n: 25, k: 23, seed: 7 })
  const endurance = await page.evaluate(async ({ matrix, startNode, endNode, k }) => {
    const results = []
    for (let i = 1; i <= 40; i++) {
      const t0 = performance.now()
      try {
        await window.__bench.solve('ortools', matrix, { startNode, endNode, k, timeBudgetMs: 3000 })
        results.push({ solve: i, ok: true, ms: Math.round(performance.now() - t0) })
      } catch (e) {
        results.push({ solve: i, ok: false, error: String(e?.message ?? e), ms: Math.round(performance.now() - t0) })
        break
      }
    }
    return results
  }, {
    matrix: enduranceInstance.matrix,
    startNode: enduranceInstance.startNode,
    endNode: enduranceInstance.endNode,
    k: enduranceInstance.k,
  })

  const survived = endurance.filter((r) => r.ok).length
  const died = endurance.find((r) => !r.ok)
  console.log(
    died
      ? `  died on solve #${died.solve} after ${survived} successful solves → ${died.error}`
      : `  survived all ${survived} solves (no failure within the probe limit)`,
  )

  const report = {
    meta: {
      engine: ENGINE,
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      playwright: (await import('playwright/package.json', { with: { type: 'json' } })).default.version,
      chromium: browser.version(),
      reps: REPS,
      quick: QUICK,
      dist: opt('dist', 'dist-bench'),
      noCoiMode: NO_COI,
      crossOriginIsolated: isolated,
      matrixSource,
      coldWarmUpMs: warmUpMs,
      skipPenalty: SKIP_PENALTY,
      note:
        'peakJsHeapBytes samples the JS heap only and EXCLUDES WASM linear memory; ' +
        'uaMemoryAfterBytes (when present) includes it.',
    },
    coiProbe: probe,
    endurance: {
      note:
        'Consecutive solves on ONE page (no reload), 3s budget, uniform n=25 k=23. ' +
        'Small instances are the harsh case: cheap attempts mean more model ' +
        'allocations per second. Failure is std::bad_alloc from unfreed native ' +
        'RoutingModels — or-tools-wasm skips _routing_delete_model in browser runtimes ' +
        '(canDeleteNativeRoutingModel() excludes them).',
      instance: 'uniform-n25-k23-s7',
      budgetMs: 3000,
      solvesSurvived: survived,
      failedOn: died ?? null,
      detail: endurance,
    },
    runs,
  }

  const outName = opt('out', `${ENGINE}-${QUICK ? 'quick' : 'full'}.json`)
  writeFileSync(join(RESULTS, outName), JSON.stringify(report, null, 2))
  console.log(`\n  wrote bench/results/${outName}\n`)

  await context.close()
  await server.close()
  await browser.close()
}

main().catch((e) => {
  console.error('\nbench failed:', e)
  process.exit(1)
})
