import type { LevelDefinition } from '../game/models/types';
import type { SaveData } from '../persistence/saveGame';

function countScriptCommands(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#')).length;
}

export function withAttemptAndScript(save: SaveData, levelId: string, script: string): SaveData {
  return {
    ...save,
    attemptsByLevel: {
      ...save.attemptsByLevel,
      [levelId]: (save.attemptsByLevel[levelId] ?? 0) + 1,
    },
    lastScripts: {
      ...save.lastScripts,
      [levelId]: script,
    },
  };
}

export function withScript(save: SaveData, levelId: string, script: string): SaveData {
  return {
    ...save,
    lastScripts: {
      ...save.lastScripts,
      [levelId]: script,
    },
  };
}

export function withLevelCompletion(
  save: SaveData,
  levels: LevelDefinition[],
  currentLevelId: string,
  currentScript: string,
): SaveData {
  const levelIndex = levels.findIndex((entry) => entry.id === currentLevelId);
  const nextUnlockedIndex = Math.max(save.unlockedLevelIndex, Math.min(levels.length - 1, levelIndex + 1));

  const existingBest = save.bestScripts[currentLevelId];
  const currentCmdCount = countScriptCommands(currentScript);
  const bestCmdCount = existingBest ? countScriptCommands(existingBest) : Number.POSITIVE_INFINITY;
  const shouldUpdateBest = !existingBest || currentCmdCount <= bestCmdCount;

  return {
    ...save,
    unlockedLevelIndex: nextUnlockedIndex,
    completedLevels: {
      ...save.completedLevels,
      [currentLevelId]: true,
    },
    bestScripts: shouldUpdateBest
      ? {
          ...save.bestScripts,
          [currentLevelId]: currentScript,
        }
      : save.bestScripts,
  };
}

export function withSeenLevel1Walkthrough(save: SaveData): SaveData {
  if (save.seenLevel1Walkthrough) {
    return save;
  }
  return {
    ...save,
    seenLevel1Walkthrough: true,
  };
}
