# Tasks

## Current Priorities
1. Replace the Pointa MCP visual-annotation loop with a Codex-native or screenshot-comment workflow. The review cadence matters more than the specific tool.
2. Harden `detectSourceFromUrl` with `URL` parsing plus a hostname allowlist. Current substring matching is brittle around `m.facebook.com`, subdomains, trailing punctuation, and query strings.
3. Reduce bundle cost by dynamic-importing `epa-vehicles` during listing extraction instead of loading it at startup.

## Known Weak Spots
- `COLUMN_FAMILIES` and `boardColumns` order are separate sources of truth; reordering one can break family banding.
- Sticky offsets and widths are hand-computed; adding another sticky column requires edits in both maps.
- Source re-detection on URL changes should stay centralized in `detectSourceFromUrl`. Today it is intentionally called from `AddListingDialog.handleSave` and `DetailDrawer.handleListingChange`; do not add a third custom detection path.
- Test coverage is light outside `engine/`. Missing coverage includes adapters and UI invariants such as current-car partitioning, single-current-car enforcement, sticky-column alignment, and the "URL overrides raw_text" rule.
- There is no regression test for the "recognized URL beats `raw_text`" source override.
- Toasts have no queue cap, so repeated destructive actions can stack.
- `useComputedBoard` recomputes on every assumption change; acceptable now, worth revisiting around 50 or more rows.

## Preserve While Iterating
- Treat these repo docs as the source of truth for product rules that previously lived in external memory files.
- Keep the custom `COLUMN_FAMILIES` / `CHILD_TO_PARENT` pattern. Do not switch it to TanStack `group()`; parent columns are computed leaves, not group headers.
- Keep `engine/` deterministic. No LLM calls belong in cost calculation.
- Keep the adapter allowlist philosophy. Unknown inputs stay `undefined`; never switch to best-guess defaults.
- Keep current-car partition semantics: top-of-table, independent of sort.
- Keep docs, tests, and examples consistent: seed current car is a CR-V, but the real user's car is a 2014 Chevy Captiva.

## Next Logical Improvements
1. Derive sticky offsets from a single ordered `STICKY_COLUMNS` config.
2. Add an adapter test harness with KSL, Facebook, cars.com, and craigslist fixtures.
3. Add a per-cell provenance popover instead of relying only on the `*`.
4. Add keyboard navigation: `j` and `k` for rows, `space` to pin, `del` to remove.
5. Add a "Why this cost?" trace panel for computed values.
6. Persist column visibility and verify it survives reload.
7. Add an import/export round-trip test.
8. Replace the `0.92` resale heuristic with profile-driven logic.
9. Upgrade the compare modal to highlight deltas.
10. Run an accessibility pass on sort state, focus, and keyboard flow.
