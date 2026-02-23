# Root Breach V2

A deterministic, script-first covert ops sim built with React + TypeScript + Vite + Zustand.

## V2 Requirements Handoff

The authoritative V2 requirements contract lives at:

- `docs/ROOT_BREACH_V2_REQUIREMENTS.md`

This document is implementation-agnostic and defines the canonical game model, lifecycle, win/fail rules, tick order, command semantics, UI panel contracts, debrief contract, and acceptance criteria.

## Run

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL in your browser.

### Gameplay Modes

- Local `npm run dev` defaults to **development gameplay mode**:
  - all contracts unlocked
  - all tools active
  - progression/tool gating bypassed
- Production builds default to **production gameplay mode** with normal progression.
- Optional override:
  - `VITE_ROOT_BREACH_MODE=development`
  - `VITE_ROOT_BREACH_MODE=production`

## Deploy To Heroku

This app is a static React build, but Heroku still needs a web process to serve files.  
This repo now includes:

- `server.js`: small Node static server that serves `dist/` and falls back to `index.html` for SPA routes
- `Procfile`: `web: npm start`
- `npm start`: runs `node server.js`

Setup checklist:

1. In Heroku app settings, ensure the `heroku/nodejs` buildpack is enabled.
2. Keep stack current (for example `heroku-24`).
3. Confirm your app has at least one active **Web** dyno/process type.
4. Push to `main` (auto deploy will build and release).

Local production test:

1. `npm run build`
2. `npm start`
3. Open `http://localhost:3000`

## Core V2 Features Included

- Diegetic desktop shell with apps:
  - Inbox, Contracts, Site Monitor, Forensics, Black Market, Profile, World Map
- Deterministic mission engine with explicit phases:
  - Planning -> Objective -> Cleanup -> Complete/Failed
- Script-first DSL with compile/validate/replay loop
- Contract-driven objectives and rule checks (ghost/frame/loud-diversion style outcomes)
- Trace system with live source breakdown
- Evidence surfaces + cleanup/framing actions
- Live attribution model (actor, confidence, top reasons)
- Site Monitor mission desk:
  - status strip, system stack, terminal, timeline, event stream, forensics snapshot
- Debrief with objective/cleanup/trace/attribution/rule outcomes + payout/rep/heat deltas
- Campaign progression and economy:
  - credits, rep, heat, tools, contract unlocks/history
- Save versioning + migration path and deterministic regression tests

## Project Structure

- `src/game/engine` deterministic mission simulation, events, replay data
- `src/game/compiler` DSL parsing/validation/compile
- `src/game/contracts` contract data and mission rules
- `src/game/sites` reusable site blueprints
- `src/game/levels` legacy geometry/device definitions backing site data
- `src/store/useGameStore.ts` phase flow + replay control + progression
- `src/ui` screens and right/left panel UI
- `src/persistence/saveGame.ts` localStorage save/load

## Add a New Contract

1. Add a `ContractDefinition` in `src/game/contracts/index.ts`.
2. Reference a site/level scope (`siteId`, `siteNodes`, targets, auth endpoints).
3. Define:
   - objective type
   - mission rules
   - required tools
   - story intro, known intel, unknowns
4. Verify rule checks in debrief and forensics panels.

## Add a New DSL Command

1. Add syntax in `src/game/compiler/parser.ts`.
2. Add validation in `src/game/compiler/validator.ts`.
3. Add tool gating in `src/game/tools/index.ts`.
4. Add runtime effect in `applyScheduledScriptActions` inside `src/game/engine/tickEngine.ts`.
5. Ensure event and forensics visibility (message/target/trace/evidence impact).

# root-breach
