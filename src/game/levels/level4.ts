import type { LevelDefinition, Point } from '../models/types';

function createShutdownWalls(): Point[] {
  const walls: Point[] = [];
  const width = 24;
  const height = 13;

  for (let x = 0; x < width; x += 1) {
    walls.push({ x, y: 0 });
    walls.push({ x, y: height - 1 });
  }

  for (let y = 1; y < height - 1; y += 1) {
    walls.push({ x: 0, y });
    walls.push({ x: width - 1, y });
  }

  return walls;
}

export const level4: LevelDefinition = {
  id: 'level4',
  name: 'L4: Generator Shutdown',
  brief: 'Force the generator unstable to drop power across the defense grid.',
  uiVariant: 'turretAim',
  map: {
    width: 24,
    height: 13,
    walls: createShutdownWalls(),
  },
  entry: { x: 2, y: 10 },
  exit: { x: 21, y: 10 },
  playerPath: [
    { x: 2, y: 10 },
    { x: 3, y: 10 },
    { x: 4, y: 10 },
    { x: 5, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 10 },
    { x: 7, y: 10 },
    { x: 8, y: 10 },
    { x: 9, y: 10 },
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 13, y: 10 },
    { x: 14, y: 10 },
    { x: 15, y: 10 },
    { x: 16, y: 10 },
    { x: 17, y: 10 },
    { x: 18, y: 10 },
    { x: 19, y: 10 },
    { x: 20, y: 10 },
    { x: 21, y: 10 },
  ],
  devices: [
    {
      id: 'SEC_T1',
      type: 'turret',
      x: 12,
      y: 8,
      enabled: true,
      range: 7,
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
      id: 'SEC_T2',
      type: 'turret',
      x: 17,
      y: 8,
      enabled: true,
      range: 6,
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
      id: 'PATROL_1',
      type: 'drone',
      x: 11,
      y: 10,
      enabled: true,
      alive: true,
      path: [
        { x: 11, y: 10 },
        { x: 12, y: 10 },
        { x: 13, y: 10 },
        { x: 12, y: 10 },
      ],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'PATROL_2',
      type: 'drone',
      x: 16,
      y: 10,
      enabled: true,
      alive: true,
      path: [
        { x: 16, y: 10 },
        { x: 17, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
    },
    {
      id: 'GEN_CORE',
      type: 'generator',
      x: 6,
      y: 9,
      enabled: true,
      isOnline: true,
      overloadTicks: 4,
      overloadAtTick: null,
      poweredDeviceIds: ['SEC_T1', 'SEC_T2', 'PATROL_1', 'PATROL_2'],
    },
    {
      id: 'TERM_GEN',
      type: 'terminal',
      x: 6,
      y: 10,
      enabled: true,
    },
  ],
  networkScope: ['GEN_CORE'],
  constraints: {
    tickLimit: 56,
  },
};
