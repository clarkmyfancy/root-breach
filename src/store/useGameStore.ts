import { create } from 'zustand';
import { compileScript } from '../game/compiler/compile';
import type { CompileError } from '../game/compiler/scriptTypes';
import { runSimulation } from '../game/engine/simulationRunner';
import type { FailureSummary, SimulationResult } from '../game/engine/eventTypes';
import { levelById, levels } from '../game/levels';
import type { UpgradeState } from '../game/models/types';
import { defaultSaveData, loadSaveData, persistSaveData, type SaveData } from '../persistence/saveGame';

export type ScreenPhase =
  | 'mainMenu'
  | 'levelSelect'
  | 'runObserve'
  | 'hack'
  | 'replay'
  | 'failSummary'
  | 'levelComplete';

export type ReplaySpeed = 1 | 2 | 4;

export type UpgradeKey = 'maxLines' | 'maxCommands' | 'maxDelay' | 'inspector';

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  description: string;
  cost: number;
}

export const upgradesCatalog: UpgradeDef[] = [
  {
    key: 'maxLines',
    name: '+1 Max Script Line',
    description: 'Increase line cap by 1 for all levels.',
    cost: 120,
  },
  {
    key: 'maxCommands',
    name: '+1 Command Budget',
    description: 'Increase command budget by 1 for all levels.',
    cost: 120,
  },
  {
    key: 'maxDelay',
    name: '+10 Delay Cap',
    description: 'Increase max delay/disable/wait cap by 10 ticks.',
    cost: 140,
  },
  {
    key: 'inspector',
    name: 'Inspector+',
    description: 'Show event categories in the log panel.',
    cost: 180,
  },
];

interface GameStore {
  phase: ScreenPhase;
  currentLevelId: string | null;
  scriptText: string;
  compileErrors: CompileError[];
  replayResult: SimulationResult | null;
  frameIndex: number;
  replayPlaying: boolean;
  replaySpeed: ReplaySpeed;
  selectedDeviceId: string | null;
  failureSummary: FailureSummary | null;
  save: SaveData;
  lastReward: number;
  lastOutcome: 'success' | 'failure' | null;

  goToMainMenu: () => void;
  openLevelSelect: () => void;
  startLevel: (levelId: string) => void;
  openHack: () => void;
  updateScript: (source: string) => void;
  resetScript: () => void;
  compileCurrentScript: () => boolean;
  runReplay: () => void;
  setReplaySpeed: (speed: ReplaySpeed) => void;
  toggleReplayPlaying: () => void;
  resetReplay: () => void;
  advanceReplay: () => void;
  selectDevice: (deviceId: string | null) => void;
  purchaseUpgrade: (key: UpgradeKey) => void;
}

function countScriptCommands(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#')).length;
}

function applyUpgrade(upgrades: UpgradeState, key: UpgradeKey): UpgradeState {
  switch (key) {
    case 'maxLines':
      return { ...upgrades, maxLinesBonus: upgrades.maxLinesBonus + 1 };
    case 'maxCommands':
      return { ...upgrades, maxCommandsBonus: upgrades.maxCommandsBonus + 1 };
    case 'maxDelay':
      return { ...upgrades, maxDelayBonus: upgrades.maxDelayBonus + 10 };
    case 'inspector':
      return { ...upgrades, inspectorPlus: true };
    default:
      return upgrades;
  }
}

function rewardForSuccess(base: number, attempts: number, alreadyCompleted: boolean): number {
  if (alreadyCompleted) {
    return Math.floor(base * 0.4);
  }
  const bonus = Math.max(0, 40 - Math.max(0, attempts - 1) * 5);
  return base + bonus;
}

const initialSave = typeof window !== 'undefined' ? loadSaveData() : defaultSaveData;

