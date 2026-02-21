import { create } from 'zustand';
import { compileScript } from '../game/compiler/compile';
import type { CompileError } from '../game/compiler/scriptTypes';
import { runSimulation } from '../game/engine/simulationRunner';
import type { FailureSummary, SimulationResult } from '../game/engine/eventTypes';
import { levelById, levels } from '../game/levels';
import { defaultSaveData, loadSaveData, persistSaveData, type SaveData } from '../persistence/saveGame';
import {
  withAttemptAndScript,
  withLevelCompletion,
  withScript,
  withSeenLevel1Walkthrough,
} from './progression';
import {
  applyWalkthroughAction,
  advanceWalkthrough,
  createWalkthroughForLevel,
  defaultWalkthroughSlice,
  retreatWalkthrough,
  type WalkthroughAction,
  type WalkthroughCompletionState,
  type WalkthroughSlice,
} from './walkthrough';

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
  walkthroughActive: boolean;
  walkthroughStep: number;
  walkthroughCompletion: WalkthroughCompletionState;

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
  clearReplay: () => void;
  advanceReplay: () => void;
  selectDevice: (deviceId: string | null) => void;
  nextWalkthroughStep: () => void;
  prevWalkthroughStep: () => void;
  dismissWalkthrough: () => void;
  markWalkthroughAction: (action: WalkthroughAction) => void;
}

const initialSave = typeof window !== 'undefined' ? loadSaveData() : defaultSaveData;

function getInitialScript(_levelId: string): string {
  return '';
}

function walkthroughFromState(state: GameStore): WalkthroughSlice {
  return {
    walkthroughActive: state.walkthroughActive,
    walkthroughStep: state.walkthroughStep,
    walkthroughCompletion: state.walkthroughCompletion,
  };
}

function resolveWalkthroughOutcome(save: SaveData, walkthrough: WalkthroughSlice | null): {
  save: SaveData;
  walkthrough: WalkthroughSlice;
  shouldPersist: boolean;
} {
  if (walkthrough) {
    return {
      save,
      walkthrough,
      shouldPersist: false,
    };
  }

  const nextSave = withSeenLevel1Walkthrough(save);
  return {
    save: nextSave,
    walkthrough: defaultWalkthroughSlice,
    shouldPersist: nextSave !== save,
  };
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
  ...defaultWalkthroughSlice,

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
      ...defaultWalkthroughSlice,
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
    const saveAfter = withAttemptAndScript(saveBefore, levelId, script);
    persistSaveData(saveAfter);

    const result = runSimulation(level, commands);
    const walkthrough = createWalkthroughForLevel(levelId, saveBefore.seenLevel1Walkthrough);
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
      ...walkthrough,
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

    const baseSave = withScript(state.save, state.currentLevelId, source);
    let finalSave = baseSave;
    let walkthrough = walkthroughFromState(state);

    if (source.trim().length > 0) {
      const resolved = resolveWalkthroughOutcome(baseSave, applyWalkthroughAction(walkthrough, 'typedCommand'));
      finalSave = resolved.save;
      walkthrough = resolved.walkthrough;
    }

    persistSaveData(finalSave);
    set({
      scriptText: source,
      save: finalSave,
      ...walkthrough,
    });
  },

  resetScript: () => {
    const state = get();
    if (!state.currentLevelId) {
      return;
    }

    const fallback = '';
    const nextSave = withScript(state.save, state.currentLevelId, fallback);
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
    get().markWalkthroughAction('compiled');

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
    get().markWalkthroughAction('compiled');

    const compiled = compileScript(state.scriptText, level);
    if (compiled.errors.length) {
      set({
        compileErrors: compiled.errors,
        phase: 'hack',
      });
      return;
    }

    const nextSave = withAttemptAndScript(state.save, state.currentLevelId, state.scriptText);
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

  clearReplay: () => {
    set({
      replayResult: null,
      frameIndex: 0,
      replayPlaying: false,
      failureSummary: null,
      phase: 'hack',
      selectedDeviceId: null,
    });
  },

  nextWalkthroughStep: () => {
    const state = get();
    if (!state.walkthroughActive) {
      return;
    }

    const resolved = resolveWalkthroughOutcome(state.save, advanceWalkthrough(walkthroughFromState(state)));
    if (resolved.shouldPersist) {
      persistSaveData(resolved.save);
    }
    set({
      save: resolved.save,
      ...resolved.walkthrough,
    });
  },

  prevWalkthroughStep: () => {
    const state = get();
    if (!state.walkthroughActive) {
      return;
    }
    set({
      ...retreatWalkthrough(walkthroughFromState(state)),
    });
  },

  dismissWalkthrough: () => {
    const state = get();
    const nextSave = withSeenLevel1Walkthrough(state.save);
    if (nextSave !== state.save) {
      persistSaveData(nextSave);
    }
    set({
      ...defaultWalkthroughSlice,
      save: nextSave,
    });
  },

  markWalkthroughAction: (action) => {
    const state = get();
    if (!state.walkthroughActive || state.currentLevelId !== 'level1') {
      return;
    }
    const resolved = resolveWalkthroughOutcome(state.save, applyWalkthroughAction(walkthroughFromState(state), action));
    if (resolved.shouldPersist) {
      persistSaveData(resolved.save);
    }
    set({
      save: resolved.save,
      ...resolved.walkthrough,
    });
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

    const nextSave = withLevelCompletion(state.save, levels, state.currentLevelId, state.scriptText);

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
