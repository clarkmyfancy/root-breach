import type { LevelDefinition } from '../models/types';
import { horizontalPath } from './helpers';

export const level1: LevelDefinition = {
  id: 'level1',
  name: 'L1: First Breach',
  brief: 'Open the path and avoid early detection.',
  map: {
    width: 12,
    height: 8,
    walls: [],
  },
  entry: { x: 1, y: 4 },
  exit: { x: 10, y: 4 },
  playerPath: horizontalPath(4, 1, 10),
  devices: [
    {
      id: 'C1',
      type: 'camera',
      x: 4,
      y: 1,
      enabled: true,
      range: 5,
      facing: 'down',
      disabledUntilTick: null,
    },
    {
      id: 'D1',
      type: 'door',
      x: 6,
      y: 4,
      enabled: true,
      isOpen: false,
    },
    {
      id: 'A1',
      type: 'alarm',
      x: 0,
      y: 0,
      enabled: true,
      state: 'GREEN',
      baseEscalationTicks: 8,
      redAtTick: null,
      manualDelayBuffer: 0,
    },
    {
      id: 'TERM1',
      type: 'terminal',
      x: 1,
      y: 6,
      enabled: true,
    },
  ],
  networkScope: ['C1', 'D1', 'A1'],
  constraints: {
    maxLines: 4,
    maxCommands: 4,
    maxDelayTicks: 20,
    tickLimit: 120,
  },
  rewardCredits: 100,
  suggestedScript: `camera("C1").disable(20)\ndoor("D1").open()`,
};
