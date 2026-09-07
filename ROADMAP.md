# Touchline roadmap

Product focus: make planning and sharing the next FPL move quick and clear on mobile.

## Phase 1 — Sharing

- Copy a snapshot link containing squad picks, captain, vice-captain, chip and planning budget.
- Preview a received squad and explicitly save an editable copy without replacing existing plans.
- Download a branded PNG with the gameweek, lineup, bench, captain, chip and projected points.
- Keep manager names, entry IDs and other local plans out of shared data.
- Validate links, reject incompatible seasons and explain that prices and projections refresh from current FPL data.
- Use self-contained URL fragments: no account or database required. Links are snapshots; later edits do not change them. Long links have no custom social preview in this phase.
- Acceptance: round-trip sharing preserves picks/order/roles/chip, malformed links fail safely, existing drafts survive import, images work without remote artwork.

## Phase 2 — Confident editing

Undo/redo for squad changes, explicit outfield bench ordering, and a desktop/mobile usability pass. Acceptance: a user can reverse a transfer, captain change or substitution without losing earlier work.

Implemented: per-plan undo/redo for the last 50 edits in the current session, including transfers, captaincy, chips, reset and financial settings. A new edit clears redo. Outfield bench arrows change priority while the goalkeeper remains first. Added mobile-friendly control layouts and a three-column player statistics grid. Automated checks pass; hands-on desktop/mobile visual verification remains pending because no browser connection is available.

## Phase 3 — Trustworthy transfer budgets

Purchase/selling-price overrides, free transfers and hit costs. Distinguish public market prices from user-specific selling prices. Acceptance: transfer affordability and net points reflect entered values and explain missing data.

Implemented: opt-in transfer planning from a complete 15-player starting squad; editable starting bank, remaining free transfers (0–5), purchase prices and explicit selling overrides. Prices use integer tenths, half-profit rounding and full losses. Unknown selling prices fall back to labelled market estimates; unknown free transfers leave hits/net xPts unknown. Affordability, available bank and validation use the same calculation. Final incoming players relative to the starting squad determine planned transfers; each transfer beyond the entered allowance costs four points. Substitutions and reverted experiments do not count. Settings persist with the draft and support undo/redo. Sharing preserves the resulting planning budget but excludes purchase history and transfer settings.

Scope: one gameweek of proposed moves, not already-confirmed transactions. Users must verify their starting bank and remaining free transfers in FPL. Historical hits, automatic substitutions, Wildcard/Free Hit and multi-week rollover remain outside this phase.

## Phase 4 — Multi-gameweek planning

Gameweek timeline for transfers, lineups, captaincy and chips. Define rollover and chip availability rules. Secure and validate a multi-week projection source before displaying longer-range xPts.

## Phase 5 — Helpful suggestions

Suggest a legal best XI and captain from the user's squad; show projected gain and allow explicit application. Keep the source and limits of predictions visible.

## Phase 6 — Launch and retention

Demo squad without registration, a custom domain, onboarding centred on team import, and an initial group of FPL users. Measure import, saved plan, sharing and next-gameweek return with an appropriate privacy approach. Use feedback to prioritise fixes before broader promotion.
