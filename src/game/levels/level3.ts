import type { LevelDefinition, Point } from '../models/types';

function createAlarmTrapWalls(): Point[] {
  const walls: Point[] = [];
  const width = 20;
  const height = 12;

  for (let x = 0; x < width; x += 1) {
    walls.push({ x, y: 0 });
    walls.push({ x, y: height - 1 });
  }

  for (let y = 1; y < height - 1; y += 1) {
    walls.push({ x: 0, y });
    walls.push({ x: width - 1, y });
  }

  for (let x = 8; x <= 12; x += 1) {
    walls.push({ x, y: 4 });
    if (x !== 10) {
      walls.push({ x, y: 7 });
    }
  }

  for (let y = 5; y <= 6; y += 1) {
    walls.push({ x: 8, y });
    walls.push({ x: 12, y });
  }

  return walls;
}

export const level3: LevelDefinition = {
  id: 'level3',
  name: 'L3: Alarm Trap',
  brief: 'Trip a side-room alarm to lure guards, then lock the room and cross safely.',
  uiVariant: 'turretAim',
  map: {
    width: 20,
    height: 12,
    walls: createAlarmTrapWalls(),
  },
  entry: { x: 1, y: 8 },
  exit: { x: 18, y: 8 },
  playerPath: [
    { x: 1, y: 8 },
    { x: 2, y: 8 },
    { x: 3, y: 8 },
    { x: 3, y: 8 },
    { x: 3, y: 8 },
    { x: 4, y: 8 },
    { x: 5, y: 8 },
    { x: 6, y: 8 },
    { x: 7, y: 8 },
    { x: 8, y: 8 },
    { x: 9, y: 8 },
    { x: 10, y: 8 },
    { x: 11, y: 8 },
    { x: 12, y: 8 },
    { x: 13, y: 8 },
    { x: 14, y: 8 },
    { x: 15, y: 8 },
    { x: 16, y: 8 },
    { x: 17, y: 8 },
    { x: 18, y: 8 },
  ],
  devices: [
    {
      id: 'G1',
      type: 'guard',
      x: 9,
      y: 8,
      enabled: true,
      alive: true,
      path: [
        { x: 9, y: 8 },
        { x: 10, y: 8 },
        { x: 11, y: 8 },
        { x: 12, y: 8 },
        { x: 13, y: 8 },
        { x: 13, y: 7 },
        { x: 13, y: 6 },
        { x: 13, y: 7 },
        { x: 13, y: 8 },
        { x: 12, y: 8 },
        { x: 11, y: 8 },
        { x: 10, y: 8 },
      ],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
      facing: 'right',
      visionRange: 4,
      investigateAlarmId: 'SIDE_ALARM',
    },
    {
      id: 'G2',
      type: 'guard',
      x: 11,
      y: 8,
      enabled: true,
      alive: true,
      path: [
        { x: 11, y: 8 },
        { x: 10, y: 8 },
        { x: 9, y: 8 },
        { x: 8, y: 8 },
        { x: 7, y: 8 },
        { x: 7, y: 7 },
        { x: 7, y: 6 },
        { x: 7, y: 7 },
        { x: 7, y: 8 },
        { x: 8, y: 8 },
        { x: 9, y: 8 },
        { x: 10, y: 8 },
      ],
      pathIndex: 0,
      stepInterval: 1,
      stepTimer: 0,
      facing: 'left',
      visionRange: 4,
      investigateAlarmId: 'SIDE_ALARM',
    },
    {
      id: 'SIDE_ALARM',
      type: 'alarm',
      x: 10,
      y: 5,
      enabled: true,
      state: 'GREEN',
      baseEscalationTicks: 6,
      redAtTick: null,
      manualDelayBuffer: 0,
      scriptTriggerDuration: 4,
      scriptedResetAtTick: null,
    },
    {
      id: 'SIDE_ROOM_DOOR',
      type: 'door',
      x: 10,
      y: 7,
      enabled: true,
      isOpen: true,
    },
    {
      id: 'TERM_TRAP',
      type: 'terminal',
      x: 3,
      y: 9,
      enabled: true,
    },
  ],
  networkScope: ['SIDE_ALARM', 'SIDE_ROOM_DOOR'],
  constraints: {
    tickLimit: 42,
  },
};
