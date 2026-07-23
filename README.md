# Route Optimiser

A fast, **100% client‑side** route optimiser for the browser. Upload a list of
coordinates, choose how many stops to visit, and it computes the most efficient
order to drive them — then hands the route straight to Google Maps for turn‑by‑turn
navigation.

**Live demo:** https://syedtaimurhassan.github.io/optimiser/

There is no backend to run and no account to create. The optimisation runs locally
in your browser using Google OR‑Tools compiled to WebAssembly.

---

## What it does

Given up to a few hundred stops, Route Optimiser answers two questions at once:

1. **Which stops to visit** — pick the best *K of N* (e.g. the best 20 of 100).
2. **In what order** — the shortest driving time or distance through them.

It supports fixed or open endpoints (set a start and/or end, or let the optimiser
choose both), then draws the result on a map and generates ready‑to‑use Google Maps
navigation links.

### Features

- **Selective routing** — choose the best *K of N* stops, not just the order of all of them.
- **Fixed or open endpoints** — pin a start/end, or leave them open for the optimiser to decide.
- **Optimise for time or distance.**
- **Adjustable search quality** — Fast (~1s), Deep (~3s), or Maximum (~5s) effort.
- **CSV / JSON import** with clear, per‑row error reporting.
- **Interactive map** (Leaflet) with hover‑synced list ↔ map highlighting.
- **Delivery workflow** — tick off stops as done; the itinerary and Google Maps links update live.
- **Set points on the map** by clicking, or type coordinates directly.
- **Save & reload favourites**, and **auto‑save** — your work survives a page refresh.
- **Responsive** — a side‑by‑side layout on desktop and a draggable bottom sheet on mobile.

---

## How it works

Everything runs in the browser as a three‑stage pipeline:

| Stage | Tool | Purpose |
| --- | --- | --- |
| 1. Cost matrix | **OSRM Table API** | Real driving times/distances between every pair of points. |
| 2. Optimisation | **OR‑Tools (WASM)** | Selects the best *K* stops and orders them (Selective TSP). |
| 3. Road geometry | **OSRM Route API** | Draws the chosen route along real roads. |

**The optimisation model.** The problem is a *Selective TSP*: the solver must both
choose a subset of stops and order them. It is modelled with two virtual depot
nodes joined by zero‑cost arcs to the allowed endpoints (which cleanly handles
fixed, half‑open, and fully open routes), optional stops via disjunction penalties,
and a capacity dimension that caps the number of visited stops at *K*.

**The search strategy.** Because the OR‑Tools WebAssembly build only exposes a
single first‑solution heuristic (no metaheuristic or internal time limit), route
quality is improved with a **time‑boxed multi‑start** running in JavaScript: the
solver tries a portfolio of construction heuristics plus randomised ("noised")
restarts and keeps the best result found within the chosen time budget. The budget
is a **ceiling, not a fixed wait** — simple routes converge and return early. On
hard, clustered inputs this consistently beats a single greedy pass (which tends to
get "anchored" near the start point).

> **Note on data:** the optimisation itself never leaves your device, but the
> driving distances are fetched from the **public OSRM demo server**
> (`router.project-osrm.org`), so coordinates are sent there for routing.

---

## Tech stack

- **React 19** + **TypeScript** + **Vite 8**
- **Zustand** for state management (with `localStorage` persistence)
- **Leaflet** / **react‑leaflet** for the map
- **Google OR‑Tools** compiled to **WebAssembly** (`or-tools-wasm`)
- **Tailwind CSS v4**
- **PapaParse** for CSV parsing
- **Playwright** for browser‑based verification
- **oxlint** for linting

---

## Getting started

### Prerequisites

- **Node.js ≥ 20.19** (required by Vite 8)
- npm

### Install & run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

### Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload. |
| `npm run build` | Type‑check and build for production into `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run oxlint. |
| `npm run deploy` | Build, prune unused WASM, and publish to GitHub Pages. |

---

## Input format

Upload a **`.csv`** or **`.json`** file of coordinates. Latitude must be within
±90 and longitude within ±180; invalid rows are skipped and reported.

**CSV** — needs a header row. Column names are case‑insensitive; `lat`/`latitude`
and `lng`/`lon`/`long`/`longitude` are all accepted.

```csv
lat,lng
40.7128,-74.0060
40.7580,-73.9855
40.7061,-73.9969
```

**JSON** — an array of `{ lat, lng }` objects.

```json
[
  { "lat": 40.7128, "lng": -74.0060 },
  { "lat": 40.7580, "lng": -73.9855 }
]
```

---

## Browser requirements

The optimiser uses multi‑threaded WebAssembly, which needs the page to be
**cross‑origin isolated** (`SharedArrayBuffer`). On a static host like GitHub Pages
the required `COOP`/`COEP` headers are supplied by a bundled service worker
(`public/coi-serviceworker.js`), so no special server configuration is needed.

Use an up‑to‑date **Chrome** or **Edge** for best results. If isolation cannot be
enabled, the app shows a clear warning instead of failing silently.

---

## Deployment

The app is a fully static bundle and is deployed to **GitHub Pages**:

```bash
npm run deploy
```

This runs the production build, then `scripts/prune-wasm.mjs`, which removes the
OR‑Tools runtimes the app does not use (trimming the WASM payload from ~150 MB down
to ~16 MB) before publishing `dist/` with `gh-pages`.

---

## Project structure

```
src/
├─ components/     UI components (map, sidebar, panels, controls)
├─ hooks/          Small reusable hooks (e.g. useMediaQuery)
├─ lib/            Core logic
│  ├─ solver.ts        OR-Tools multi-start Selective TSP
│  ├─ planRoute.ts     Orchestrates matrix → solve → geometry
│  ├─ routingService.ts OSRM Table & Route API calls
│  └─ parseFile.ts     CSV/JSON import
├─ store/          Zustand store (state + actions, persisted)
└─ types.ts        Shared types
public/
└─ coi-serviceworker.js  Enables cross-origin isolation on static hosting
scripts/
└─ prune-wasm.mjs        Strips unused OR-Tools WASM runtimes before deploy
```

---

## Limitations

- Routing data comes from the **public OSRM demo server**, which is rate‑limited
  and best‑effort. For heavy or commercial use, point the app at your own OSRM
  instance.
- The client caps input at **~300 points** to keep matrix requests reasonable.
- The optimiser returns a high‑quality result within the time budget, not a
  mathematically proven optimum.

---

## License

This project is currently private and unlicensed. All rights reserved by the
author.
