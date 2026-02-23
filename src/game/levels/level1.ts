import type { LevelDefinition, Point } from '../models/types';

function createArenaWalls(): Point[] {
  const walls: Point[] = [];
  const left = 2;
  const right = 16;
  const top = 2;
  const bottom = 10;
  const topExitX = 14;

  for (let x = left; x <= right; x += 1) {
    if (x !== topExitX) {
      walls.push({ x, y: top });
    }
    if (x < 8 || x > 9) {
      walls.push({ x, y: bottom });
    }
  }

  for (let y = top + 1; y < bottom; y += 1) {
    walls.push({ x: left, y });
    walls.push({ x: right, y });
  }

  return walls;
}

export const level1: LevelDefinition = {
  id: 'level1',
  name: 'L1: Turret Aim Terminal',
  brief: 'Move manually with WASD. Use terminal code to set turret aim.',
  uiVariant: 'turretAim',
  map: {
    width: 19,
    height: 13,
    walls: createArenaWalls(),
  },
  entry: { x: 8, y: 11 },
  exit: { x: 15, y: 9 },
  // Replay should never move the player automatically in this mode.
  playerPath: [{ x: 8, y: 11 }],
  devices: [
    {
      id: 'T1',
      type: 'turret',
      x: 11,
      y: 10,
      enabled: true,
      range: 9,
      lockDelay: 1,
      alarmTrigger: 'ALWAYS',
      desiredTargetId: null,
      currentTargetId: null,
      lockTicks: 0,
      manualAimX: null,
      manualAimY: null,
      manualAimXExpr: null,
      manualAimYExpr: null,
    },
    {
      id: 'G1',
      type: 'drone',
      x: 6,
      y: 6,
      enabled: true,
      alive: true,
      path: [{ x: 6, y: 6 }],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'G2',
      type: 'drone',
      x: 7,
      y: 5,
      enabled: true,
      alive: true,
      path: [{ x: 7, y: 5 }],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'G3',
      type: 'drone',
      x: 10,
      y: 5,
      enabled: true,
      alive: true,
      path: [{ x: 10, y: 5 }],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'G4',
      type: 'drone',
      x: 12,
      y: 5,
      enabled: true,
      alive: true,
      path: [{ x: 12, y: 5 }],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'G5',
      type: 'drone',
      x: 14,
      y: 6,
      enabled: true,
      alive: true,
      path: [{ x: 14, y: 6 }],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'TERM1',
      type: 'terminal',
      x: 11,
      y: 11,
      enabled: true,
    },
    {
      id: 'NEXT_DOOR',
      type: 'door',
      x: 14,
      y: 2,
      enabled: true,
      isOpen: false,
    },
  ],
  networkScope: ['T1'],
  constraints: {
    tickLimit: 40,
  },
};
