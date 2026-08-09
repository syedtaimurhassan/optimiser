# M11 device test — time windows on real hardware

Everything in M11's PROGRESS entry was measured on a Mac. Three of its claims
cannot be checked anywhere else, and one of them is a claim I expect to be
**wrong**:

1. that the default engine works with no cross-origin isolation on a real iPhone;
2. that N workers help on a phone that thermally throttles;
3. that rotating the workers through different search strategies is worth the
   0.11% it costs on the desktop benchmark.

Carry `DEVICE-TEST-M10.md` alongside this — its steps still apply, and this file
only covers what M11 added.

Everything is on the deployed build at
<https://syedtaimurhassan.github.io/optimiser/>. No dev server, no flags.

---

## 0. Before you start

- One physical Android, one physical iPhone. A simulator cannot throttle.
- Both installed to the home screen (Add to Home Screen), not run in a tab.
  Installed is the mode the isolation question is actually about.
- Charge above 50% and **do not** keep them plugged in. A charging phone
  throttles differently, and step 4 is about throttling.
- A route of 60+ stops. `samples/bikes_low_battery.json` is 107 and will do.

**Record the devices:**

```
Android:  model ______________________  OS ______  browser ______
iPhone:   model ______________________  iOS ______
```

---

## 1. It loads at all, without isolation

M9 removed coi-serviceworker and `bench:verify-seam` now fails the build if it
comes back — but "production does not load it" is a fact about the bundle, and
this is a question about iOS Safari.

1. Open the installed app.
2. Settings ▸ Diagnostics.

- [ ] **Expected:** the engine badge says **Fast**, not Basic, not
      "Basic (device supports Fast)".
- [ ] **Expected:** no forced reload on first open. The old service worker
      reloaded the page out from under you; if that still happens, something has
      restored it.

**Record:** badge ▸ Android ______ · iPhone ______

---

## 2. A window that can be met

1. Add three stops. On the middle one, set an arrival window **two hours wide,
   starting an hour after the route's start time** (Route options ▸ Start time).
2. Calculate.

- [ ] **Expected:** the middle stop is visited inside its window, and no amber
      banner appears.
- [ ] **Expected:** the itinerary's ETA for that stop is inside the window — if
      the driver would arrive early, the ETA should show the WINDOW OPENING, not
      the arrival, because waiting at a closed door is part of the plan.

**Record:** Android ▸ ______ · iPhone ▸ ______

---

## 3. A window that cannot be met — the honest failure

This is the step that matters most. Spoke says "can't reoptimise" and names
nothing; the whole point of M11's banner is to do better.

1. On a stop that is clearly far away, set a window **closing 15 minutes after
   the route's start time**.
2. Calculate.

- [ ] **Expected:** a route is still produced and drawn. It must NOT refuse.
- [ ] **Expected:** an amber banner naming **that stop's label**, its closing
      time, the earliest arrival, and how late that is.
- [ ] **Expected:** with two impossible stops, the banner says "2 stops…" and
      "Show all 2" expands to list both.

**Copy the exact banner text** — the wording is the deliverable:

```
Android:

iPhone:
```

---

## 4. Workers on a throttling phone 🔥

The claim under test: N workers help. iOS reports four cores on every iPhone from
the 11 to the 17 regardless of its real layout, so the pool is three workers on
any of them, and phones are thermally limited under sustained load.

1. Let the phone cool to room temperature. Do not charge it.
2. Route of 60+ stops, search tier **Maximum**.
3. Calculate **eight times in a row**, without reloading. Note the reported
   travel time each run and roughly how long each took.

- [ ] Runs 1–2 are the cold numbers. Runs 7–8 are the throttled ones.

```
run:      1     2     3     4     5     6     7     8
Android:  ____  ____  ____  ____  ____  ____  ____  ____
iPhone:   ____  ____  ____  ____  ____  ____  ____  ____
```

- [ ] **Expected:** later runs are slower and/or slightly worse. **How much** is
      the number to report — if runs 7–8 are more than ~30% worse than 1–2, the
      "extra cores are diversification" argument needs revisiting on hardware,
      not on a desktop.
- [ ] Does the phone get noticeably hot? ▸ Android ______ · iPhone ______

---

## 5. Is the strategy rotation earning its keep? 🔍

**I expect this one to say no, and shipping it anyway is recorded as a deferral.**
On the desktop TSPTW ladder, three ILS workers beat one-of-each by 0.11% mean
gap. The argument for rotating is that ILS and GLS win at different instance
sizes; the argument has not been tested on a phone.

There is no UI switch for this. Either:

- run `npm run bench:tsptw` on a laptop with `strategyFor` returning `'ils'`
  unconditionally and compare, or
- note in step 4 whether the eight runs give **noticeably varied** travel times.
  High variance between runs is what rotation is supposed to buy — several
  different searches, one of which lands well.

**Record:** spread between best and worst of the eight runs ▸ Android ______ ·
iPhone ______

---

## 6. A break lands in its window

1. Route ▸ plan a break: 45 minutes, between 11:30 and 13:00. Set the route's
   start time to 08:00.
2. Calculate.

- [ ] **Expected:** the itinerary shows the break somewhere between 11:30 and
      13:00, and every ETA after it is 45 minutes later than it would otherwise
      be.
- [ ] Mark the break **taken**, then reoptimise.
- [ ] **Expected:** the break is no longer planned, and every downstream ETA
      moves 45 minutes earlier. That cascade is the thing to check — if the ETAs
      do not move, the break's duration is being double-counted or dropped.

**Record:** break start ▸ Android ______ · iPhone ______

---

## 7. First and Last

1. Mark two stops **First** and one **Last**. Keep a start location set.

- [ ] **Expected:** no error. Until M11 this combination was rejected with "Two
      different stops are pinned to the start".
- [ ] **Expected:** after Calculate, the two First stops are positions 1 and 2
      (after the start), and the Last stop is immediately before the end.

**Record:** Android ▸ ______ · iPhone ▸ ______

---

## 8. Anything else

Battery, heat, wrongness. "The ETAs felt optimistic" is useful even without a
number — it is the one thing this milestone changed that a driver would feel
before they could measure.

```
Android:

iPhone:
```
