import { useEffect, useMemo, useRef, useState } from 'react';
import { compileScript } from '../../game/compiler/compile';
import type { CompiledCommand } from '../../game/compiler/scriptTypes';
import type { EventRecord, SimulationSnapshot } from '../../game/engine/eventTypes';
import { runSimulation } from '../../game/engine/simulationRunner';
import type { LevelDefinition, Point } from '../../game/models/types';
import { levelById, levels } from '../../game/levels';
import { MapPanel } from '../panels/MapPanel';
import { TerminalPanel } from '../panels/TerminalPanel';
import { useGameStore } from '../../store/useGameStore';

function getLevel(levelId: string | null): LevelDefinition | null {
  return levelId ? levelById[levelId] ?? null : null;
}

function isWalkable(level: LevelDefinition, snapshot: SimulationSnapshot | null, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.map.width || y >= level.map.height) {
    return false;
  }

  if (level.map.walls.some((wall) => wall.x === x && wall.y === y)) {
    return false;
  }

  if (!snapshot) {
    return true;
  }

  return !Object.values(snapshot.devices).some((device) => {
    return device.type === 'door' && !device.isOpen && device.x === x && device.y === y;
  });
}

function computeFrame(level: LevelDefinition, playerPath: Point[], commands: CompiledCommand[]) {
  const runtimeLevel: LevelDefinition = {
    ...level,
    entry: { ...playerPath[0] },
    playerPath,
  };

  const result = runSimulation(runtimeLevel, commands);
  const frameIndex = Math.min(Math.max(playerPath.length - 1, 0), Math.max(result.frames.length - 1, 0));
  return result.frames[frameIndex];
}

function compileForLevel(source: string, level: LevelDefinition) {
  return compileScript(source, level);
}

