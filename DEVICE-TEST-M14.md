# M14 device test

M14 is a claim about two operating systems' storage policies, and almost none
of it can be settled on a Mac. What could be has been — `npm run smoke:m14`
runs 31 checks against the production build and passes — so this script covers
only what automation genuinely cannot reach.

**Verified automatically, do not re-check by hand:** the manifest parses, is
`standalone`, pins an explicit `id`, and its `start_url` names the hash route;
`any` and `maskable` are separate icon entries and all four icons resolve as
PNG; the apple-touch-icon resolves; the worker activates and precaches the
entry chunk, the stylesheet, both engine artefacts and the solver worker after
ONE visit; nothing optional is cached; the shell is 1.96 MB; the app cold-boots
with the network off and a deep link resolves offline; the worker never calls
`skipWaiting` unprompted; the COOP/COEP worker is not deployed.

**What is left is everything a real phone decides for itself**: whether Chrome
mints a WebAPK, whether WebKit grants persistent storage, what a launcher does
to the icon, and whether the data is still there after a week.

Two devices, four contexts, same codes as M13.

| | Android Chrome (tab) | Installed Android | iOS Safari (tab) | iOS Home Screen |
|---|---|---|---|---|
| Context code | AC | APWA | iS | iPWA |

---

## 0. Install

- [ ] **AC** — a custom install card appears in the routes drawer **only after
      the round has at least one stop**. Before that there must be nothing.
- [ ] **AC** — tapping *Install* shows Chrome's own dialog, not our card again.
- [ ] **APWA** — launches from the launcher with no browser chrome at all.
- [ ] **APWA** — the icon is **not** cropped through the glyph. Compare it with
      a native icon on the same launcher; ours should sit at the same visual
      size, not conspicuously smaller. A shrunken icon means the `any` entry is
      being used where `maskable` was intended.
- [ ] **iS** — no *Install* button anywhere (Safari has no API for one), and the
      card instead shows the three numbered Share → Add to Home Screen steps.
- [ ] **iPWA** — opens standalone, no address bar, status bar legible over the map.

> The install card is dismissible. After dismissing it, it must be gone from
> the drawer **and still present in Settings → App**. That is the whole point
> of the dismissal being a "not now".

## 1. Storage — the milestone's real subject

Settings → Storage, on each device.

- [ ] **AC / APWA / iS / iPWA** — record `usage of quota` and the verdict line.

| context | usage / quota | verdict line | persisted? |
|---|---|---|---|
| AC | | | |
| APWA | | | |
| iS | | | |
| iPWA | | | |

The number that matters is **persisted**, and the hypothesis being tested is
specific: WebKit grants persistent mode "based on heuristics like whether the
website is opened as a Home Screen Web App", so **iPWA should say Protected
where iS does not**. If iS and iPWA both say Protected, the install pitch is
overstated and `installPitch()` in `lib/pwa/install.ts` needs rewording. If
neither does, find out whether Safari wants notification permission first.

- [ ] Tap **Ask the browser to protect my data** where it is offered. Record
      whether the answer changes, immediately or on a later day.

## 2. The optional downloads

- [ ] Turn on Settings → *Scan text from photos*, scan one label, return to
      Settings.
- [ ] A **Downloaded for offline use** row appears, listing roughly 27 MB for
      the runtime plus ~12 MB of models. Record the figure: ______
- [ ] **Clear** drops it, the row disappears, and **no route data is lost**.
- [ ] Pan the map, return to Settings: a **Map tiles** row appears with a
      non-zero size.

## 3. Cold offline launch — the definition of done

Do this **exactly** in this order, on both phones, in the installed context.

1. [ ] Load a route with at least 10 stops. Tick two of them delivered.
2. [ ] Airplane mode ON.
3. [ ] **Force quit** the app (swipe it away from the app switcher — not just
       backgrounding it).
4. [ ] Launch from the home-screen icon.
5. [ ] The app opens. Not a browser error, not a blank page, not a spinner that
       never resolves.
6. [ ] The round is intact: same stops, same order, the two delivered marks
       still ticked.
7. [ ] The map has no tiles (expected offline, unless they were cached) but the
       route list, the stop detail and the itinerary all work.

| context | opened? | data intact? | notes |
|---|---|---|---|
| APWA | | | |
| iPWA | | | |

> This is the row the milestone lives or dies on. If the app opens but the
> round is empty, that is an eviction, and the banner in §5 should have said so.

## 4. Survival over a week — the one that needs patience

Start it now, read it later. This is the claim the whole install pitch rests on.

- [ ] Day 0: load a route on **iS** (Safari tab) and on **iPWA** (installed).
      Note the date: ______
- [ ] Do not open either for **8 days**.
- [ ] Day 8: open both.

| context | data still there? |
|---|---|
| iS | |
| iPWA | |

The prediction: **iS may be cleared, iPWA should not.** If iPWA is also
cleared, the install pitch is wrong on current iOS and both `installPitch()`
and the DataLossBanner copy must be corrected — do not leave a claim in the UI
that the device has disproved.

## 5. The eviction banner

Hard to trigger honestly; simulate it instead.

- [ ] With a round loaded, open devtools (or Safari's Web Inspector via a Mac)
      and delete the app's **IndexedDB** only — leave Cache Storage alone.
- [ ] Relaunch. The red **Your saved routes were cleared** banner appears.
- [ ] Dismiss it, relaunch again: it must **not** come back.
- [ ] Delete every stop by hand instead, relaunch: the banner must **not**
      appear. Emptying the app on purpose is not an eviction.

## 6. The update flow — needs two deploys

- [ ] Install the app. Deploy a visible change. Reopen the app (or background
      and foreground it, then wait up to an hour for the periodic check).
- [ ] A dark toast appears at the bottom: *A new version is ready*.
- [ ] It does **not** block anything — you can still tick a stop off with it on
      screen.
- [ ] **Dismiss** it: it is gone for this session. Relaunch: it is offered again.
- [ ] **Reload**: the page reloads exactly once — no loop — and shows the new
      version.
- [ ] Nothing swapped under you before you tapped.

## 7. Regressions to watch for

- [ ] **No forced reload on first load.** The app must never reload itself on a
      cold visit. If it does, `coi-serviceworker` is back; it should be absent
      from the deploy entirely.
- [ ] Solving still works offline on both phones (M12's claim, M14 must not have
      broken the engine precache). Load a round, airplane mode, Calculate —
      an estimated-arcs route comes back.
- [ ] The map still shows attribution.

## What to write down

For each device: OS version, browser version, the storage table from §1, the
optional-downloads figure from §2, the §3 table, and the date §4 was started so
someone can finish it.

Anything that fails here and cannot be fixed in M14 goes in PROGRESS.md as a
deferral with the device and OS version attached — not as a general statement
about "iOS".
