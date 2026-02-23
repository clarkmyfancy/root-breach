import { useEffect, useMemo, useRef, useState } from 'react';
import { compileScript } from '../../game/compiler/compile';
import type { LevelDefinition } from '../../game/models/types';
import { levelById, levels } from '../../game/levels';
import { FailureSummaryPanel } from '../panels/FailureSummaryPanel';
import { InspectorPanel } from '../panels/InspectorPanel';
import { MapPanel } from '../panels/MapPanel';
import { ReplayControls } from '../panels/ReplayControls';
import { TerminalPanel } from '../panels/TerminalPanel';
import { WalkthroughPanel } from '../panels/WalkthroughPanel';
import { useGameStore } from '../../store/useGameStore';

type WalkthroughTarget = 'map' | 'terminalInput' | 'compileButton';

const levelOneWalkthroughSteps: Array<{ title: string; body: string; target: WalkthroughTarget }> = [
  {
    title: 'Read The Map And Core Loop',
    body: 'Your agent auto-runs this route. The loop is: fail, inspect what happened, patch script, replay from tick 0.',
    target: 'map',
  },
  {
    title: 'Write Commands In Terminal',
    body: 'Type commands here to change the level state. For Level 1, start with: door("D1").open()',
    target: 'terminalInput',
  },
  {
    title: 'Compile Before Replay',
    body: 'Use Compile to validate syntax and devices. If there is an error, the line number appears below the terminal.',
    target: 'compileButton',
  },
];

function isWalkable(level: NonNullable<ReturnType<typeof getLevel>>, x: number, y: number, closedDoorTiles: Set<string>): boolean {
  if (x < 0 || y < 0 || x >= level.map.width || y >= level.map.height) {
    return false;
  }

  if (level.map.walls.some((wall) => wall.x === x && wall.y === y)) {
    return false;
  }

  return !closedDoorTiles.has(`${x},${y}`);
}

function getLevel(levelId: string | null) {
  return levelId ? levelById[levelId] ?? null : null;
}

