# M0 real-device smoke test

**You run this. I can't.** Headless Chromium on a Mac tells us nothing about
what an iPhone does with a 16 MB pthread-enabled WASM module on cellular.

Target: <https://syedtaimurhassan.github.io/optimiser/> (current deployed build —
do **not** redeploy first; we want the state that exists today).

You need: one physical Android phone, one physical iPhone. Simulators and
desktop responsive mode do **not** count — the whole point is real memory
pressure, real thermals and a real cellular link.

Please record the answers inline and send the file back. "It broke" is a fine
answer; "it broke *here, with this message*" is a much better one.

---

## Before you start

Fill this in for each device — the numbers below are meaningless without it.

| | Android | iPhone |
|---|---|---|
| Device model | | |
| OS version | | |
| Browser + version | | |
| Free storage | | |
| Battery % at start | | |

> **Getting a console on a phone.** Steps 2, 4 and 6 need one.
> - **Android/Chrome:** plug into a computer, enable USB debugging, open
>   `chrome://inspect` on the desktop, click *inspect* under the phone's tab.
> - **iPhone/Safari:** Settings → Safari → Advanced → Web Inspector **on**, plug
>   into a Mac, then Safari → Develop → *[your iPhone]* → the tab.
>
> If you genuinely cannot attach a console on either device, do steps 1, 3, 5,
> 7, 8, 9 and mark the console-dependent ones "not run" — do not guess.

---

## 1. Cold load (do this on CELLULAR, Wi-Fi off)

1. Turn Wi-Fi off. Confirm you're on mobile data.
2. Clear site data (Android: site settings → Delete data. iOS: Settings → Safari
   → Advanced → Website Data → find the domain → swipe delete).
3. Note the time, open the URL, and time it until the map tiles are visible.

- [ ] **Expected:** the page loads and the map renders within ~5 s. The sidebar
      (desktop) or bottom sheet (phone) is interactive.
- [ ] **Expected:** you see the blue *"Preparing the route optimizer… a one-time
      download (~16 MB, then cached)"* banner.

**Record:** time to map visible ▸ ______ s  ·  banner appeared? ▸ ______

> ⚠️ On iPhone the most likely outcome is that the banner **never clears** and a
> warning appears instead. That is the expected failure, not a mistake by you.

---

## 2. Cross-origin isolation — the decisive one 🎯

With the console attached, run:

```js
console.log('isolated:', crossOriginIsolated,
            '| SAB:', typeof SharedArrayBuffer,
            '| SW:', navigator.serviceWorker.controller?.scriptURL ?? 'none')
```

- [ ] **Android/Chrome expected:** `isolated: true | SAB: function | SW: …/coi-serviceworker.js`
- [ ] **iPhone/Safari — unknown, this is what we're here to find out.** COEP has
      been supported since iOS 15.2, so it *may* report `true`. My prediction is
      `false`, but I'd rather be wrong with evidence than right by assumption.

**Record:** Android ▸ ____________________  ·  iPhone ▸ ____________________

Note the page may reload itself **once** on first visit — that's
coi-serviceworker claiming the page, and it's expected. If it reloads in an
endless loop, stop and record that; it's a serious finding.

---

## 3. WASM download completes on cellular

Watch the banner from step 1.

- [ ] **Expected:** the banner disappears on its own within ~30–90 s on a decent
      4G/5G link, and the Calculate button stops saying "Preparing optimizer".

**Record:** banner cleared after ▸ ______ s, or ▸ never cleared / showed a warning

If it never clears, copy the exact warning text: ▸ ____________________

---

## 4. Network reality check

DevTools → Network, filter `wasm`.

- [ ] **Expected:** exactly **one** `routing_runtime_asyncify-*.wasm`, ~16 MB,
      status 200.

**Record:** transferred size ▸ ______ MB  ·  time ▸ ______ s  ·  status ▸ ______

> If you see *more* than one runtime `.wasm`, tell me immediately — it means the
> deployed build was not pruned, and the phone just downloaded up to 151 MB.

---

## 5. The 107-point solve

1. Download <https://github.com/syedtaimurhassan/optimiser/blob/main/samples/bikes_low_battery.json>
   to the phone (or AirDrop/share it).
