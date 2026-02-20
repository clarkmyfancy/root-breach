import { create } from 'zustand';
import { compileScript } from '../game/compiler/compile';
import type { CompileError } from '../game/compiler/scriptTypes';
import { runSimulation } from '../game/engine/simulationRunner';
import type { FailureSummary, SimulationResult } from '../game/engine/eventTypes';
import { levelById, levels } from '../game/levels';
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
}

function countScriptCommands(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#')).length;
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
    const observeCompiled = compileScript(script, level);
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

    const compiled = compileScript(state.scriptText, level);
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

    const compiled = compileScript(state.scriptText, level);
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

    const levelIndex = levels.findIndex((entry) => entry.id === state.currentLevelId);
    const nextUnlockedIndex = Math.max(state.save.unlockedLevelIndex, Math.min(levels.length - 1, levelIndex + 1));
    const newBest = state.save.bestScripts[state.currentLevelId];
    const currentCmdCount = countScriptCommands(state.scriptText);
    const bestCmdCount = newBest ? countScriptCommands(newBest) : Number.POSITIVE_INFINITY;
    const shouldUpdateBest = !newBest || currentCmdCount <= bestCmdCount;

    const nextSave: SaveData = {
      ...state.save,
      unlockedLevelIndex: nextUnlockedIndex,
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
      lastOutcome: 'success',
    });
  },

  selectDevice: (deviceId) => {
    set({ selectedDeviceId: deviceId });
  },
}));