interface ArenaBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface MapGuard {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

type TurretLevel = NonNullable<ReturnType<typeof getLevel>>;
type TurretDevice = Extract<TurretLevel['devices'][number], { type: 'turret' }>;

function getArenaBounds(level: NonNullable<ReturnType<typeof getLevel>>): ArenaBounds | null {
  if (!level.map.walls.length) {
    return null;
  }

  const xs = level.map.walls.map((wall) => wall.x);
  const ys = level.map.walls.map((wall) => wall.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function isInsideArena(level: NonNullable<ReturnType<typeof getLevel>>, x: number, y: number): boolean {
  const bounds = getArenaBounds(level);
  if (!bounds) {
    return false;
  }
  return x > bounds.minX && x < bounds.maxX && y > bounds.minY && y < bounds.maxY;
}

function getInitialGuards(level: NonNullable<ReturnType<typeof getLevel>>): MapGuard[] {
  return level.devices
    .filter((device): device is Extract<(typeof level.devices)[number], { type: 'drone' }> => device.type === 'drone')
    .map((drone) => ({
      id: drone.id,
      x: drone.x,
      y: drone.y,
      alive: drone.alive,
    }));
}

function chooseGuardStep(
  guard: MapGuard,
  player: { x: number; y: number },
  level: NonNullable<ReturnType<typeof getLevel>>,
  closedDoorTiles: Set<string>,
): { x: number; y: number } {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;

  const horizontal = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const vertical = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const prioritizeHorizontal = Math.abs(dx) >= Math.abs(dy);

  const candidates = prioritizeHorizontal
    ? [
        { dx: horizontal, dy: 0 },
        { dx: 0, dy: vertical },
      ]
    : [
        { dx: 0, dy: vertical },
        { dx: horizontal, dy: 0 },
      ];

  for (const candidate of candidates) {
    if (candidate.dx === 0 && candidate.dy === 0) {
      continue;
    }
    const nextX = guard.x + candidate.dx;
    const nextY = guard.y + candidate.dy;
    if (isWalkable(level, nextX, nextY, closedDoorTiles)) {
      return { x: nextX, y: nextY };
    }
  }

  return { x: guard.x, y: guard.y };
}

function createRuntimeAimLevel(
  level: TurretLevel,
  turretDevice: TurretDevice,
  player: { x: number; y: number },
  guards: MapGuard[],
): LevelDefinition {
  const aliveGuards = guards.filter((guard) => guard.alive);
  const nonGuardNonTurretDevices = level.devices.filter((device) => device.type !== 'drone' && device.id !== turretDevice.id);

  return {
    ...level,
    entry: { x: player.x, y: player.y },
    playerPath: [{ x: player.x, y: player.y }],
    devices: [
      { ...turretDevice },
      ...aliveGuards.map((guard) => ({
        id: guard.id,
        type: 'drone' as const,
        x: guard.x,
        y: guard.y,
        enabled: true,
        alive: true,
        path: [{ x: guard.x, y: guard.y }],
        pathIndex: 0,
        stepInterval: 1,
        stepTimer: 0,
      })),
      ...nonGuardNonTurretDevices,
    ],
  };
}

function resolveScriptAimTarget(
  source: string,
  level: TurretLevel,
  turretDevice: TurretDevice,
  player: { x: number; y: number },
  guards: MapGuard[],
): { x: number; y: number } | null {
  const runtimeLevel = createRuntimeAimLevel(level, turretDevice, player, guards);
  const compiled = compileScript(source, runtimeLevel);
  if (compiled.errors.length) {
    return null;
  }

  let latestAim: { x: number; y: number } | null = null;
  for (const command of compiled.commands) {
    if (command.kind !== 'turret.setAim') {
      continue;
    }

    if (command.xValue === undefined || command.yValue === undefined) {
      continue;
    }

    latestAim = {
      x: turretDevice.x + command.xValue,
      y: turretDevice.y + command.yValue,
    };
  }

  if (!latestAim) {
    return null;
  }

  return {
    x: latestAim.x,
    y: latestAim.y,
  };
}

export function LevelScreen(): JSX.Element {
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const replayResult = useGameStore((state) => state.replayResult);
  const frameIndex = useGameStore((state) => state.frameIndex);
  const replayPlaying = useGameStore((state) => state.replayPlaying);
  const replaySpeed = useGameStore((state) => state.replaySpeed);
  const selectedDeviceId = useGameStore((state) => state.selectedDeviceId);
  const failureSummary = useGameStore((state) => state.failureSummary);
  const scriptText = useGameStore((state) => state.scriptText);
  const compileErrors = useGameStore((state) => state.compileErrors);
  const walkthroughActive = useGameStore((state) => state.walkthroughActive);
  const walkthroughStep = useGameStore((state) => state.walkthroughStep);

  const goToMainMenu = useGameStore((state) => state.goToMainMenu);
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);
  const openHack = useGameStore((state) => state.openHack);
  const updateScript = useGameStore((state) => state.updateScript);
  const compileCurrentScript = useGameStore((state) => state.compileCurrentScript);
  const runReplay = useGameStore((state) => state.runReplay);
  const resetScript = useGameStore((state) => state.resetScript);
  const toggleReplayPlaying = useGameStore((state) => state.toggleReplayPlaying);
  const resetReplay = useGameStore((state) => state.resetReplay);
  const setReplaySpeed = useGameStore((state) => state.setReplaySpeed);
  const startLevel = useGameStore((state) => state.startLevel);
  const selectDevice = useGameStore((state) => state.selectDevice);
  const nextWalkthroughStep = useGameStore((state) => state.nextWalkthroughStep);
  const prevWalkthroughStep = useGameStore((state) => state.prevWalkthroughStep);
  const dismissWalkthrough = useGameStore((state) => state.dismissWalkthrough);
  const completeCurrentLevel = useGameStore((state) => state.completeCurrentLevel);

  useEffect(() => {
    if (!replayPlaying) {
      return;
    }

    const id = window.setInterval(() => {
      useGameStore.getState().advanceReplay();
    }, 100);

    return () => window.clearInterval(id);
  }, [replayPlaying, replaySpeed]);

  const level = getLevel(currentLevelId);
  const currentFrame = replayResult?.frames[Math.min(frameIndex, Math.max(0, (replayResult?.frames.length ?? 1) - 1))] ?? null;
  const isTurretAimLevel = level?.uiVariant === 'turretAim';
  const levelIndex = level ? levels.findIndex((entry) => entry.id === level.id) : -1;
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;
  const exitDoorDevice =
    level?.devices.find(
      (device): device is Extract<(typeof level.devices)[number], { type: 'door' }> =>
        device.type === 'door' && device.id === 'NEXT_DOOR',
    ) ??
    level?.devices.find(
      (device): device is Extract<(typeof level.devices)[number], { type: 'door' }> => device.type === 'door',
    ) ??
    null;

  const [terminalAccessed, setTerminalAccessed] = useState(true);
  const [mapPlayerPos, setMapPlayerPos] = useState<{ x: number; y: number } | null>(null);
  const [mapPlayerAlive, setMapPlayerAlive] = useState(true);
  const [mapGuards, setMapGuards] = useState<MapGuard[]>([]);
  const [arenaActive, setArenaActive] = useState(false);
  const [turretCharge, setTurretCharge] = useState(0);
  const [turretAimPreview, setTurretAimPreview] = useState<{ x: number; y: number } | null>(null);
  const [mapExitDoorOpen, setMapExitDoorOpen] = useState(false);
  const mapEncounterMode = isTurretAimLevel && phase === 'hack' && !terminalAccessed;

  useEffect(() => {
    setTerminalAccessed(!isTurretAimLevel);
  }, [currentLevelId, isTurretAimLevel]);

  useEffect(() => {
    if (!isTurretAimLevel || !level) {
      setMapPlayerPos(null);
      setMapPlayerAlive(true);
      setMapGuards([]);
      setArenaActive(false);
      setTurretCharge(0);
      setTurretAimPreview(null);
      setMapExitDoorOpen(false);
      mapPlayerPosRef.current = null;
      mapPlayerAliveRef.current = true;
      mapGuardsRef.current = [];
      return;
    }
    const startPos = { x: level.entry.x, y: level.entry.y };
    setMapPlayerPos(startPos);
    setMapPlayerAlive(true);
    const initialGuards = getInitialGuards(level);
    setMapGuards(initialGuards);
    setArenaActive(false);
    setTurretCharge(0);
    setTurretAimPreview(null);
    setMapExitDoorOpen(false);
    mapPlayerPosRef.current = startPos;
    mapPlayerAliveRef.current = true;
    mapGuardsRef.current = initialGuards;
    turretLockRef.current = 0;
    turretTargetRef.current = null;
  }, [currentLevelId, isTurretAimLevel, level]);

  const closedDoorTiles = useMemo(() => {
    const tiles = new Set<string>();
    if (!currentFrame) {
      return tiles;
    }
    Object.values(currentFrame.snapshot.devices).forEach((device) => {
      if (device.type === 'door' && !device.isOpen) {
        if (mapEncounterMode && mapExitDoorOpen && exitDoorDevice && device.id === exitDoorDevice.id) {
          return;
        }
        tiles.add(`${device.x},${device.y}`);
      }
    });
    return tiles;
  }, [currentFrame, mapEncounterMode, mapExitDoorOpen, exitDoorDevice]);

  const mapPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
  const mapPlayerAliveRef = useRef(true);
  const mapGuardsRef = useRef<MapGuard[]>([]);
  const turretLockRef = useRef(0);
  const turretTargetRef = useRef<string | null>(null);
  useEffect(() => {
    mapPlayerPosRef.current = mapPlayerPos;
  }, [mapPlayerPos]);
  useEffect(() => {
    mapPlayerAliveRef.current = mapPlayerAlive;
  }, [mapPlayerAlive]);
  useEffect(() => {
    mapGuardsRef.current = mapGuards;
  }, [mapGuards]);

  const turretDevice =
    level?.devices.find(
      (device): device is Extract<(typeof level.devices)[number], { type: 'turret' }> => device.type === 'turret',
    ) ?? null;

  const terminalDevice = level?.devices.find((device) => device.type === 'terminal') ?? null;
  const activePlayerPos = mapEncounterMode
    ? mapPlayerPos ?? (level ? level.entry : null)
    : currentFrame?.snapshot.player ?? (level ? level.entry : null);

  const playerNearTerminal = Boolean(
    terminalDevice &&
      activePlayerPos &&
      Math.abs(activePlayerPos.x - terminalDevice.x) + Math.abs(activePlayerPos.y - terminalDevice.y) <= 1,
  );

  const mapModeSnapshot = useMemo(() => {
    if (!currentFrame || !level || !isTurretAimLevel) {
      return currentFrame?.snapshot ?? null;
    }

    if (!mapEncounterMode) {
      return currentFrame.snapshot;
    }

    const devices = { ...currentFrame.snapshot.devices };

    for (const guard of mapGuards) {
      const existing = devices[guard.id];
      if (!existing || existing.type !== 'drone') {
        continue;
      }
      devices[guard.id] = {
        ...existing,
        x: guard.x,
        y: guard.y,
        alive: guard.alive,
        enabled: guard.alive,
      };
    }

    if (turretDevice) {
      const turret = devices[turretDevice.id];
      if (turret && turret.type === 'turret') {
        devices[turret.id] = {
          ...turret,
          currentTargetId: turretAimPreview ? `coord:${turretAimPreview.x},${turretAimPreview.y}` : null,
        };
      }
    }

    if (exitDoorDevice) {
      const exitDoor = devices[exitDoorDevice.id];
      if (exitDoor && exitDoor.type === 'door') {
        devices[exitDoor.id] = {
          ...exitDoor,
          isOpen: mapExitDoorOpen,
        };
      }
    }

    return {
      ...currentFrame.snapshot,
      player: {
        ...currentFrame.snapshot.player,
        x: activePlayerPos?.x ?? level.entry.x,
        y: activePlayerPos?.y ?? level.entry.y,
        alive: mapPlayerAlive,
      },
      devices,
    };
  }, [
    currentFrame,
    level,
    isTurretAimLevel,
    mapEncounterMode,
    mapGuards,
    turretDevice,
    turretAimPreview,
    exitDoorDevice,
    mapExitDoorOpen,
    activePlayerPos,
    mapPlayerAlive,
  ]);

  const resetMapEncounter = () => {
    if (!level) {
      return;
    }
    openHack();
    resetReplay();
    const startPos = { x: level.entry.x, y: level.entry.y };
    setMapPlayerPos(startPos);
    mapPlayerPosRef.current = startPos;
    setMapPlayerAlive(true);
    mapPlayerAliveRef.current = true;
    const initialGuards = getInitialGuards(level);
    setMapGuards(initialGuards);
    mapGuardsRef.current = initialGuards;
    setArenaActive(false);
    setTurretCharge(0);
    setTurretAimPreview(null);
    setMapExitDoorOpen(false);
    turretLockRef.current = 0;
    turretTargetRef.current = null;
    setTerminalAccessed(false);
  };

  const runFromTerminalMode = () => {
    runReplay();
    openHack();
    setTerminalAccessed(false);
  };

  useEffect(() => {
    if (!mapEncounterMode) {
      return;
    }

    if (mapGuards.length > 0 && mapGuards.every((guard) => !guard.alive)) {
      setMapExitDoorOpen(true);
    }
  }, [mapEncounterMode, mapGuards]);

  useEffect(() => {
    if (!mapEncounterMode || !level) {
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
        if (playerNearTerminal && mapPlayerAliveRef.current) {
          event.preventDefault();
          setTerminalAccessed(true);
        }
        return;
      }

      const delta = movementByKey[key];
      if (!delta) {
        return;
      }

      if (!mapPlayerAliveRef.current) {
        return;
      }

      event.preventDefault();
      const currentPos = mapPlayerPosRef.current ?? { x: level.entry.x, y: level.entry.y };
      const nextX = currentPos.x + delta.dx;
      const nextY = currentPos.y + delta.dy;

      if (!isWalkable(level, nextX, nextY, closedDoorTiles)) {
        return;
      }

      if (isInsideArena(level, nextX, nextY)) {
        setArenaActive(true);
      }

      if (exitDoorDevice && mapExitDoorOpen && nextX === exitDoorDevice.x && nextY === exitDoorDevice.y) {
        completeCurrentLevel();
        if (nextLevel) {
          startLevel(nextLevel.id);
        } else {
          openLevelSelect();
        }
        return;
      }

      const nextPos = { x: nextX, y: nextY };
      mapPlayerPosRef.current = nextPos;
      setMapPlayerPos(nextPos);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mapEncounterMode,
    level,
    playerNearTerminal,
    closedDoorTiles,
    exitDoorDevice,
    mapExitDoorOpen,
    completeCurrentLevel,
    nextLevel,
    startLevel,
    openLevelSelect,
  ]);

  useEffect(() => {
    if (!mapEncounterMode || !arenaActive || !level || !turretDevice || !mapPlayerAliveRef.current) {
      return;
    }

    const id = window.setInterval(() => {
      const player = mapPlayerPosRef.current;
      if (!player || !mapPlayerAliveRef.current) {
        return;
      }

      const currentGuards = mapGuardsRef.current;
      const occupied = new Set(currentGuards.filter((guard) => guard.alive).map((guard) => `${guard.x},${guard.y}`));
      let killedByGuard = false;

      const movedGuards = currentGuards.map((guard) => {
        if (!guard.alive) {
          return guard;
        }

        occupied.delete(`${guard.x},${guard.y}`);
        const candidate = chooseGuardStep(guard, player, level, closedDoorTiles);
        const blockedByOtherGuard = occupied.has(`${candidate.x},${candidate.y}`);
        const nextX = blockedByOtherGuard ? guard.x : candidate.x;
        const nextY = blockedByOtherGuard ? guard.y : candidate.y;
        occupied.add(`${nextX},${nextY}`);

        if (nextX === player.x && nextY === player.y) {
          killedByGuard = true;
        }

        return {
          ...guard,
          x: nextX,
          y: nextY,
        };
      });

      mapGuardsRef.current = movedGuards;
      setMapGuards(movedGuards);

      if (killedByGuard) {
        mapPlayerAliveRef.current = false;
        setMapPlayerAlive(false);
        setTurretAimPreview(null);
        turretLockRef.current = 0;
        turretTargetRef.current = null;
        return;
      }

      const aimTarget = resolveScriptAimTarget(scriptText, level, turretDevice, player, movedGuards);
      if (!aimTarget) {
        turretLockRef.current = 0;
        turretTargetRef.current = null;
        setTurretCharge(0);
        setTurretAimPreview(null);
        return;
      }

      const inTurretRange = Math.abs(aimTarget.x - turretDevice.x) + Math.abs(aimTarget.y - turretDevice.y) <= turretDevice.range;
      if (!inTurretRange) {
        turretLockRef.current = 0;
        turretTargetRef.current = null;
        setTurretCharge(0);
        setTurretAimPreview(null);
        return;
      }

      const targetKey = `${aimTarget.x},${aimTarget.y}`;
      if (turretTargetRef.current !== targetKey) {
        turretTargetRef.current = targetKey;
        turretLockRef.current = 1;
      } else {
        turretLockRef.current += 1;
      }

      setTurretAimPreview({ x: aimTarget.x, y: aimTarget.y });
      setTurretCharge(turretLockRef.current);

      if (turretLockRef.current < Math.max(1, turretDevice.lockDelay)) {
        return;
      }

      if (player.x === aimTarget.x && player.y === aimTarget.y) {
        mapPlayerAliveRef.current = false;
        setMapPlayerAlive(false);
      }

      const postShotGuards = movedGuards.map((guard) =>
        guard.alive && guard.x === aimTarget.x && guard.y === aimTarget.y ? { ...guard, alive: false } : guard,
      );
      mapGuardsRef.current = postShotGuards;
      setMapGuards(postShotGuards);

      turretLockRef.current = 0;
      setTurretCharge(0);
    }, 320);

    return () => window.clearInterval(id);
  }, [mapEncounterMode, arenaActive, level, turretDevice, closedDoorTiles, scriptText]);

  useEffect(() => {
    if (!isTurretAimLevel || !terminalAccessed) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setTerminalAccessed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTurretAimLevel, terminalAccessed]);

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

  const selectedDevice = selectedDeviceId && currentFrame ? currentFrame.snapshot.devices[selectedDeviceId] ?? null : null;
  const walkthroughStepData =
    walkthroughActive && level.id === 'level1' ? levelOneWalkthroughSteps[walkthroughStep] : null;
  const walkthroughPosition =
    walkthroughStepData?.target === 'map'
      ? 'map'
      : walkthroughStepData?.target === 'terminalInput'
        ? 'terminal'
        : 'compile';

  if (isTurretAimLevel) {
    return (
      <div className="level-screen">
        <header className="level-header">
          <div>
            <h2>{level.name}</h2>
            <div className="muted">Phase: {phase}</div>
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
            snapshot={mapModeSnapshot}
            frameEvents={[]}
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

                {!terminalAccessed && arenaActive && mapPlayerAlive ? (
                  <div className="map-float-lock">
                    Turret lock: {turretCharge}/{Math.max(1, turretDevice?.lockDelay ?? 1)}
                  </div>
                ) : null}

                {!terminalAccessed && mapPlayerAlive && playerNearTerminal ? (
                  <div className="map-float-terminal-prompt">
                    Press <code>E</code> to access turret terminal
                  </div>
                ) : null}

                {!terminalAccessed && !mapPlayerAlive ? (
                  <div className="map-float-terminal-prompt map-float-terminal-prompt--danger">
                    Eliminated. Press Replay to reset.
                  </div>
                ) : null}

                <button className="btn map-float-replay" onClick={resetMapEncounter}>
                  Replay
                </button>
              </>
            }
          />

          {phase === 'levelComplete' ? (
            <div className="phase-card">
              <h3>Level Complete</h3>
              <div className="phase-card__actions">
                {nextLevel ? (
                  <button className="btn btn-primary" onClick={() => startLevel(nextLevel.id)}>
                    Next Level
                  </button>
                ) : null}
                <button className="btn" onClick={openLevelSelect}>
                  Back to Board
                </button>
                <button className="btn" onClick={openHack}>
                  Keep Tweaking Script
                </button>
              </div>
            </div>
          ) : null}

        </div>

        {terminalAccessed ? (
          <div className="terminal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="terminal-modal">
              <TerminalPanel
                source={scriptText}
                errors={compileErrors}
                onChange={updateScript}
                onCompile={compileCurrentScript}
                onReplay={runFromTerminalMode}
                onResetScript={resetScript}
                variant="turretAim"
                onExitTerminal={() => setTerminalAccessed(false)}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="level-screen">
      <header className="level-header">
        <div>
          <h2>{level.name}</h2>
          <div className="muted">Phase: {phase}</div>
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

      <div className="level-grid-layout">
        <div className="left-pane">
          <MapPanel
            level={level}
            snapshot={currentFrame?.snapshot ?? null}
            frameEvents={currentFrame?.events ?? []}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={selectDevice}
            highlighted={walkthroughStepData?.target === 'map'}
          />

          <ReplayControls
            playing={replayPlaying}
            speed={replaySpeed}
            onTogglePlay={toggleReplayPlaying}
            onReset={resetReplay}
            onReplay={runReplay}
            onSetSpeed={setReplaySpeed}
          />

          {phase === 'levelComplete' ? (
            <div className="phase-card">
              <h3>Level Complete</h3>
              <div className="phase-card__actions">
                {nextLevel ? (
                  <button className="btn btn-primary" onClick={() => startLevel(nextLevel.id)}>
                    Next Level
                  </button>
                ) : null}
                <button className="btn" onClick={openLevelSelect}>
                  Back to Board
                </button>
                <button className="btn" onClick={openHack}>
                  Keep Tweaking Script
                </button>
              </div>
            </div>
          ) : null}

        </div>

        <div className="right-top-pane">
          <TerminalPanel
            source={scriptText}
            errors={compileErrors}
            onChange={updateScript}
            onCompile={compileCurrentScript}
            onReplay={runReplay}
            onResetScript={resetScript}
            highlightInput={walkthroughStepData?.target === 'terminalInput'}
            highlightCompile={walkthroughStepData?.target === 'compileButton'}
          />
        </div>

        <div className={phase === 'failSummary' ? 'right-bottom-pane right-bottom-pane--fail' : 'right-bottom-pane'}>
          {phase === 'failSummary' ? (
            <FailureSummaryPanel summary={failureSummary} />
          ) : (
            <InspectorPanel device={selectedDevice} />
          )}
        </div>
      </div>

      {walkthroughStepData ? (
        <WalkthroughPanel
          step={walkthroughStep}
          totalSteps={levelOneWalkthroughSteps.length}
          title={walkthroughStepData.title}
          body={walkthroughStepData.body}
          canGoBack={walkthroughStep > 0}
          isLastStep={walkthroughStep >= levelOneWalkthroughSteps.length - 1}
          onBack={prevWalkthroughStep}
          onNext={nextWalkthroughStep}
          onSkip={dismissWalkthrough}
          position={walkthroughPosition}
        />
      ) : null}
    </div>
  );
}