2. Upload it in the app. Confirm it reports **107** stops.
3. Leave Start and End unset, leave K blank (= visit all).
4. Set search quality to **Deep (3 s)**.
5. Tap **Calculate** and time it end to end.

- [ ] **Expected:** status cycles *Fetching cost matrix… 1/2 → 2/2 →
      Optimizing route (Deep Search)… → Building road route…*, then a summary
      and a 107-row itinerary appear.
- [ ] **Expected total:** roughly 8–15 s. Two OSRM matrix calls are spaced 1.1 s
      apart by design, so anything under ~5 s would be surprising.

**Record:** total ▸ ______ s  ·  completed? ▸ ______  ·  any error text ▸ ______

- [ ] Repeat at **Maximum (5 s)**. Record: ▸ ______ s

> The solve runs on the **main thread**. Some UI stutter during "Optimizing" is
> expected and is a known property of the current design, not a new bug. What
> matters is whether it *finishes*.

---

## 6. Memory and stability 🔥

Right after the 107-point solve, in the console:

```js
performance.memory && console.log(
  'JS heap MB:', (performance.memory.usedJSHeapSize / 1048576).toFixed(1))
```

(Chrome only; Safari won't have `performance.memory` — skip it there and rely on
step 7.)

- [ ] **Expected:** JS heap in the low tens of MB. The WASM linear memory is
      *separate* and not counted here — it starts at 16 MB and grows.

**Record:** Android JS heap ▸ ______ MB

- [ ] **Tab survival:** background the browser, open 3–4 other apps, come back.
      **Expected:** the app is still there with your route intact. If it reloads
      from scratch, the OS evicted it — record that, it matters a lot for iOS.

**Record:** survived backgrounding? ▸ Android ______ · iPhone ______

---

## 7. Thermal behaviour

Run **Calculate at Maximum (5 s) five times in a row**, back to back.

- [ ] **Record:** does the phone get noticeably warm? ▸ ______
- [ ] **Record:** does solve time degrade across the five runs (thermal
      throttling)? Times: ▸ ___ / ___ / ___ / ___ / ___ s
- [ ] **Record:** any tab crash, white screen, or "a problem repeatedly
      occurred"? ▸ ______

---

## 8. Persistence across a full close

1. Force-quit the browser entirely (swipe it away from the app switcher).
2. Reopen and go back to the URL.

