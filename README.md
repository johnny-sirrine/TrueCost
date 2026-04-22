# Car Board

A local-first analyst dashboard for evaluating used car listings. Paste a URL, text, or manually enter a vehicle -- the app creates a structured row with computed costs, resale projections, deal quality, and capability scores.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app ships with 7 seed vehicles.

## Architecture

### Core Principles

- **Deterministic calculations**: All formulas, costs, resale, deal quality are pure TypeScript functions. No LLM involvement.
- **Local-first**: All data persists in IndexedDB via Dexie.js. No backend required.
- **Uncertainty-aware**: Every field tracks its origin (extracted, inferred, assumed, overridden) and confidence level.

### Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Dexie.js (IndexedDB) for persistent storage with schema versioning
- Zustand for ephemeral UI state
- TanStack Table for sortable/filterable board
- Zod for runtime schema validation

### Project Structure

```
src/
  types/          # TypeScript types (vehicle, assumptions, evaluation, dimensions, adapter)
  engine/         # Pure calculation engine (zero React imports)
    mpg.ts        # Factor-based MPG estimation
    costs.ts      # Fuel, routine, repairs, reserve, baseline, all-in
    resale.ts     # Current value estimation + forward projection
    dealQuality.ts# Deterministic heuristic scoring
    dimensions/   # Pluggable comparison dimensions (capability is MVP)
  data/           # Factor tables, depreciation profiles, seed data, vehicle reference
  db/             # Dexie schema, Zod validation schemas
  adapters/       # Listing source parsers (manual, raw text, KSL/FB/Cars.com stubs)
  hooks/          # React hooks (Dexie live queries, computed board, CRUD actions)
  store/          # Zustand UI state (no persistence)
  components/     # React components (board, detail drawer, assumptions, add listing)
  lib/            # Formatters, constants
```

### Data Model

Each vehicle row has three nested domains:
- **listing**: Raw source data (what the seller/listing says)
- **canonical**: Normalized vehicle identity/specs (auto-derived where possible)
- **user**: User-controlled data (price, mileage, condition, overrides, notes)

Computed evaluation is **never stored** -- always derived from `(VehicleRow, GlobalAssumptions)` via the pure engine.

### Cost Tiers

- **Baseline monthly** = fuel + routine maintenance + expected repairs (recurring operating burden)
- **Reserve monthly** = major repair reserve (expected exposure over ownership horizon, amortized monthly -- not a literal bill, but real cost exposure)
- **All-in monthly** = baseline + reserve (prudent total budget)

### Resale Engine

Anchored to current market value estimate, projected forward using depreciation profiles:
- `value_flattened_durable` -- trucks/SUVs that hold value (4Runner, Frontier)
- `normal_midlife` -- typical crossovers/sedans
- `still_depreciating` -- newer vehicles on the steep part of the curve
- `branded_title_discounted` -- rebuilt/salvage with permanent haircut

### Ingestion

Three input modes:
1. **Manual entry** (always works)
2. **Raw text paste** (regex extraction -- primary smart path in v1)
3. **URL paste** (best-effort only, never trusted)

All paths require user review before saving. Adapter interface designed for future AI/scraper plugins.

### Comparison Dimensions

Pluggable framework. MVP includes off-road/rough-road capability. Add new dimensions by implementing `ComparisonDimension` and registering in `src/engine/dimensions/index.ts`.

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
```
