# Touchline

A responsive squad planner for **standard Fantasy Premier League**, not FPL Draft. Build a 15-player squad on a pitch, filter the official player pool, manage starters and captaincy, save named drafts, and import public picks.

The purple-and-green interface includes original CSS club-colour shirt illustrations and a distinct generic goalkeeper shirt. These are visual club identifiers, not official or season-specific kit replicas; no crests, sponsors, or remote kit images are used. Club abbreviations determine colours independently of FPL's changing numeric team IDs. Unknown clubs receive a neutral shirt. Light and dark themes share the same pitch and kit colours.

## Run

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. No environment variables, account, database or secrets are required. Drafts, selected baseline, entry ID and sort/position preferences are saved in versioned device-local storage (`touchline:v1`). No Premier League credentials are collected. Clearing browser storage removes saved plans.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Tests use mocked data and do not contact FPL. They cover squad and lineup constraints, club limits, integer-tenths prices, budget, captaincy, entry ID extraction, import validation and comparison arithmetic.

## Architecture and data

Next.js App Router, TypeScript, Tailwind CSS, Zod and Vitest. The browser only calls the app's fixed `/api/catalog`, `/api/import?entry=...`, and `/api/player/[id]` routes. `src/lib/fpl.ts` validates and normalizes upstream responses; `server.ts` owns network access; `squad.ts` contains pure squad rules and comparisons.

Official public source: https://fantasy.premierleague.com/api/ with `bootstrap-static/`, `fixtures/`, `element-summary/{id}/`, `entry/{id}/`, and `entry/{id}/event/{gameweek}/picks/`. These endpoints are unofficially consumed, undocumented and unstable. No HTML scraping or arbitrary proxying is used. An upstream response change produces an explicit error rather than invented player data.

Bootstrap, fixtures and player summaries are cached for 5 minutes; public entries/picks for 60 seconds. Catalog responses also allow 5-minute CDN caching and 10-minute stale-while-revalidate. Requests have a 10-second upstream timeout. API routes enforce a best-effort in-memory limit of 40 requests per minute per IP per function instance; this is not a distributed rate limiter. Add Vercel Firewall rate rules for stronger deployment-wide control if traffic warrants it.

## Public imports and planning limits

FPL does **not** publish a manager's next lineup before the deadline. Imports show the latest available published Gameweek picks, looking backwards if a Gameweek has no published picks. They may differ from an unpublished current squad. The imported baseline is protected from squad edits; duplicate it to plan. Imports can be unavailable for invalid/inaccessible entries or before the first published Gameweek.

New plans use the official starting budget. Imported plans use the squad's current market prices plus the published bank as a **planning estimate**. Actual selling prices depend on purchase history, which public picks do not provide. Free transfers, transfer hits, chips, automatic substitutions and historical prices are not simulated. Comparison points/form are unweighted squad totals, not predicted points. Moving starters/bench players is allowed while editing and immediately reported by the validation checklist; complete the checklist for a valid lineup. Outfield bench priority follows selection order and can be changed by removing/re-adding players.

Availability, price and fixture data can change. Fixtures include the next three scheduled matches, including double Gameweeks; postponed/unpublished fixtures may be TBC. Local drafts from an earlier season may contain players missing from the current feed and require a reset.

## Deploy to Vercel

Player cards show FPL's `ep_next` projection for the event explicitly marked `is_next`. These are estimates, displayed once per gameweek without multiplying by fixture count. Starting XI xPts include a double captain contribution; bench xPts are separate. Automatic substitutions, vice-captain fallback and chips are not modelled. Missing projections display a dash and prevent a misleading partial total. Incomplete lineups are labelled as selected-player totals.

Import this directory as a Next.js project, or deploy it with Vercel's CLI/connector. Use `npm run build`; no environment setup is required. Upstream FPL access depends on FPL accepting requests from the deployment region. The UI handles blocked/unavailable responses explicitly.

Unofficial application, not affiliated with the Premier League. No Premier League or club logos are used.
