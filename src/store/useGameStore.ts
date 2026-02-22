import { create } from 'zustand';
import { isDevGameplayMode } from '../config/gameMode';
import { compileScript } from '../game/compiler/compile';
import type { CompileError } from '../game/compiler/scriptTypes';
import { contractById, contractIdBySiteId, contracts } from '../game/contracts';
import type { ContractDefinition } from '../game/contracts/types';
import { runSimulation } from '../game/engine/simulationRunner';
import type { FailureSummary, SimulationResult } from '../game/engine/eventTypes';
import { levelById } from '../game/levels';
import { commandToolRequirements, toolById, toolCatalog } from '../game/tools';
import { defaultSaveData, loadSaveData, persistSaveData, type SaveData } from '../persistence/saveGame';
import { withAttemptAndScript, withContractOutcome, withScript, withSeenLevel1Walkthrough } from './progression';
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

export type ScreenPhase = 'desktop' | 'contractIntro' | 'runObserve' | 'hack' | 'replay' | 'debrief';
export type ReplaySpeed = 1 | 2 | 4;
export type DesktopApp = 'inbox' | 'contracts' | 'worldMap' | 'siteMonitor' | 'forensics' | 'blackMarket' | 'profile';

export interface DebriefState {
  contractId: string;
  contractTitle: string;
  clientCodename: string;
  outcome: 'success' | 'failure';
  payoutDelta: number;
  repDelta: number;
  heatDelta: number;
}

interface GameStore {
  phase: ScreenPhase;
  activeDesktopApp: DesktopApp;
  currentContractId: string | null;
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
  debrief: DebriefState | null;
  walkthroughActive: boolean;
  walkthroughStep: number;
  walkthroughCompletion: WalkthroughCompletionState;

  goToMainMenu: () => void;
  openLevelSelect: () => void;
  startLevel: (levelId: string) => void;
  setActiveDesktopApp: (app: DesktopApp) => void;
  startContract: (contractId: string) => void;
  launchContractOperation: () => void;
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
  acknowledgeDebrief: () => void;
  purchaseTool: (toolId: string) => { ok: boolean; message: string };
  nextWalkthroughStep: () => void;
  prevWalkthroughStep: () => void;
  dismissWalkthrough: () => void;
  markWalkthroughAction: (action: WalkthroughAction) => void;
}

const initialSave = typeof window !== 'undefined' ? loadSaveData() : defaultSaveData;

