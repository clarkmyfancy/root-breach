# Root Breach MVP

A deterministic, tick-based browser puzzle game prototype built with React + TypeScript + Vite + Zustand.

## Run

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL in your browser.

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

## Core MVP Features Included

- 2D top-down playable map (canvas rendering)
- Deterministic tick simulation loop with fixed update order
- Fictional scripting DSL with parser, validator, compiler, and line-numbered errors
- Replay with tick counter, line execution highlight, speed controls (1x/2x/4x), play/pause/reset
- Device effects visible on map (camera disable, door open/close, alarm delay, turret retarget)
- Failure summary with primary cause + cause chain + suggested focus
- 5 handcrafted levels with increasing interactions
- Progress persistence via localStorage (unlocks and scripts)

## Project Structure

- `src/game/engine` deterministic simulation, events, replay data
- `src/game/compiler` DSL parsing/validation/compile
- `src/game/levels` handcrafted level definitions
- `src/store/useGameStore.ts` phase flow + replay control + progression
- `src/ui` screens and right/left panel UI
- `src/persistence/saveGame.ts` localStorage save/load

## Add a New Level

1. Add `src/game/levels/levelX.ts` exporting a `LevelDefinition`.
2. Register it in `src/game/levels/index.ts`.
3. Include:
   - `map`, `entry`, `exit`, `playerPath`
   - `devices` with ids and runtime defaults
   - `networkScope`
   - `constraints`

## Add a New DSL Command

1. Add syntax in `src/game/compiler/parser.ts`.
2. Add validation in `src/game/compiler/validator.ts`.
3. Add runtime effect in `applyScheduledScriptActions` inside `src/game/engine/tickEngine.ts`.
4. Add log formatting in `src/ui/panels/EventLogPanel.tsx` if needed.

# root-breach
