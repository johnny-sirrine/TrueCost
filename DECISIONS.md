# Decisions

## Architecture And Trust
- Local-first with no backend. Dexie and IndexedDB are the store of record; portability is via JSON import/export rather than sync. Reason: privacy, no auth, offline-first.
- LLMs do extraction, not calculation. Cost math stays pure, auditable, and reproducible.
- Field-level provenance is first-class. Overrides must remain visible in the UI.
- Deterministic heuristics are preferred over opaque ML even when they look less "smart."

## Table Behavior
- The current car is partitioned to the top, not sorted to the top. Sort applies only within each partition.
- Column families use the custom parent-child map instead of TanStack `group()`. Reason: parents such as `allIn`, `firstYear`, and `totalCost` are computed leaf columns, not passive group headers.
- Family children sit to the left of the parent summary column so inputs read left-to-right into the rollup.
- Family expand or collapse uses double chevrons, full-column slate-100 banding, and bold parent labels. These are deliberate affordances, not styling accidents.
- Keep sticky columns limited to `pin`, `source`, and `vehicle`; more hurts scroll space.

## Product Invariants
- A recognized listing URL always overrides `raw_text` as the source label, regardless of entry path. Keep source detection centralized in `detectSourceFromUrl`.
- Sell-scenario net proceeds currently use `0.92 * market value`. This is a known placeholder and should not be treated as finished product math.
- Destructive actions use undo rather than confirm-first. Exception: archiving the current car confirms first because it visibly breaks the current-car invariant.
- Single-current-car enforcement is intentionally duplicated in `addVehicle` and `setCurrentCar` so atomicity survives different write paths.
- Seed current car = CR-V. Real user car = 2014 Chevy Captiva. They are not interchangeable.

## Naming And Terminology
- Product name: `Car Board`. Do not casually rename it to `Car Cost App`.
- Use `My Rating`, `Deal Rating`, and `1st Year Cost`.
- `All-In/mo` means baseline + insurance + reserve. It is not the horizon total.
- `Total Cost` or `5-Year` means ownership cost over the horizon, including net resale loss.
- `catchUpCost` means one-time deferred maintenance, not deposit or down payment.
- Monthly values must carry `/mo` in both the header and the value.

## Accepted Tradeoffs
- No virtualization means a practical ceiling of a few hundred rows.
- No backend means cross-device use stays manual.
- Allowlist-based source detection requires code changes for new marketplaces; that is deliberate because false positives are worse than missed labels.
- Substring URL detection is currently brittle but was accepted as a temporary tradeoff.
- The EPA dataset materially affects bundle size; revisit when mobile and performance matter more.

## Do Not Re-Litigate Without Strong Reason
- Current-car partition vs sort.
- Custom column-family pattern vs TanStack `group()`.
- Never-guess adapter philosophy.
- LLMs staying out of the cost engine.
- Dexie over raw IndexedDB.
- Zustand over Redux.
- Duplicating single-current-car enforcement across `addVehicle` and `setCurrentCar`.
