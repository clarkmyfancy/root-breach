import type { LevelDefinition } from '../models/types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';

export const levels: LevelDefinition[] = [level1, level2, level3, level4];

export const levelById: Record<string, LevelDefinition> = levels.reduce<Record<string, LevelDefinition>>((acc, level) => {
  acc[level.id] = level;
  return acc;
}, {});
