import type { DroneDevice, LevelDefinition, Point } from '../models/types';

const L2_LEFT_WALL_X = 2;
const L2_RIGHT_WALL_X = 20;
const L2_TOP_WALL_Y = 2;
const L2_BOTTOM_WALL_Y = 12;
const L2_TOP_EXIT_X = 17;
const L2_ENTRY_GATE_LEFT_X = 10;
const L2_ENTRY_GATE_RIGHT_X = 11;
const L2_GUARD_COUNT = 8;

function createArenaWalls(): Point[] {
  const walls: Point[] = [];

  for (let x = L2_LEFT_WALL_X; x <= L2_RIGHT_WALL_X; x += 1) {
    if (x !== L2_TOP_EXIT_X) {
      walls.push({ x, y: L2_TOP_WALL_Y });
    }
    if (x < L2_ENTRY_GATE_LEFT_X || x > L2_ENTRY_GATE_RIGHT_X) {
      walls.push({ x, y: L2_BOTTOM_WALL_Y });
    }
  }

  for (let y = L2_TOP_WALL_Y + 1; y < L2_BOTTOM_WALL_Y; y += 1) {
    walls.push({ x: L2_LEFT_WALL_X, y });
    walls.push({ x: L2_RIGHT_WALL_X, y });
  }

  return walls;
}

function createSeededRng(seed: number): (maxExclusive: number) => number {
  let value = seed >>> 0;
  return (maxExclusive: number) => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value % maxExclusive;
  };
}

function generateGuardPoints(count: number): Point[] {
  const nextInt = createSeededRng(20260223);
  const points: Point[] = [];
  const occupied = new Set<string>(['15,12', '15,13']);
  let attempts = 0;

  while (points.length < count && attempts < 2000) {
    attempts += 1;
    const x = 4 + nextInt(15);
    const y = 4 + nextInt(6);
    const key = `${x},${y}`;

    if (occupied.has(key)) {
      continue;
    }

    if (Math.abs(x - 15) + Math.abs(y - 12) < 4) {
      continue;
    }

    occupied.add(key);
    points.push({ x, y });
  }

  return points;
}

function createGuardDevices(): DroneDevice[] {
  return generateGuardPoints(L2_GUARD_COUNT).map((point, index) => ({
    id: `G${index + 1}`,
    type: 'drone',
    x: point.x,
    y: point.y,
    enabled: true,
    alive: true,
    path: [point],
    pathIndex: 0,
    stepInterval: 1,
    stepTimer: 0,
  }));
}

export const level2: LevelDefinition = {
  id: 'level2',
  name: 'L2: Harder Turret Arena',
  brief: 'More guards, larger arena, same terminal language.',
  uiVariant: 'turretAim',
  map: {
    width: 23,
    height: 15,
    walls: createArenaWalls(),
  },
  entry: { x: 10, y: 13 },
  exit: { x: L2_TOP_EXIT_X, y: 2 },
  playerPath: [{ x: 10, y: 13 }],
  devices: [
    {
      id: 'T1',
      type: 'turret',
      x: 15,
      y: 12,
      enabled: true,
      range: 14,
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
    ...createGuardDevices(),
    {
      id: 'TERM1',
      type: 'terminal',
      x: 15,
      y: 13,
      enabled: true,
    },
    {
      id: 'NEXT_DOOR',
      type: 'door',
      x: L2_TOP_EXIT_X,
      y: L2_TOP_WALL_Y,
      enabled: true,
      isOpen: false,
    },
  ],
  networkScope: ['T1'],
  constraints: {
    tickLimit: 60,
  },
};