export function LevelScreen(): JSX.Element {
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const scriptText = useGameStore((state) => state.scriptText);
  const compileErrors = useGameStore((state) => state.compileErrors);
  const selectedDeviceId = useGameStore((state) => state.selectedDeviceId);

  const goToMainMenu = useGameStore((state) => state.goToMainMenu);
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);
  const startLevel = useGameStore((state) => state.startLevel);
  const updateScript = useGameStore((state) => state.updateScript);
  const compileCurrentScript = useGameStore((state) => state.compileCurrentScript);
  const resetScript = useGameStore((state) => state.resetScript);
  const selectDevice = useGameStore((state) => state.selectDevice);
  const completeCurrentLevel = useGameStore((state) => state.completeCurrentLevel);

  const level = getLevel(currentLevelId);

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<SimulationSnapshot | null>(null);
  const [frameEvents, setFrameEvents] = useState<EventRecord[]>([]);
  const [playerFailed, setPlayerFailed] = useState(false);
  const [activeCommands, setActiveCommands] = useState<CompiledCommand[]>([]);

  const pathRef = useRef<Point[]>([]);
  const snapshotRef = useRef<SimulationSnapshot | null>(null);
  const commandsRef = useRef<CompiledCommand[]>([]);
  const queuedMoveRef = useRef<{ dx: number; dy: number } | null>(null);
  const transitioningRef = useRef(false);

  const levelIndex = level ? levels.findIndex((entry) => entry.id === level.id) : -1;
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;

  const terminalDevice = useMemo(() => {
    return level?.devices.find((device) => device.type === 'terminal') ?? null;
  }, [level]);

  const playerPos = currentSnapshot?.player ?? (level ? level.entry : null);
  const playerNearTerminal = Boolean(
    terminalDevice &&
      playerPos &&
      Math.abs(playerPos.x - terminalDevice.x) + Math.abs(playerPos.y - terminalDevice.y) <= 1,
  );

  useEffect(() => {
    if (!level) {
      return;
    }

    transitioningRef.current = false;
    queuedMoveRef.current = null;
    setTerminalOpen(false);
    setPlayerFailed(false);

    const initialPath = [{ ...level.entry }];
    pathRef.current = initialPath;

    const compiled = compileForLevel(scriptText, level);
    const commands = compiled.errors.length ? [] : compiled.commands;
    commandsRef.current = commands;
    setActiveCommands(commands);

    const frame = computeFrame(level, initialPath, commands);
    snapshotRef.current = frame.snapshot;
    setCurrentSnapshot(frame.snapshot);
    setFrameEvents(frame.events);
  }, [currentLevelId, level]);

  useEffect(() => {
    if (!level) {
      return;
    }

    const movementByKey: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -1 },
      a: { dx: -1, dy: 0 },
      s: { dx: 0, dy: 1 },
      d: { dx: 1, dy: 0 },
      arrowup: { dx: 0, dy: -1 },
      arrowleft: { dx: -1, dy: 0 },
      arrowdown: { dx: 0, dy: 1 },
      arrowright: { dx: 1, dy: 0 },
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'e') {
        if (!playerFailed && playerNearTerminal) {
          event.preventDefault();
          setTerminalOpen(true);
        }
        return;
      }

      if (terminalOpen || playerFailed || transitioningRef.current) {
        return;
      }

      const delta = movementByKey[key];
      if (!delta) {
        return;
      }

      event.preventDefault();
      queuedMoveRef.current = delta;
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [level, playerFailed, playerNearTerminal, terminalOpen]);

  useEffect(() => {
    if (!level) {
      return;
    }

    const id = window.setInterval(() => {
      if (terminalOpen || playerFailed || transitioningRef.current) {
        return;
      }

      const currentPath = pathRef.current;
      const currentPos = currentPath[currentPath.length - 1] ?? level.entry;
      const nextDelta = queuedMoveRef.current;
      queuedMoveRef.current = null;

      let nextPos = currentPos;
      if (nextDelta) {
        const candidate = { x: currentPos.x + nextDelta.dx, y: currentPos.y + nextDelta.dy };
        if (isWalkable(level, snapshotRef.current, candidate.x, candidate.y)) {
          nextPos = candidate;
        }
      }

      const nextPath = [...currentPath, nextPos];
      pathRef.current = nextPath;

      const frame = computeFrame(level, nextPath, commandsRef.current);
      snapshotRef.current = frame.snapshot;
      setCurrentSnapshot(frame.snapshot);
      setFrameEvents(frame.events);

      if (!frame.snapshot.player.alive) {
        setPlayerFailed(true);
        return;
      }

      if (frame.snapshot.player.reachedExit && !transitioningRef.current) {
        transitioningRef.current = true;
        completeCurrentLevel();
        if (nextLevel) {
          startLevel(nextLevel.id);
        } else {
          openLevelSelect();
        }
      }
    }, 260);

    return () => window.clearInterval(id);
  }, [level, terminalOpen, playerFailed, completeCurrentLevel, nextLevel, openLevelSelect, startLevel]);

  const runFromTerminal = () => {
    if (!level) {
      return;
    }

    const ok = compileCurrentScript();
    if (!ok) {
      return;
    }

    const compiled = compileForLevel(scriptText, level);
    if (compiled.errors.length) {
      return;
    }

    commandsRef.current = compiled.commands;
    setActiveCommands(compiled.commands);
    setTerminalOpen(false);

    const frame = computeFrame(level, pathRef.current, compiled.commands);
    snapshotRef.current = frame.snapshot;
    setCurrentSnapshot(frame.snapshot);
    setFrameEvents(frame.events);
  };

  const resetEncounter = () => {
    if (!level) {
      return;
    }

    transitioningRef.current = false;
    queuedMoveRef.current = null;
    setTerminalOpen(false);
    setPlayerFailed(false);

    const initialPath = [{ ...level.entry }];
    pathRef.current = initialPath;

    const compiled = compileForLevel(scriptText, level);
    const commands = compiled.errors.length ? [] : compiled.commands;
    commandsRef.current = commands;
    setActiveCommands(commands);

    const frame = computeFrame(level, initialPath, commands);
    snapshotRef.current = frame.snapshot;
    setCurrentSnapshot(frame.snapshot);
    setFrameEvents(frame.events);
  };

  if (!currentLevelId || !level) {
    return (
      <div className="level-screen-empty">
        <p>No level selected.</p>
        <button className="btn btn-primary" onClick={openLevelSelect}>
          Open Level Select
        </button>
      </div>
    );
  }

  const terminalVariant = activeCommands.some((command) => command.kind === 'turret.setAim')
    || level.devices.some((device) => device.type === 'turret')
    ? 'turretAim'
    : 'default';

  return (
    <div className="level-screen">
      <header className="level-header">
        <div>
          <h2>{level.name}</h2>
          <div className="muted">Map Mode</div>
        </div>

        <div className="level-header__actions">
          <button className="btn" onClick={openLevelSelect}>
            Mission Board
          </button>
          <button className="btn" onClick={goToMainMenu}>
            Main Menu
          </button>
        </div>
      </header>

      <div className="map-mode-layout">
        <MapPanel
          level={level}
          snapshot={currentSnapshot}
          frameEvents={frameEvents}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={selectDevice}
          overlay={
            <>
              <div className="map-float-move-help" aria-hidden>
                <div className="map-float-move-arrows">
                  <span className="map-float-move-empty" />
                  <span>↑</span>
                  <span className="map-float-move-empty" />
                  <span>←</span>
                  <span>↓</span>
                  <span>→</span>
                </div>
                <div>Move: WASD / Arrows</div>
              </div>

              {!terminalOpen && !playerFailed && playerNearTerminal ? (
                <div className="map-float-terminal-prompt">
                  Press <code>E</code> to access terminal
                </div>
              ) : null}

              {!terminalOpen && playerFailed ? (
                <div className="map-float-terminal-prompt map-float-terminal-prompt--danger">
                  Eliminated. Press Replay to reset.
                </div>
              ) : null}

              <button className="btn map-float-replay" onClick={resetEncounter}>
                Replay
              </button>
            </>
          }
        />
      </div>

      {terminalOpen ? (
        <div className="terminal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="terminal-modal">
            <TerminalPanel
              source={scriptText}
              errors={compileErrors}
              onChange={updateScript}
              onCompile={compileCurrentScript}
              onReplay={runFromTerminal}
              onResetScript={resetScript}
              variant={terminalVariant}
              onExitTerminal={() => setTerminalOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