- [ ] **Expected:** your stops, K, objective and last route are all still there
      (they're in `localStorage` under `route-optimiser:v2`).
- [ ] **Expected:** the WASM does **not** download again (it's in the HTTP cache).

**Record:** state restored? ▸ ______  ·  WASM re-downloaded? ▸ ______

---

## 9. Install-to-home-screen (expected to be poor — establishing the baseline)

- **Android/Chrome:** ⋮ menu → look for *Install app* / *Add to Home screen*.
- **iPhone/Safari:** Share → *Add to Home Screen*.

- [ ] **Record:** was an install option offered? ▸ Android ______ · iPhone ______
- [ ] Install it, launch from the home-screen icon, and record what you get:
      full-screen app, or a browser window with visible chrome? ▸ ______
- [ ] **In the installed window, check isolation again** (step 2's snippet).
      **This is the one I most want the answer to** — a home-screen web app on
      iOS is a different context from the Safari tab, and the service worker may
      behave differently there.

**Record:** installed-app `crossOriginIsolated` ▸ Android ______ · iPhone ______

> There is no manifest and no app icon yet, so expect a generic icon and a
> screenshot-based tile. That's M5's job, not a bug.

---

## What I'll do with this

| If… | Then |
|---|---|
| iPhone reports `crossOriginIsolated: true` **and** the solve completes | Cross-origin isolation is portable; the pthread-pool patch becomes a nice-to-have rather than the fix |
| iPhone reports `false` (my prediction) | Confirms the deployed app is Chromium-only today, and makes the pthread-pool patch from M0 the critical path for M1 |
| Either device crashes or thermally throttles hard | Raises the priority of getting off the 16 MB WASM entirely, regardless of isolation |
| The installed home-screen app behaves differently from the tab | Directly reshapes M5 |

---

# M4 addendum — the map, on real hardware

M4 replaced Leaflet with MapLibre GL JS (WebGL). Everything below needs a real
phone, and **step 11 is the one the milestone's definition of done actually
depends on** — I cannot measure it from a laptop, and `npm run map:perf` is a
throttled desktop proxy, not an answer.

Open the app with a route of ~300 stops loaded.

## 10. The map comes up at all

WebGL is a harder requirement than Leaflet's DOM markers ever were.

- [ ] **Android/Chrome:** does the basemap render? ▸ ______
- [ ] **iPhone/Safari:** does the basemap render? ▸ ______
- [ ] Check the renderer on each — paste into the address bar as a bookmarklet
      or use remote debugging:

```js
const c = document.createElement('canvas').getContext('webgl2')
  ?? document.createElement('canvas').getContext('webgl')
const d = c && c.getExtension('WEBGL_debug_renderer_info')
console.log(c ? (d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'renderer hidden') : 'NO WEBGL')
```

**Record:** renderer ▸ Android ______ · iPhone ______

> If either device reports `NO WEBGL`, the map error boundary should show the
> recovery UI rather than a blank rectangle. Confirm that it does — a blank
> grey box is indistinguishable from a bug in this app.

## 11. 300 markers, panning and zooming 🎯

**This is the definition-of-done measurement.** Do it on the mid-range Android,
not the fastest phone you own.

- [ ] Load a route with ~300 stops.
- [ ] Pan continuously across the whole scatter for ~10 seconds. Does it feel
      smooth, or does it stutter? ▸ ______
- [ ] Pinch-zoom from city level to street level and back, twice. ▸ ______
- [ ] Get a number. Chrome on Android: connect via `chrome://inspect` from a
      desktop, open the Performance panel, record while panning, and read the
      FPS track. Failing that, Chrome's **Rendering → Frame Rendering Stats**
      overlay gives a live FPS readout on the device itself.

**Record:** ▸ Android FPS while panning ______ · while pinch-zooming ______
**Record:** ▸ device model and Android version ______

| Result | What it means |
|---|---|
| Sustained ≥ 50 fps | Definition of done met; the WebGL bet paid off |
| 30–50 fps | Acceptable but worth a look — try dropping the chip texture ratio to 1 |
| < 30 fps | Genuinely bad. Investigate: reduce the symbol layer's text work, or lower `CLUSTER_MAX_ZOOM` so fewer chips are live at once |

## 12. Labels and chips at a glance

- [ ] At street zoom, do any two chips overlap? ▸ ______
- [ ] Is any address label clipped mid-word (e.g. "Elmekro… 10")? ▸ ______
- [ ] Find a **failed** stop that belongs to a **coloured group**. Is the chip
      the GROUP's colour with a small red ✗ badge — *not* a red chip? ▸ ______
- [ ] Are the two route lines visually distinct without reading a legend —
      thin grey behind, thick blue ahead? ▸ ______

## 13. The chrome, thumb-tested

- [ ] Tap the layers FAB. Does the basemap switch, and do the markers and route
      lines survive the switch? ▸ ______
- [ ] With nothing selected, is the second FAB a crosshair? Tap it and accept
      the location prompt. Does a blue dot appear? ▸ ______
- [ ] Walk a few metres. Does a heading cone appear and point the right way?
      ▸ ______  *(heading is null when stationary — this needs movement)*
- [ ] Tap a stop. Does the second FAB become a pin, and the peek pill appear on
      the left edge? ▸ ______
- [ ] Tap the fit-route FAB repeatedly. Does the camera cycle through
      stop → all stops → whole route and wrap? ▸ ______

## 14. Battery and heat with the map open

WebGL keeps the GPU busy in a way Leaflet did not.

- [ ] Leave the map open and idle for 10 minutes. Note battery drop ▸ ______
- [ ] Does the phone get noticeably warm? ▸ ______

> Idle should be nearly free — MapLibre stops rendering when nothing moves. A
> warm phone on a *static* map means something is animating that shouldn't be,
> and that is a bug worth reporting back.

---

# M5 — the route sheet and its list

Everything below is a phone-only design. Do not do it on a tablet or a desktop
window narrowed to phone width: the sheet is `md:hidden`, and a narrow desktop
window has no touch input, which is the entire subject of §16.

## 15. Scrolling 300 rows 🎯

**This is the definition-of-done measurement**, and the same caveat as §11
applies: `npm run list:perf` reports 60fps median at 4× CPU throttle on a
desktop, and that rig models a slow processor and nothing else.

- [ ] Load a route with ~300 stops and drag the sheet fully open.
- [ ] Fling the list from the top to the bottom in one gesture. Does it track
      your thumb, or does it stutter and catch up? ▸ ______
- [ ] Scroll slowly through a stretch with notes and tags on it. Do rows
      visibly resize or jump as they come into view? ▸ ______
- [ ] Get a number, the same way as §11 — `chrome://inspect` → Performance, or
      Rendering → Frame Rendering Stats on the device.

**Record:** ▸ FPS while flinging ______ · while scrolling slowly ______
**Record:** ▸ device model and Android version ______

| Result | What it means |
|---|---|
| Sustained ≥ 50 fps | Definition of done met |
| 30–50 fps | Look at the row itself before the virtualiser — the id chip and status badge are the only non-text elements per row |
| < 30 fps | Reduce `overscan` in `RouteList.tsx` first (it is 6), then check whether the map underneath is still rendering |

> Rows jumping as they scroll into view means the estimates in `estimateFor`
> are too far from the truth on this device's font metrics. That is a tuning
> problem, not a virtualiser problem.

## 16. The sheet, by thumb 🎯

The nested-scroll behaviour cannot be checked any other way. A mouse drag over
a list does not scroll it, so a desktop browser will report all of this as
working whether it does or not.

- [ ] Drag the handle slowly up and down. Does the sheet follow your thumb
      exactly, with no lag? ▸ ______
- [ ] Can you reach all four positions by dragging — summary strip, about half,
      full list, and full-screen? ▸ ______
- [ ] Flick up sharply from collapsed. Does it stop at the second position
      rather than flying to the top? ▸ ______
- [ ] Tap the handle repeatedly. Does it step up one position at a time and
      then return to collapsed? ▸ ______
- [ ] **The one that matters:** open the sheet fully, scroll the list halfway
      down, then drag DOWN in the middle of the list. Does the list scroll back
      up — leaving the sheet completely still? ▸ ______
- [ ] Now with the list at the very top, drag down again. Does the sheet close
      this time? ▸ ______
- [ ] Does the sheet ever judder or hand the gesture back and forth mid-drag?
      ▸ ______  *(this is the failure this design exists to prevent)*
- [ ] At the half-open position, try to scroll the list. It should not scroll —
      the drag should move the sheet instead. ▸ ______
- [ ] Tap the search field. Does the keyboard come up with the sheet filling
      the space above it, rather than the field hiding behind the keyboard?
      ▸ ______

> The last one is the only check here that exercises `visualViewport`. If the
> field ends up behind the keyboard, that listener is not firing on this
> device and the `full` detent is being computed against the wrong height.

## 17. The rows, at a glance

Use `#/__ui` in a bench build to see every variant at once, then compare
against a real route.

- [ ] Do all the addresses start at the same left edge, whatever their number?
      ▸ ______
- [ ] Is the vertical connector unbroken from the start row to the end row,
      with no gaps at the rows that have notes? ▸ ______
- [ ] Find a **failed** stop in a **coloured group**. Is the id chip still the
      group's colour, with a red ✗ beside it — *not* a red chip? ▸ ______
- [ ] Do ordinary stops show no tags at all? ▸ ______
- [ ] Does the end row look like an ending rather than another stop? ▸ ______
- [ ] Is "Mark route as completed" clearly not the thing you are meant to press
      all day? ▸ ______
- [ ] Scroll to the bottom, then press the ⌄ button. Does it take you to the
      next undelivered stop? ▸ ______
- [ ] Collapse the sheet. Do the map's floating buttons sit clear of it, and do
      they all still respond to a tap? ▸ ______
