import type { LevelDefinition } from '../models/types';
import { horizontalPath } from './helpers';

export const level2: LevelDefinition = {
  id: 'level2',
  name: 'L2: Alarm Window',
  brief: 'Alarm lockdown closes the route. Delay escalation long enough to slip through.',
  map: {
    width: 13,
    height: 8,
    walls: [],
  },
  entry: { x: 1, y: 4 },
  exit: { x: 11, y: 4 },
  playerPath: horizontalPath(4, 1, 11),
  devices: [
    {
      id: 'C2',
      type: 'camera',
      x: 3,
      y: 1,
      enabled: true,
      range: 6,
      facing: 'down',
      disabledUntilTick: null,
    },
    {
      id: 'D2',
      type: 'door',
      x: 9,
      y: 4,
      enabled: true,
      isOpen: true,
      closesOnAlarmRed: true,
    },
    {
      id: 'A2',
      type: 'alarm',
      x: 0,
      y: 0,
      enabled: true,
      state: 'GREEN',
      baseEscalationTicks: 4,
      redAtTick: null,
      manualDelayBuffer: 0,
    },
    {
      id: 'TERM2',
      type: 'terminal',
      x: 1,
      y: 6,
      enabled: true,
    },
  ],
  networkScope: ['A2'],
  constraints: {
    maxLines: 2,
    maxCommands: 2,
    maxDelayTicks: 30,
    tickLimit: 120,
  },
  rewardCredits: 110,
  suggestedScript: `alarm().delay(12)`,
};
