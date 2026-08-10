# M13 device test

Most of M13 is a claim about a phone. What could be settled in a browser now
has been — `npm run smoke:m13` runs 32 checks against the production build and
passes — so this script covers what automation genuinely cannot reach: a real
camera, a real GPU, two real operating systems, and the four install contexts.

Verified automatically, so you do not need to re-check it by hand: the app
boots clean, the manifest and icons resolve, the service worker registers and
the app opens with the network off, the settings persist, all four tiles are
live, and the barcode decoder loads lazily from our own origin rather than a
CDN. What automation could NOT do is drive a live camera — `getUserMedia`
never settles in a single-process renderer — so every camera row below is
still yours.

Two devices, four contexts. **Install the app on both phones first**, or half
the rows below cannot be reached at all.

| | Android Chrome (tab) | Installed Android | iOS Safari (tab) | iOS Home Screen |
|---|---|---|---|---|
| Context code | AC | APWA | iS | iPWA |

---

## 0. Install (do this first)

- [ ] **AC** — Chrome offers "Install app" / "Add to Home screen" from the menu.
- [ ] **APWA** — opens with no browser chrome. Icon on the launcher is the blue
      route glyph and is **not** cropped through the dots.
- [ ] **iS** — Share → Add to Home Screen offers the app name "Optimiser".
- [ ] **iPWA** — opens standalone (no Safari address bar). Status bar is legible
      over the map.

> If APWA does not appear, check the console for a manifest error. If iPWA opens
> in Safari instead of standalone, the manifest's `display` was not honoured —
> record the iOS version.

## 1. Diagnostics — the real matrix

Open `#/settings` (dev build) and **screenshot the whole panel on each device**.
These screenshots are the deliverable; the table in `M13-RESEARCH.md` is a
prediction until they exist.

Record the rows that the research predicted and check each:

- [ ] `barcodeDetector` / `barcode formats` — expect a real format list on
      Android, `none — WASM fallback` on iOS.
- [ ] `speech usable here` — expect **false** on iPWA, true on iS.
- [ ] `speech on-device` — expect `no — sent to vendor` unless a Chrome
      language pack is installed.
- [ ] `wakeLock` — expect true everywhere; note the iOS version (the installed
      case was broken before 18.4).
- [ ] `vibrate` — the research says caniuse and MDN disagree. **Settle it**:
      record what iOS actually reports.
- [ ] `networkInformation` — expect false on both iOS contexts.
- [ ] `push` / `badging` — expect badging true only on iPWA.
- [ ] `storagePersisted` — note it; it decides the device tier.

## 2. Barcode scanning

- [ ] **AC / APWA** — the sheet says "Reading with the system scanner".
- [ ] **iS / iPWA** — says "Reading with ZXing", and the 1 MB wasm loads before
      the preview goes live (not after).
- [ ] Scan a Data Matrix and a PDF417 off a real courier label on **both**
      phones. This is the format coverage the whole engine choice was made for.
- [ ] Write a stop's ID (e.g. `D7`) on a box, encode it in any QR generator,
      scan it → lands on that stop's card.
- [ ] Scan a code that matches nothing → the sheet shows the decoded text
      verbatim, not a failure.
- [ ] Deny camera permission → "Choose a photo" appears and reads a photo of
      the same label.
- [ ] Close the sheet → **the camera indicator goes out.** (iOS shows a green
      dot; Android a green pill. This is the one that must not fail.)
- [ ] **iOS 26 only**: check the preview is not rotated 90°. A regression is
      reported against Home Screen apps — see M13-RESEARCH.md.

## 3. Photos

- [ ] Take 3 photos on a stop. Reload the app → they are still there.
- [ ] The thumbnails are sharp and the stored image is legible enough to read a
      house number.
- [ ] **iOS**: take a photo with the main camera at full resolution. It must
      **not** come back black — that is the 16.7 Mpx canvas ceiling, and a black
      rectangle is what failure looks like.
- [ ] Fill a stop to 8 photos → the message names the number and says to delete
      one.
- [ ] Delete a photo, then delete the stop, then reload → storage usage in the
      diagnostics panel has gone down (the boot sweep ran).

## 4. Navigation hand-off — the one with the trap

Build a route of **8 stops** so Google needs more than one leg.

- [ ] First Navigate tap asks which app. Second tap does not.
- [ ] **Google Maps**: the legs open with **at most 3 intermediate stops each**
      and no stop is silently dropped. Count them against the itinerary.
- [ ] **Waze**: one link per stop, opens straight into navigation
      (`navigate=yes` honoured, not just a pin).
- [ ] **Apple Maps** (iOS): opens driving directions from the previous stop.
- [ ] Repeat all three from **APWA and iPWA**, not just the browser tabs — the
      hand-off is where an installed app behaves differently.
- [ ] Change the app from the route menu → the change sticks after a reload.

## 5. Voice

- [ ] **AC / APWA** — dictating fills the search field.
- [ ] **iS** — works.
- [ ] **iPWA** — the tile still opens and says Apple blocks it, with "Type it
      instead". **It must not be a dead grey tile.**
- [ ] Wherever it works: the sheet states whether audio is sent to the vendor.

## 6. Driving mode

- [ ] Set a route `active` → the screen stops dimming.
- [ ] Switch apps and come back → **it is still held** (this is the
      re-acquisition path, and the one that fails after five minutes if broken).
- [ ] Set the route back to draft → the screen dims again.
- [ ] Share route copy → the OS share sheet appears with readable text.
- [ ] On a genuinely poor connection: the pill says "slow connection" rather
      than looking hung.

## 7. OCR (experimental, off by default)

Only if `npm run ocr:models` was run before the deploy.

- [ ] Settings → turn on "Scan text from photos".
- [ ] Scan a label. **Record the provider and the elapsed time from the sheet**,
      on each device. This is the number that decides whether the flag ever
      flips to on by default.
- [ ] Android with WebGPU vs iOS: expect a large gap.
- [ ] Photograph a printed round sheet → the candidate list contains the
      addresses and **not** the header or the "Total N stops" footer.
- [ ] Every result is editable before anything is looked up.

## 8. Offline

- [ ] Load the app once, then enable airplane mode and **open it again** — it
      must start, not show a browser error page.
- [ ] Work the round offline: ticking stops, photos, and reordering all persist.
- [ ] Back online → the pill returns to "Saved HH:MM".

---

## What to write down

For each failure: the device, the OS version, the context (AC/APWA/iS/iPWA),
what happened, and a screenshot. For the OCR rows: the two numbers.

The rows most likely to disagree with `M13-RESEARCH.md` are `vibrate` on iOS,
the iOS 26 camera rotation, and whether Waze honours a hand-off from an
installed web app. All three are recorded there as predictions.
