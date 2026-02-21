export interface SaveData {
  unlockedLevelIndex: number;
  attemptsByLevel: Record<string, number>;
  completedLevels: Record<string, boolean>;
  bestScripts: Record<string, string>;
  lastScripts: Record<string, string>;
  seenLevel1Walkthrough: boolean;
}

const STORAGE_KEY = 'root_breach_save_v1';

export const defaultSaveData: SaveData = {
  unlockedLevelIndex: 0,
  attemptsByLevel: {},
  completedLevels: {},
  bestScripts: {},
  lastScripts: {},
  seenLevel1Walkthrough: false,
};

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultSaveData };
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...defaultSaveData,
      ...parsed,
      attemptsByLevel: parsed.attemptsByLevel ?? {},
      completedLevels: parsed.completedLevels ?? {},
      bestScripts: parsed.bestScripts ?? {},
      lastScripts: parsed.lastScripts ?? {},
      seenLevel1Walkthrough: Boolean(parsed.seenLevel1Walkthrough),
    };
  } catch {
    return { ...defaultSaveData };
  }
}

export function persistSaveData(data: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
