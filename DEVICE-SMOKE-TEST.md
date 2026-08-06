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
