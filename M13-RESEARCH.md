# M13 — Capability research

What the phone actually offers, verified against vendor documentation, standards
bodies and compat databases in **August 2026**. Every row names the fallback we
ship where the API is missing, because a milestone whose definition of done is
"never a dead control" needs the fallback decided before the control is built.

Four columns, because the two that matter most are the ones nobody tests:

- **AC** — Android Chrome, browser tab
- **APWA** — Android, installed from the browser (same engine, different window)
- **iS** — iOS Safari, browser tab
- **iPWA** — iOS, Home Screen web app (`display: standalone`)

> ⚠️ **This repo cannot currently be installed on either platform.** There is no
> web app manifest, no icons beyond `favicon.svg`, and no service worker.
> `index.html` has no `<link rel="manifest">`. So both "installed" columns below
> are *what the platform does*, not *what we have observed*, and cannot be
> observed until an install surface exists. See "The prerequisite" at the end.

---

## The matrix

| Capability | AC | APWA | iS | iPWA | Fallback we ship |
|---|:--:|:--:|:--:|:--:|---|
| BarcodeDetector | ✅ | ✅ | ❌ | ❌ | ZXing‑C++ WASM (`barcode-detector` ponyfill) |
| Web Speech recognition | ✅ | ✅ | ✅ | ❌ | Text entry, with the reason named |
| getUserMedia | ✅ | ✅ | ✅ | ✅¹ | `<input type=file capture>` |
| ImageCapture `grabFrame` | ✅ | ✅ | ❌ | ❌ | `<video>` → `canvas.drawImage` |
| OPFS | ✅ | ✅ | ✅ | ✅ | Not used — IndexedDB is the store |
| Screen Wake Lock | ✅ | ✅ | ✅ 16.4+ | ✅ 18.4+² | Nothing; the screen sleeps |
| Vibration | ✅ | ✅ | ❌³ | ❌³ | Silence — already feature-detected |
| Web Share | ✅ | ✅ | ✅ | ✅ | Clipboard copy |
| Web Push | ✅ | ✅ | ❌ | ✅ 16.4+ | None needed — we have no server |
| Badging | ❌⁴ | ❌⁴ | ❌ | ✅ 16.4+ | In-app count |
| Device Orientation | ✅ | ✅ | ✅⁵ | ✅⁵ | Static north-up marker |
| Network Information | ✅ | ✅ | ❌ | ❌ | Measured reachability (already shipped) |
| Background Sync | ✅ | ✅ | ❌ | ❌ | Retry on next foreground |
| Periodic Background Sync | ✅⁶ | ✅⁶ | ❌ | ❌ | Nothing |
| Geolocation (foreground) | ✅ | ✅ | ✅ | ✅ | — |
| Geolocation (background) | ❌ | ❌ | ❌ | ❌ | **Impossible. Documented, not worked around.** |

