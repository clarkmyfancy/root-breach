import type { LevelDefinition } from '../models/types';
import { level1 } from './level1';
import { level2 } from './level2';

export const levels: LevelDefinition[] = [level1, level2];

export const levelById: Record<string, LevelDefinition> = levels.reduce<Record<string, LevelDefinition>>((acc, level) => {
  acc[level.id] = level;
  return acc;
}, {});
