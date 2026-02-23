# Root Breach

Root Breach is a React + TypeScript puzzle game prototype where the player physically moves on a map, accesses a terminal, writes code, and survives an encounter.

Current project state is intentionally focused: one playable mission (`level1`) centered on turret programming.

## Current Gameplay Loop

1. Start Level 1 from the mission board.
2. Move the player in map mode (`WASD` or arrow keys).
3. Enter the arena between walls to start combat.
4. Move near the turret terminal and press `E` to open terminal mode.
5. Write turret code, compile, and run.
6. Terminal closes on run and returns to map mode.
7. Use the floating `Replay` button on the map to reset the encounter.

Important current behavior:

- The terminal is the turret brain in this level.
- If the script has no valid turret instruction (for example only `//setAim(...)`), the turret does not fire.
- Event log UI is currently removed.

## Controls

- `WASD` or arrow keys: move on map
- `E`: open terminal when near terminal device
- `Esc`: close terminal modal
- Terminal buttons:
  - `Compile`: syntax + semantic validation only
  - `Run`: execute compiled script and close modal
  - `Reset`: clear terminal source
- Terminal shortcuts:
  - `Ctrl/Cmd + C`: compile/run
  - `Ctrl/Cmd + R`: reset source

## Scripting Language (Current)

Parser supports several commands globally, but Level 1 gameplay is built around turret aiming.

### Key command for Level 1

- `setAim(x, y)`

### Supported aim expressions

- Integers: `-2`, `0`, `5`
- Dynamic variables:
  - `intruderPosX`
  - `intruderPosY`
  - `numGuards`
  - `guardPosX[index]`
  - `guardPosY[index]`

Example:

```txt
// Track player
setAim(intruderPosX, intruderPosY)
```

### Comments and loops

- Full-line comments are ignored when prefixed with `//` or `#`.
- `while (condition) { ... }` is supported and expanded at compile time.
- Conditions support:
  - `true`, `false`
  - comparisons: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Loop safety:
  - body must advance time with `wait(n)`
  - compile-time iteration guard prevents runaway expansion

## Dev Mode vs Production Mode

Unlock behavior is environment-aware:

- Dev mode (`import.meta.env.DEV === true`): all levels unlocked.
- Production build: normal progression unlock order.

There is currently one level, but the unlock system is still in place for future missions.

## Architecture

The codebase is split into deterministic simulation, compiler pipeline, state orchestration, and UI.

- `src/game/compiler`
  - `parser.ts`: command syntax
  - `validator.ts`: device scope and semantic checks
  - `compile.ts`: scheduling + while-loop expansion
  - `turretAim.ts`: expression resolution for `setAim`
- `src/game/engine`
  - `tickEngine.ts`: deterministic tick simulation and event emission
  - `simulationRunner.ts`: engine entrypoint
  - `eventTypes.ts`: replay/event contracts
- `src/game/levels`
  - `level1.ts`: current mission data
  - `index.ts`: level registry
- `src/store`
  - `useGameStore.ts`: app phase/state machine and replay controls
  - `progression.ts`: unlock/attempt/best-script rules
- `src/ui`
  - `screens/LevelScreen.tsx`: map mode + terminal modal flow
  - `panels/TerminalPanel.tsx`, `MapPanel.tsx`, `ReplayControls.tsx`, etc.
- `src/persistence/saveGame.ts`
  - local save/load via `localStorage`

## Architectural Notes (Important)

1. There are two runtime paths:
   - Deterministic tick engine (`src/game/engine`) used for simulation/replay.
   - Real-time turret-aim encounter loop in `src/ui/screens/LevelScreen.tsx` for WASD map mode.
2. The compiler/engine path is well covered by automated tests.
3. The map-mode encounter path is more UI-driven and should stay behaviorally aligned with engine rules as the game grows.
4. Parser supports broader command surface than Level 1 currently uses; treat it as platform capacity for future levels.

## Tests

- `tests/compiler/compile-range.test.ts`
  - compile bounds
  - expression validation
  - comments
  - while-loop expansion rules
- `tests/engine/determinism.test.ts`
  - deterministic replay behavior
  - fixed vs dynamic turret aiming
  - “no instructions => no turret fire” behavior

Run:

```bash
npm test
```

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

`npm start` serves `dist/` through `server.js` and supports SPA route fallback.
