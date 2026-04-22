# Project Context

## Scope
- `Car Board` is a local-first used-car evaluation board for a single analytical user.
- It compares vehicles on total ownership cost, not sticker price.
- The current car is a distinct top partition, not just another candidate.
- This is not a multi-tenant product, SaaS, or dealer tool.

## Core Promise
- Math must stay explicit, deterministic, and overridable.
- LLMs may help extract listing text into structured fields; they never compute costs.
- Every field should surface provenance and confidence so the user can audit the result.

## Trust Rules
- Show uncertainty instead of hiding it. Missing listing facts stay missing.
- Never invent data. Unknown mapper or adapter outputs stay `undefined`; do not guess.
- Keep extraction and cost computation separate. Do not blend parsing logic into cost math.
- Keep the product privacy-first: no server, no telemetry, no accounts.

## Load-Bearing Constraints
- The current car stays in its own top partition. Sorting happens within partitions, not across them.
- The single-current-car invariant is load-bearing and must remain atomically enforced at each write path.
- Sticky-column offsets are hand-synced to column sizes; change them together or alignment breaks.
- The EPA vehicle dataset is large enough to matter for performance planning; treat bundle changes carefully.
- Demo seed data uses a CR-V as the current car. The real user's car is a 2014 Chevy Captiva. Do not let the seed example leak into docs, tests, or product copy.

## UX And Copy Rules
- Destructive actions use undo toasts by default. Action toasts last 6 seconds; plain toasts last 3 seconds.
- Overrides are visibly marked with a violet `*`.
- Monthly values carry `/mo` in both the header and the rendered value.
- Column families start collapsed and expand with the existing double-chevron pattern, full-column slate-100 banding, and bold parent label.
- Copy stays factual and explicit: use labels like `My Rating`, `Deal Rating`, and `1st Year Cost`.

## Planned, Not Shipped
- Bundle splitting for the EPA dataset.
- A real sell-scenario model; current net-proceeds math is still a placeholder.
- More robust URL source detection.
- Multi-driver or household mode.
- Cross-device sync; portability should remain via JSON import/export rather than accounts.
- A richer compare modal focused on deltas, not just side-by-side values.
