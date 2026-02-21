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
      id: 'D1',
      type: 'door',
      x: 6,
      y: 4,
      enabled: true,
      isOpen: false,
    },
    {
      id: 'TERM1',
      type: 'terminal',
      x: 1,
      y: 6,
      enabled: true,
    },
  ],
  networkScope: ['D1'],
  constraints: {
    tickLimit: 15,
  },
  suggestedScript: `door("D1").open()`,
};