¹ Fixed in iOS 14.3 ([WebKit bug 185448](https://bugs.webkit.org/show_bug.cgi?id=185448)); an
[iOS 26 regression report](https://developer.apple.com/forums/thread/801146) has the camera
rotated 90° in Home Screen apps. Needs a real-device check.
² A long-standing bug broke Wake Lock in installed iOS web apps until iOS 18.4.
³ caniuse says no; MDN's compat data carries [an open report that it works](https://github.com/mdn/browser-compat-data/issues/29166). Feature-detected, so the disagreement costs us nothing.
⁴ Chrome for Android does not expose `setAppBadge`; Android has no comparable OS badge.
⁵ iOS requires `DeviceOrientationEvent.requestPermission()` from inside a user gesture (iOS 13+), and gives true heading via the non-standard `webkitCompassHeading`.
⁶ Chromium only, installed only, and gated on site engagement.

---

## The four expectations, checked

> *"BarcodeDetector absent on iOS"* — **correct.** Every iOS browser is WebKit, and
> WebKit does not implement it. Still absent as of 2026.

> *"Vibration absent on iOS"* — **correct in effect, contested in fact.** caniuse
> reports no support; MDN's BCD has an open issue claiming `navigator.vibrate`
> works on iOS Safari. Apple added a user-gesture requirement in iOS 18.4.
> `lib/device/haptics.ts` already feature-detects rather than platform-sniffs,
> which is why this repo does not have to take a side.

> *"Web Speech unreliable and possibly broken in an installed iOS PWA"* —
> **correct, and it is worse than unreliable: it is a hard failure.** Safari
> supports `webkitSpeechRecognition` from iOS 14.5 in a tab. In standalone mode
> it errors immediately without even prompting for the microphone. Confirmed by
> [Apple's own developer forum](https://developer.apple.com/forums/thread/748048)
> and by [whatpwacando.today](https://whatpwacando.today/speech-recognition/),
> which states plainly: works in Safari, not for installed web apps.

> *"Background Sync Chromium-only"* — **correct**, for both one-off and periodic.
> No Safari version supports either; Firefox supports neither.

### One correction the brief did not anticipate

**Web Speech on Android is not on-device by default — it streams audio to
Google.** Chrome 139 shipped an optional on-device mode
(`SpeechRecognition.available({processLocally:true})` + `install()`), but it was
disabled by a regression until 142.0.7403.0 and needs a downloaded language
pack. For an app whose whole premise is "100% client-side", the default path
sends the driver's voice off-device. That has to be said in the UI, not buried.

---

## Barcode: which WASM

| | ZXing‑C++ (`zxing-wasm`) | ZBar (`zbar-wasm`) |
|---|---|---|
| Data Matrix | ✅ | partial |
| PDF417 | ✅ (incl. micro) | partial, poor accuracy |
| Aztec | ✅ | partial |
| Reader bundle | **~1.04 MiB** (reader-only build) | smaller |
| Accuracy | ~99.8% in third-party comparisons | fails >50% of PDF417 images |
| Memory safety | no known open advisories | **[CVE‑2023‑40889](https://github.com/advisories/GHSA-mhp6-jvpx-2p4m)** heap overflow in `qr_reader_match_centers`, **CVE‑2023‑40890** stack overflow in `lookup_sequence` — both reachable from a *crafted physical barcode*, i.e. from exactly our threat surface: a driver pointing a camera at a box someone else printed |

**ZXing‑C++, and it isn't close.** Shipping-label formats are the ones ZBar is
worst at, and its two 2023 CVEs are triggered by scanning a malicious code —
which for a parcel scanner is not a theoretical delivery vector. WASM sandboxes
the memory corruption, but a hang or a wrong decode is still a bad day.

Use [`barcode-detector`](https://github.com/Sec-ant/barcode-detector) (MIT), a
spec-shaped ponyfill over `zxing-wasm`. **It defaults to fetching its `.wasm`
from jsDelivr** — that must be overridden with `prepareZXingModule({ overrides:
{ locateFile } })` pointing at a Vite `?url` asset, or the scanner breaks
offline and adds a third-party origin to the request path.

Prefer native `BarcodeDetector` on Android, but detect it properly: `'Barcode
Detector' in window` is not enough, because Android's implementation is backed
by a Play Services module that may be absent. `await
BarcodeDetector.getSupportedFormats()` and check the list actually contains what
we need.

---

## OCR: honest numbers

| Engine | On a phone | Bundle | Notes |
|---|---|---|---|
| Tesseract.js v6 | **2–20 s** per 640×640 image on an iPhone X | core + `eng.traineddata` fetched at first use, cached in IndexedDB | v7 is 15–35% faster again |
| PaddleOCR / RapidOCR via ONNX Runtime Web | ~0.2–1 s/page on desktop CPU; no trustworthy phone number found | ORT Web + detection + recognition models, ~10 MB class | 5–15 character points more accurate on receipts; WebGPU path available |

Tesseract's own issue tracker is full of "unexpectedly slow" reports and its
docs concede the point. **Two to twenty seconds for a label is not an assist,
it is a wait**, and the variance is the worst part — a driver cannot learn
whether to wait or type. Pre-cropping to the label region and downscaling is
the single biggest lever; it also keeps us under iOS Safari's canvas ceilings.

**iOS canvas limits, which bound any pre-processing we do:** area cannot exceed
**16,777,216 px** (a 4097×4096 canvas fails), individual canvases are capped
around 3–5 megapixels on lower-RAM devices, and total canvas memory is capped
(~384 MB on iOS 15). A 48 MP phone photo must be downscaled in steps, not in
one `drawImage`.

---

## Navigation hand-off — the trap, confirmed

> "The number of waypoints allowed varies by the platform where the link opens,
> with up to **three** waypoints supported on **mobile browsers**, and a maximum
> of nine waypoints supported otherwise."
> — [Google Maps URLs, Get Started](https://developers.google.com/maps/documentation/urls/get-started)

`lib/googleMaps.ts` hard-codes `MAX_WAYPOINTS_PER_URL = 9` and calls it "the
conservative, documented value". On a phone — which is the only device this app
targets — **it is three**. Every hand-off we have ever produced from a route
longer than five stops has been silently truncated or dropped by Google Maps.

The other two apps are worse, and the brief's "all three target apps" hides it:

- **Waze**: `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`. Parameters are
  `ll`, `q`, `navigate`, `z`, `favorite`, plus avoidance flags.
  **No waypoint parameter exists.** One destination per link, full stop.
- **Apple Maps**: `https://maps.apple.com/?saddr=&daddr=&dirflg=d`. Only `daddr`
  is required. **No documented multi-stop parameter.** One destination per link.

So the chained-batch design has to generalise: Google gets legs of ≤3
intermediate waypoints on mobile, Waze and Apple Maps get one link *per stop*.
That is not a limitation to hide behind a spinner — it is the shape of the
feature, and the UI should say which app gives the driver fewer taps.

---

## Background geolocation

Not "hard". **Not possible.**

- `navigator.geolocation` is not exposed to service workers, so there is no
  context that survives backgrounding.
- `watchPosition` stops delivering the moment the page is backgrounded — tab
  hidden, PWA minimised, screen off.
- It is [the single most requested PWA capability](https://lists.w3.org/Archives/Public/public-device-apis-log/2023Jan/0014.html)
  and has been for a decade.

The nearest honest thing a web app can do is a Screen Wake Lock while a route is
active, so the page stays foregrounded and `watchPosition` keeps running. That
is what we ship, and it is why Wake Lock is in this milestone at all.

---

## The prerequisite

Half of this matrix — Web Push, Badging, standalone Wake Lock, the iOS Speech
failure, Periodic Sync — is only reachable from an *installed* app, and this
repo has no manifest, no icons and no service worker. On iOS, "Add to Home
Screen" without a manifest `display: standalone` (or the legacy
`apple-mobile-web-app-capable` meta) produces a shortcut that opens in Safari,
so the iPWA column cannot be tested at all. Chrome's install criteria still
want a manifest with `name`/`icons`/`start_url`/`display`, and Chrome
[is only experimenting with relaxing them](https://developer.chrome.com/blog/update-install-criteria).

M13's definition of done includes screenshots of the diagnostics panel from both
phones. Two of the four columns cannot produce one until this exists.

---

## Sources

- [Google Maps URLs — Get Started](https://developers.google.com/maps/documentation/urls/get-started)
- [Waze Deep Links](https://developers.google.com/waze/deeplinks)
- [Apple — Map Links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html)
- [MDN — Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API) · [caniuse](https://caniuse.com/mdn-api_barcodedetector)
- [Sec-ant/barcode-detector](https://github.com/Sec-ant/barcode-detector) · [Sec-ant/zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- [GHSA-mhp6-jvpx-2p4m — heap overflow in ZBar](https://github.com/advisories/GHSA-mhp6-jvpx-2p4m) · [CVE-2023-40890](https://security.snyk.io/vuln/SNYK-ALPINE321-ZBAR-8490297)
- [What PWA Can Do Today — Speech Recognition](https://whatpwacando.today/speech-recognition/) · [Apple Developer Forums — webkitSpeechRecognition in a PWA](https://developer.apple.com/forums/thread/748048)
- [MDN — SpeechRecognition.available()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static) · [Intent to Ship: On-device Web Speech](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM/m/gwbtzV-lAQAJ)
- [web.dev — Screen Wake Lock supported in all browsers](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers) · [caniuse](https://caniuse.com/wake-lock)
- [MDN BCD #29166 — navigator.vibrate on iOS](https://github.com/mdn/browser-compat-data/issues/29166) · [caniuse](https://caniuse.com/mdn-api_navigator_vibrate)
- [WebKit — Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [WebKit — Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/)
- [Chrome for Developers — Badging API](https://developer.chrome.com/docs/capabilities/web-apis/badging-api)
- [caniuse — Network Information API](https://caniuse.com/netinfo) · [caniuse — Background Sync](https://caniuse.com/background-sync) · [MDN — Periodic Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)
- [WebKit bug 185448 — getUserMedia in standalone](https://bugs.webkit.org/show_bug.cgi?id=185448) · [MDN — ImageCapture](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture)
- [WebKit — OPFS](https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/)
- [tesseract.js performance docs](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md) · [naptha/tesseract.js#516](https://github.com/naptha/tesseract.js/issues/516)
- [pqina — Canvas area exceeds the maximum limit](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/) · [Total canvas memory](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/)
- [Chrome — Revisiting installability criteria](https://developer.chrome.com/blog/update-install-criteria)