function getInitialScript(_levelId: string): string {
  return '';
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'mainMenu',
  currentLevelId: null,
  scriptText: '',
  compileErrors: [],
  replayResult: null,
  frameIndex: 0,
  replayPlaying: false,
  replaySpeed: 1,
  selectedDeviceId: null,
  failureSummary: null,
  save: initialSave,
  lastReward: 0,
  lastOutcome: null,

  goToMainMenu: () => {
    set({
      phase: 'mainMenu',
      replayPlaying: false,
      replayResult: null,
      frameIndex: 0,
      failureSummary: null,
      currentLevelId: null,
      selectedDeviceId: null,
      compileErrors: [],
      lastReward: 0,
      lastOutcome: null,
    });
  },

  openLevelSelect: () => {
    set({ phase: 'levelSelect' });
  },

  startLevel: (levelId: string) => {
    const level = levelById[levelId];
    if (!level) {
      return;
    }

    const saveBefore = get().save;
    const script = getInitialScript(levelId);
    const observeCompiled = compileScript(script, level, saveBefore.upgrades);
    const commands = observeCompiled.errors.length ? [] : observeCompiled.commands;

    const attemptsByLevel = {
      ...saveBefore.attemptsByLevel,
      [levelId]: (saveBefore.attemptsByLevel[levelId] ?? 0) + 1,
    };
    const saveAfter = {
      ...saveBefore,
      attemptsByLevel,
      lastScripts: {
        ...saveBefore.lastScripts,
        [levelId]: script,
      },
    };
    persistSaveData(saveAfter);

    const result = runSimulation(level, commands);
    set({
      phase: 'runObserve',
      currentLevelId: levelId,
      scriptText: script,
      compileErrors: observeCompiled.errors,
      replayResult: result,
      frameIndex: 0,
      replayPlaying: true,
      replaySpeed: 1,
      selectedDeviceId: null,
      failureSummary: result.failureSummary ?? null,
      save: saveAfter,
      lastReward: 0,
      lastOutcome: null,
    });
  },

  openHack: () => {
    set({
      phase: 'hack',
      replayPlaying: false,
    });
  },

  updateScript: (source: string) => {
    const state = get();
    if (!state.currentLevelId) {
      return;
    }

    const nextSave = {
      ...state.save,
      lastScripts: {
        ...state.save.lastScripts,
        [state.currentLevelId]: source,
      },
    };
    persistSaveData(nextSave);

    set({
      scriptText: source,
      save: nextSave,
    });
  },

  resetScript: () => {
    const state = get();
    if (!state.currentLevelId) {
      return;
    }
    const fallback = '';

    const nextSave = {
      ...state.save,
      lastScripts: {
        ...state.save.lastScripts,
        [state.currentLevelId]: fallback,
      },
    };
    persistSaveData(nextSave);

    set({
      scriptText: fallback,
      compileErrors: [],
      save: nextSave,
    });
  },

  compileCurrentScript: () => {
    const state = get();
    if (!state.currentLevelId) {
      return false;
    }
    const level = levelById[state.currentLevelId];
    if (!level) {
      return false;
    }

    const compiled = compileScript(state.scriptText, level, state.save.upgrades);
    set({ compileErrors: compiled.errors });
    return compiled.errors.length === 0;
  },

  runReplay: () => {
    const state = get();
    if (!state.currentLevelId) {
      return;
    }

    const level = levelById[state.currentLevelId];
    if (!level) {
      return;
    }

    const compiled = compileScript(state.scriptText, level, state.save.upgrades);
    if (compiled.errors.length) {
      set({
        compileErrors: compiled.errors,
        phase: 'hack',
      });
      return;
    }

    const attemptsByLevel = {
      ...state.save.attemptsByLevel,
      [state.currentLevelId]: (state.save.attemptsByLevel[state.currentLevelId] ?? 0) + 1,
    };

    const nextSave = {
      ...state.save,
      attemptsByLevel,
      lastScripts: {
        ...state.save.lastScripts,
        [state.currentLevelId]: state.scriptText,
      },
    };
    persistSaveData(nextSave);

    const result = runSimulation(level, compiled.commands);

    set({
      phase: 'replay',
      compileErrors: [],
      replayResult: result,
      frameIndex: 0,
      replayPlaying: true,
      replaySpeed: 1,
      failureSummary: result.failureSummary ?? null,
      selectedDeviceId: null,
      save: nextSave,
      lastReward: 0,
      lastOutcome: null,
    });
  },

  setReplaySpeed: (speed) => {
    set({ replaySpeed: speed });
  },

  toggleReplayPlaying: () => {
    const state = get();
    if (!state.replayResult) {
      return;
    }
    set({ replayPlaying: !state.replayPlaying });
  },

  resetReplay: () => {
    set({ frameIndex: 0, replayPlaying: false });
  },

  advanceReplay: () => {
    const state = get();
    const result = state.replayResult;
    if (!result || !state.replayPlaying) {
      return;
    }

    const lastIndex = Math.max(0, result.frames.length - 1);
    const nextIndex = Math.min(lastIndex, state.frameIndex + state.replaySpeed);
    const reachedEnd = nextIndex >= lastIndex;

    if (!reachedEnd) {
      set({ frameIndex: nextIndex });
      return;
    }

    if (!state.currentLevelId) {
      set({ frameIndex: nextIndex, replayPlaying: false });
      return;
    }

    const level = levelById[state.currentLevelId];
    if (!level) {
      set({ frameIndex: nextIndex, replayPlaying: false });
      return;
    }

    if (result.outcome === 'failure') {
      set({
        frameIndex: nextIndex,
        replayPlaying: false,
        phase: 'failSummary',
        failureSummary: result.failureSummary ?? null,
        lastOutcome: 'failure',
      });
      return;
    }

    const completedBefore = Boolean(state.save.completedLevels[state.currentLevelId]);
    const attempts = state.save.attemptsByLevel[state.currentLevelId] ?? 1;
    const reward = rewardForSuccess(level.rewardCredits, attempts, completedBefore);

    const levelIndex = levels.findIndex((entry) => entry.id === state.currentLevelId);
    const nextUnlockedIndex = Math.max(state.save.unlockedLevelIndex, Math.min(levels.length - 1, levelIndex + 1));
    const newBest = state.save.bestScripts[state.currentLevelId];
    const currentCmdCount = countScriptCommands(state.scriptText);
    const bestCmdCount = newBest ? countScriptCommands(newBest) : Number.POSITIVE_INFINITY;
    const shouldUpdateBest = !newBest || currentCmdCount <= bestCmdCount;

    const nextSave: SaveData = {
      ...state.save,
      unlockedLevelIndex: nextUnlockedIndex,
      credits: state.save.credits + reward,
      completedLevels: {
        ...state.save.completedLevels,
        [state.currentLevelId]: true,
      },
      bestScripts: shouldUpdateBest
        ? {
            ...state.save.bestScripts,
            [state.currentLevelId]: state.scriptText,
          }
        : state.save.bestScripts,
    };

    persistSaveData(nextSave);

    set({
      frameIndex: nextIndex,
      replayPlaying: false,
      phase: 'levelComplete',
      failureSummary: null,
      save: nextSave,
      lastReward: reward,
      lastOutcome: 'success',
    });
  },

  selectDevice: (deviceId) => {
    set({ selectedDeviceId: deviceId });
  },

  purchaseUpgrade: (key) => {
    const state = get();
    const item = upgradesCatalog.find((entry) => entry.key === key);
    if (!item) {
      return;
    }
    if (state.save.credits < item.cost) {
      return;
    }
    if (key === 'inspector' && state.save.upgrades.inspectorPlus) {
      return;
    }

    const nextSave: SaveData = {
      ...state.save,
      credits: state.save.credits - item.cost,
      upgrades: applyUpgrade(state.save.upgrades, key),
    };
    persistSaveData(nextSave);
    set({ save: nextSave });
  },
}));