function getInitialScript(save: SaveData, contractId: string): string {
  return save.scriptsByContract[contractId] ?? '';
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

function getCompileOptions(save: SaveData, contract?: ContractDefinition) {
  const ownedToolIds = isDevGameplayMode
    ? toolCatalog.map((tool) => tool.id)
    : Object.entries(save.campaign.ownedTools)
        .filter(([, ownedState]) => ownedState.owned)
        .map(([toolId]) => toolId);
  return {
    ownedToolIds,
    requiredToolByCommand: commandToolRequirements,
    contract,
  };
}

function getActiveContract(state: GameStore): ContractDefinition | null {
  if (!state.currentContractId) {
    return null;
  }
  return contractById[state.currentContractId] ?? null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'desktop',
  activeDesktopApp: 'inbox',
  currentContractId: null,
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
  debrief: null,
  ...defaultWalkthroughSlice,

  goToMainMenu: () => {
    set({
      phase: 'desktop',
      activeDesktopApp: 'inbox',
      replayPlaying: false,
      replayResult: null,
      frameIndex: 0,
      failureSummary: null,
      currentLevelId: null,
      currentContractId: null,
      selectedDeviceId: null,
      compileErrors: [],
      lastOutcome: null,
      debrief: null,
      ...defaultWalkthroughSlice,
    });
  },

  openLevelSelect: () => {
    set({ activeDesktopApp: 'contracts', phase: 'desktop' });
  },

  startLevel: (levelId: string) => {
    const contractId = contractIdBySiteId[levelId];
    if (!contractId) {
      return;
    }
    get().startContract(contractId);
  },

  setActiveDesktopApp: (app) => {
    set({ activeDesktopApp: app });
  },

  startContract: (contractId: string) => {
    const contract = contractById[contractId];
    if (!contract) {
      return;
    }
    const level = levelById[contract.siteId];
    if (!level) {
      return;
    }

    const state = get();
    if (!state.save.campaign.unlockedContracts.includes(contractId)) {
      return;
    }
    const missingRequiredTools = (contract.requiredTools ?? []).filter((toolId) => !state.save.campaign.ownedTools[toolId]?.owned);
    if (!isDevGameplayMode && missingRequiredTools.length > 0) {
      return;
    }

    const script = getInitialScript(state.save, contract.id);
    set({
      phase: 'contractIntro',
      activeDesktopApp: 'contracts',
      currentContractId: contract.id,
      currentLevelId: contract.siteId,
      scriptText: script,
      compileErrors: [],
      replayResult: null,
      frameIndex: 0,
      replayPlaying: false,
      failureSummary: null,
      selectedDeviceId: null,
      lastOutcome: null,
      debrief: null,
      ...defaultWalkthroughSlice,
    });
  },

  launchContractOperation: () => {
    const state = get();
    const contract = getActiveContract(state);
    if (!contract) {
      return;
    }
    const level = levelById[contract.siteId];
    if (!level) {
      return;
    }
    if (!state.save.campaign.unlockedContracts.includes(contract.id)) {
      return;
    }

    const script = getInitialScript(state.save, contract.id);
    const compileOptions = getCompileOptions(state.save, contract);
    const observeCompiled = compileScript(script, level, compileOptions);
    const commands = observeCompiled.errors.length ? [] : observeCompiled.commands;
    const saveAfter = withAttemptAndScript(state.save, contract.id, script);
    persistSaveData(saveAfter);

    const result = runSimulation(level, commands, { contract, globalHeat: state.save.campaign.globalHeat });
    const walkthrough = createWalkthroughForLevel(contract.siteId, Boolean(state.save.completedTutorialFlags.level1_walkthrough_seen));

    set({
      phase: 'runObserve',
      activeDesktopApp: 'siteMonitor',
      currentContractId: contract.id,
      currentLevelId: contract.siteId,
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
      debrief: null,
      ...walkthrough,
    });
  },

  openHack: () => {
    set({
      phase: 'hack',
      activeDesktopApp: 'siteMonitor',
      replayPlaying: false,
    });
  },

  updateScript: (source: string) => {
    const state = get();
    const contract = getActiveContract(state);
    if (!contract) {
      return;
    }

    const baseSave = withScript(state.save, contract.id, source);
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
    const contract = getActiveContract(state);
    if (!contract) {
      return;
    }

    const fallback = '';
    const nextSave = withScript(state.save, contract.id, fallback);
    persistSaveData(nextSave);

    set({
      scriptText: fallback,
      compileErrors: [],
      save: nextSave,
    });
  },

  compileCurrentScript: () => {
    const state = get();
    const contract = getActiveContract(state);
    if (!contract) {
      return false;
    }
    const level = levelById[contract.siteId];
    if (!level) {
      return false;
    }

    get().markWalkthroughAction('compiled');
    const compiled = compileScript(state.scriptText, level, getCompileOptions(state.save, contract));
    set({ compileErrors: compiled.errors });
    return compiled.errors.length === 0;
  },

  runReplay: () => {
    const state = get();
    const contract = getActiveContract(state);
    if (!contract) {
      return;
    }
    const level = levelById[contract.siteId];
    if (!level) {
      return;
    }
    get().markWalkthroughAction('compiled');

    const compiled = compileScript(state.scriptText, level, getCompileOptions(state.save, contract));
    if (compiled.errors.length) {
      set({
        compileErrors: compiled.errors,
        phase: 'hack',
      });
      return;
    }

    const nextSave = withAttemptAndScript(state.save, contract.id, state.scriptText);
    persistSaveData(nextSave);

    const result = runSimulation(level, compiled.commands, {
      contract,
      globalHeat: state.save.campaign.globalHeat,
    });

    set({
      phase: 'replay',
      activeDesktopApp: 'siteMonitor',
      compileErrors: [],
      replayResult: result,
      frameIndex: 0,
      replayPlaying: true,
      replaySpeed: 1,
      failureSummary: result.failureSummary ?? null,
      selectedDeviceId: null,
      save: nextSave,
      lastOutcome: null,
      debrief: null,
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

    const contract = getActiveContract(state);
    if (!contract) {
      set({ frameIndex: nextIndex, replayPlaying: false });
      return;
    }

    const outcome: 'success' | 'failure' = result.outcome === 'success' ? 'success' : 'failure';
    const nextSave = withContractOutcome(state.save, contracts, contract, outcome, state.scriptText);
    persistSaveData(nextSave);

    set({
      frameIndex: nextIndex,
      replayPlaying: false,
      phase: 'debrief',
      activeDesktopApp: 'siteMonitor',
      failureSummary: result.failureSummary ?? null,
      save: nextSave,
      lastOutcome: outcome,
      debrief: {
        contractId: contract.id,
        contractTitle: contract.title,
        clientCodename: contract.clientCodename,
        outcome,
        payoutDelta: outcome === 'success' ? contract.payout : 0,
        repDelta: outcome === 'success' ? contract.repReward : 0,
        heatDelta: outcome === 'success' ? 0 : contract.heatPenaltyOnFail,
      },
    });
  },

  selectDevice: (deviceId) => {
    set({ selectedDeviceId: deviceId });
  },

  acknowledgeDebrief: () => {
    set({
      phase: 'desktop',
      activeDesktopApp: 'contracts',
      replayPlaying: false,
    });
  },

  purchaseTool: (toolId: string) => {
    const state = get();
    const tool = toolById[toolId];
    if (!tool) {
      return { ok: false, message: 'Tool not found.' };
    }
    if (state.save.campaign.ownedTools[toolId]?.owned) {
      return { ok: false, message: 'Tool already owned.' };
    }
    if (state.save.campaign.reputation < tool.repRequired) {
      return { ok: false, message: `Requires reputation ${tool.repRequired}.` };
    }
    if (state.save.campaign.credits < tool.cost) {
      return { ok: false, message: 'Insufficient credits.' };
    }

    const nextSave: SaveData = {
      ...state.save,
      campaign: {
        ...state.save.campaign,
        credits: state.save.campaign.credits - tool.cost,
        ownedTools: {
          ...state.save.campaign.ownedTools,
          [toolId]: {
            owned: true,
            tier: tool.tier,
          },
        },
      },
    };

    persistSaveData(nextSave);
    set({ save: nextSave });
    return { ok: true, message: `${tool.name} purchased.` };
  },
}));
