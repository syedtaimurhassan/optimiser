# M10 real-device test — the Rust engine

**You run this. I can't.** Every number in the M10 write-up was measured on a
Mac. The whole point of this milestone is a faster engine on the phone in a
driver's hand, and a laptop cannot tell you anything about that.

Two things specifically cannot be checked anywhere but a real device:

1. **iOS Safari instantiating the module at all.** The one iOS-specific decision
   in this milestone is the declared maximum of the WebAssembly memory — iOS
   refuses to construct a `WebAssembly.Memory` whose declared maximum is the
   usual 2 GB, and the failure happens up front, before a single byte is used.
   The build caps it at 256 MB and the build script fails if that ever slips.
   That is a fix for a documented bug in someone else's engine, verified against
   documentation, **not against an iPhone**.

2. **Whether SIMD is worth shipping.** On this Mac the SIMD build is
   indistinguishable from the scalar one, which is what the research predicted:
   WebAssembly SIMD has no gather instruction, and candidate-list local search is
   gather-bound. If that holds on ARM phones too, the second artefact is 50 KB of
   dead weight and M11 should drop it.

Target: <https://syedtaimurhassan.github.io/optimiser/> — **deploy first**, then
test the deployed build. Unlike the M0 test, this one is about new code.

---

## Before you start

| | Android | iPhone |
|---|---|---|
| Device model | | |
| OS version | | |
| Browser + version | | |
| Battery % at start | | |

> **Getting a console.** Steps 2–5 need one.
> - **Android/Chrome:** plug into a computer, enable USB debugging, open
>   `chrome://inspect` on the desktop, click *inspect* under the phone's tab.
> - **iPhone/Safari:** Settings → Safari → Advanced → Web Inspector **on**, plug
>   into a Mac, then Safari → Develop → *[your iPhone]* → the tab.
>
> If you cannot attach a console on a device, do steps 1, 6 and 7 and mark the
> rest "not run". Please do not guess.

---

## 1. It still works 🎯

The lowest bar, and the one that matters most: M10 replaced the engine that
computes every route in the app.

1. Open the app, add or import a handful of stops, tap Calculate.
2. Confirm a route appears and the itinerary is in a sensible order.

- [ ] **Android:** route computed ▸ ______
- [ ] **iPhone:** route computed ▸ ______

> ⚠️ If this fails on iPhone and works on Android, suspect the memory cap first
> and paste the exact console error — that is the failure mode this milestone was
> most exposed to.

---

## 2. Which engine and which artefact

In the console:

```js
// Which engine the registry picked, and which tier the device claims.
await window.__bench?.describeEngine?.()
```

`__bench` only exists in bench builds, so on the deployed app use the
**Diagnostics panel** in Settings instead and read off `wasmSimd` and the engine
badge.

**Record:**

| | Android | iPhone |
|---|---|---|
| engine badge | | |
| `wasmSimd` | | |
| `hardwareConcurrency` | | |

Expected: a modern phone reports `wasmSimd: true` and a badge of **Fast**. An
older iPhone (iOS 15 or 16.0–16.3) should report `wasmSimd: false` and still
work — that device runs the scalar artefact.

---

## 3. Did the engine actually download, and how big

Network tab, filter `wasm`, then reload with cache disabled.

- [ ] **Expected:** exactly ONE `.wasm` request, either `engine-*.wasm` or
      `engine-simd-*.wasm`, around **50 KB**.
- [ ] **Expected:** no 16 MB download anywhere. That was OR-Tools and it is gone
      from production.

**Record:** file requested ▸ ______  ·  transferred size ▸ ______ KB

> Both artefacts are emitted into the bundle; only one should ever be *fetched*.
> Two `.wasm` requests means the runtime selection is broken.

---

## 4. Speed, against the old engine 📱

This is the number the milestone is for. The bench seam is not on the deployed
build, so measure the honest way: with a stopwatch, on a route big enough to take
real time. Use **50+ stops** — import one of the sample files if you have it.

Do it three times per device and record the median. Note the search tier you
picked (Fast / Deep / Maximum) and use the same one on both devices.

| | Android | iPhone |
|---|---|---|
| stops | | |
| search tier | | |
| time from Calculate to route (median of 3) | | |

For comparison, on the 107-point sample this Mac measured **820 ms** for the
Rust engine against **3020 ms** for the TypeScript one, at the same quality
target — and the Rust route was 6.5% cheaper.

---

## 5. Cancellation is responsive

Cancellation is the one property that could plausibly be *worse* than before: a
WebAssembly call cannot be interrupted, so the engine is stepped in ~15 ms
chunks and can only stop between them.

1. Start a Calculate on a large route with the **Maximum** tier.
2. Tap cancel about a second in.

- [ ] **Expected:** the UI responds immediately — well under half a second. No
      frozen sheet, no unresponsive cancel button.

**Record:** Android ▸ ______  ·  iPhone ▸ ______

---

## 6. The map stays alive while it solves

The solve runs in a worker, so the main thread should be free.

1. Start a Calculate on a large route at **Maximum**.
2. While it runs, pan and pinch-zoom the map.

- [ ] **Expected:** the map moves smoothly throughout. Any stutter is worth
      reporting — it would mean the worker is not doing its job.

**Record:** Android ▸ ______  ·  iPhone ▸ ______

---

## 7. Memory, on the device that is stingiest with it

At n = 1000 the cost matrix is 4 MB and everything else is under 100 KB, so the
engine should be nowhere near any ceiling. The point of this step is to confirm
that on hardware rather than on paper.

1. Solve a large route several times in a row **without reloading** — five or six
   times.

- [ ] **Expected:** every solve completes. No reload, no white screen, no
      "a problem repeatedly occurred".

**Record:** solves completed before any failure ▸ Android ______ · iPhone ______

> iOS Safari reloads a tab that exceeds its memory budget, and it does it without
> an error message. A silent reload IS the failure — please note it.

---

## 8. Anything else

Battery drain, heat, anything that felt wrong. "It felt slower than before" is
useful even without a number.

```
Android:

iPhone:
```
