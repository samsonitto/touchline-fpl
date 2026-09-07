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

Implemented: linked, locally saved gameweek snapshots; next-week creation carries the final squad, bank and retained purchase/selling settings, records purchase prices for incoming players, and clears the active chip. Free transfers roll forward as `min(5, max(0, allowance - planned transfers) + 1)`; unknown allowances remain unknown. Every week has its own lineup, captaincy, transfers and chip. Editing an ancestor flags descendants for review. “Replace this week from previous week” explicitly rebuilds a snapshot and supports Undo; subsequent weeks stay flagged until reviewed. Duplicate creates a detached alternative. Chip conflicts prevent a second Triple Captain or Bench Boost in the same timeline and season half. Prior official chip usage is not known. Wildcard/Free Hit remain unsupported.

Projection coverage: verified FPL bootstrap data supplies `ep_this` and `ep_next`, not a multi-week horizon. Future weeks therefore show fixtures, bank and transfers but no xPts or Best XI suggestion. A licensed, validated multi-week projection source is still outstanding; future projections have deliberately not been invented or extrapolated. Shared snapshots and image exports carry the selected gameweek.

## Phase 5 — Helpful suggestions

Suggest a legal best XI and captain from the user's squad; show projected gain and allow explicit application. Keep the source and limits of predictions visible.

Implemented: exhaustively evaluates all 1,365 possible elevens in a complete 15-player squad, enforces positional formation limits, chooses the highest-projection starting captain and accounts for Triple Captain/Bench Boost. Ties favour fewer changes. Review shows formation, captain, vice-captain, lineup, bench, projected total and gain before explicit Apply. Applying uses normal draft history and is undoable. Unknown projections, missing players and unsupported gameweeks disable suggestions. There are no transfers, automatic substitutions or vice-captain fallback predictions. Availability is taken only from the source projections; users should review news.

## Phase 6 — Launch and retention

Demo squad without registration, a custom domain, onboarding centred on team import, and an initial group of FPL users. Measure import, saved plan, sharing and next-gameweek return with an appropriate privacy approach. Use feedback to prioritise fixes before broader promotion.
