# Root Breach

Root Breach is a React + TypeScript coding-stealth prototype: move on a map, access a turret terminal, and write code to survive and clear levels.

## Current Game State

- Two playable turret levels: `level1` and auto-generated harder `level2`.
- Map mode uses manual movement (`WASD` / arrows).
- Terminal opens as a modal when near the turret terminal (`E`).
- Turret logic comes from terminal code. If code does not produce `setAim(...)`, the turret has no aim.
- In map mode, the turret script is evaluated each turret cycle against live state (current intruder + alive guards), then it aims/fires from that result.
- Clear all guards to open the exit door, then walk through it to advance.

## Controls

- `WASD` / arrows: move
- `E`: open terminal when near terminal device
- `Esc`: close terminal modal
- `Ctrl/Cmd + R` in terminal: compile + run
- Terminal buttons:
  - `Compile`: validate script
  - `Run`: compile/run and close modal
  - `Reset`: clear source
- Map overlay `Replay`: reset current encounter

## Terminal Language (Turret Focus)

Primary command:

- `setAim(x, y)`

Available variables:

- `intruderPosX`, `intruderPosY`
- `numGuards`
- `guardPosX[index]`, `guardPosY[index]`

Supported expressions:

- Arithmetic: `+ - * / **`
- `sqrt(...)`
- Locals via assignment (`x = ...`) and increment (`i ++`)
- Comments: `// ...` and `# ...` (full-line)

Control flow:

- `if (condition) { ... }`
- `while (condition) { ... }`
- `loop(count) { ... }`
- Comparison operators: `== != < <= > >=`
- Infinite-loop guard is compile-time bounded; loops without explicit `wait(n)` auto-advance time.

## Dev vs Production Unlocking

- Dev mode (`import.meta.env.DEV`): all levels unlocked.
- Production build: levels unlock in order.

## Architecture (Concise)

- `src/game/compiler`: parsing, validation, compile-time expansion, expression evaluation.
- `src/game/engine`: deterministic tick simulation and replay model.
- `src/game/levels`: level definitions/registry (`level1`, `level2`).
- `src/store/useGameStore.ts`: app flow, progression, replay state.
- `src/ui/screens/LevelScreen.tsx`: map-mode encounter loop + terminal modal + level transition.
- `src/persistence/saveGame.ts`: local save data (`localStorage`).

Note: there are two execution contexts today:

- Engine replay simulation (deterministic tick model).
- Real-time map encounter loop in `LevelScreen` for turret-aim levels.

Keeping these behaviorally aligned is the main architectural constraint.

## Tests

- `tests/compiler/compile-range.test.ts`: expression, loop, and compile behavior.
- `tests/engine/determinism.test.ts`: replay determinism and turret behavior invariants.
- `tests/levels/levels.test.ts`: level registry/difficulty/door invariants.

Run:

```bash
npm test
```

## Development

```bash
npm install
npm run dev
```

Build and serve:

```bash
npm run build
npm start
```
