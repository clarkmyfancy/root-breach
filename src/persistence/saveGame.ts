import { isDevGameplayMode } from '../config/gameMode';
import { contracts } from '../game/contracts';
import { starterToolIds, toolCatalog, type ToolOwnedState } from '../game/tools';

export interface ContractOutcomeRecord {
  contractId: string;
  outcome: 'success' | 'failure';
  payoutDelta: number;
  repDelta: number;
  heatDelta: number;
  timestamp: number;
}

export interface CampaignState {
  credits: number;
  reputation: number;
  globalHeat: number;
  ownedTools: Record<string, ToolOwnedState>;
  unlockedContracts: string[];
  completedContracts: string[];
  contractHistory: ContractOutcomeRecord[];
  attemptsByContract: Record<string, number>;
}

export interface SaveData {
  version: 2;
  campaign: CampaignState;
  scriptsByContract: Record<string, string>;
  bestScriptsByContract: Record<string, { commandCount: number; script: string }>;
  completedTutorialFlags: Record<string, boolean>;
  settings: {
    uiScale?: number;
    replaySpeed?: number;
  };
}

interface LegacySaveData {
  unlockedLevelIndex?: number;
  attemptsByLevel?: Record<string, number>;
  completedLevels?: Record<string, boolean>;
  bestScripts?: Record<string, string>;
  lastScripts?: Record<string, string>;
  seenLevel1Walkthrough?: boolean;
}

const STORAGE_KEY = 'root_breach_save_v2';
const LEGACY_STORAGE_KEY = 'root_breach_save_v1';

const contractIdByLegacyLevelId: Record<string, string> = {
  level1: 'contract_tut_01',
  level2: 'contract_tut_02',
  level3: 'contract_tut_03',
  level4: 'contract_tut_04',
  level5: 'contract_tut_05',
};

function createDefaultOwnedTools(includeAll = false): Record<string, ToolOwnedState> {
  const ids = includeAll ? toolCatalog.map((tool) => tool.id) : starterToolIds;
  return ids.reduce<Record<string, ToolOwnedState>>((acc, id) => {
    acc[id] = { owned: true, tier: 1 };
    return acc;
  }, {});
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export const defaultSaveData: SaveData = {
  version: 2,
  campaign: {
    credits: isDevGameplayMode ? 25000 : 500,
    reputation: isDevGameplayMode ? 50 : 0,
    globalHeat: 0,
    ownedTools: createDefaultOwnedTools(isDevGameplayMode),
    unlockedContracts: isDevGameplayMode ? contracts.map((contract) => contract.id) : [contracts[0]?.id ?? 'contract_tut_01'],
    completedContracts: [],
    contractHistory: [],
    attemptsByContract: {},
  },
  scriptsByContract: {},
  bestScriptsByContract: {},
  completedTutorialFlags: {},
  settings: {},
};

function countScriptCommands(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#')).length;
}

function sanitizeV2Save(parsed: Partial<SaveData>): SaveData {
  const completedContracts = Array.isArray(parsed.campaign?.completedContracts)
    ? parsed.campaign?.completedContracts.filter((id): id is string => typeof id === 'string')
    : defaultSaveData.campaign.completedContracts;
  const unlockedContracts = Array.isArray(parsed.campaign?.unlockedContracts)
    ? parsed.campaign?.unlockedContracts.filter((id): id is string => typeof id === 'string')
    : defaultSaveData.campaign.unlockedContracts;

  const normalized: SaveData = {
    ...defaultSaveData,
    version: 2,
    campaign: {
      ...defaultSaveData.campaign,
      credits: parsed.campaign?.credits ?? defaultSaveData.campaign.credits,
      reputation: parsed.campaign?.reputation ?? defaultSaveData.campaign.reputation,
      globalHeat: parsed.campaign?.globalHeat ?? defaultSaveData.campaign.globalHeat,
      ownedTools: { ...defaultSaveData.campaign.ownedTools, ...(parsed.campaign?.ownedTools ?? {}) },
      unlockedContracts: unique(
        unlockedContracts.length > 0 ? unlockedContracts : defaultSaveData.campaign.unlockedContracts,
      ),
      completedContracts: unique(completedContracts),
      contractHistory: parsed.campaign?.contractHistory ?? defaultSaveData.campaign.contractHistory,
      attemptsByContract: parsed.campaign?.attemptsByContract ?? defaultSaveData.campaign.attemptsByContract,
    },
    scriptsByContract: parsed.scriptsByContract ?? {},
    bestScriptsByContract: parsed.bestScriptsByContract ?? {},
    completedTutorialFlags: parsed.completedTutorialFlags ?? {},
    settings: parsed.settings ?? {},
  };

  return applyDevModeGrants(normalized);
}

export function migrateSaveState(legacy: LegacySaveData | null | undefined): SaveData {
  if (!legacy) {
    return { ...defaultSaveData };
  }

  const levelOrder = ['level1', 'level2', 'level3', 'level4', 'level5'];
  const unlockedLevelIndex = Math.max(0, Math.min(levelOrder.length - 1, legacy.unlockedLevelIndex ?? 0));
  const unlockedContracts = levelOrder
    .filter((_levelId, index) => index <= unlockedLevelIndex)
    .map((levelId) => contractIdByLegacyLevelId[levelId])
    .filter(Boolean);

  const completedContracts = Object.entries(legacy.completedLevels ?? {})
    .filter(([, done]) => Boolean(done))
    .map(([levelId]) => contractIdByLegacyLevelId[levelId])
    .filter(Boolean);

  const attemptsByContract = Object.entries(legacy.attemptsByLevel ?? {}).reduce<Record<string, number>>(
    (acc, [levelId, attempts]) => {
      const contractId = contractIdByLegacyLevelId[levelId];
      if (!contractId) {
        return acc;
      }
      acc[contractId] = attempts;
      return acc;
    },
    {},
  );

  const scriptsByContract = Object.entries(legacy.lastScripts ?? {}).reduce<Record<string, string>>((acc, [levelId, script]) => {
    const contractId = contractIdByLegacyLevelId[levelId];
    if (!contractId) {
      return acc;
    }
    acc[contractId] = script;
    return acc;
  }, {});

  const bestScriptsByContract = Object.entries(legacy.bestScripts ?? {}).reduce<
    Record<string, { commandCount: number; script: string }>
  >((acc, [levelId, script]) => {
    const contractId = contractIdByLegacyLevelId[levelId];
    if (!contractId) {
      return acc;
    }
    acc[contractId] = {
      commandCount: countScriptCommands(script),
      script,
    };
    return acc;
  }, {});

  return sanitizeV2Save({
    version: 2,
    campaign: {
      ...defaultSaveData.campaign,
      unlockedContracts: unique([...defaultSaveData.campaign.unlockedContracts, ...unlockedContracts]),
      completedContracts: unique(completedContracts),
      attemptsByContract,
    },
    scriptsByContract,
    bestScriptsByContract,
    completedTutorialFlags: {
      level1_walkthrough_seen: Boolean(legacy.seenLevel1Walkthrough),
    },
    settings: {},
  });
}

function applyDevModeGrants(save: SaveData): SaveData {
  if (!isDevGameplayMode) {
    return save;
  }

  const allOwnedTools = toolCatalog.reduce<Record<string, ToolOwnedState>>((acc, tool) => {
    acc[tool.id] = { owned: true, tier: tool.tier };
    return acc;
  }, {});

  return {
    ...save,
    campaign: {
      ...save.campaign,
      credits: Math.max(save.campaign.credits, 25000),
      reputation: Math.max(save.campaign.reputation, 50),
      globalHeat: 0,
      ownedTools: allOwnedTools,
      unlockedContracts: contracts.map((contract) => contract.id),
    },
  };
}

function readRawSave(): string | null {
  const v2Raw = window.localStorage.getItem(STORAGE_KEY);
  if (v2Raw) {
    return v2Raw;
  }
  return window.localStorage.getItem(LEGACY_STORAGE_KEY);
}

export function loadSaveData(): SaveData {
  try {
    const raw = readRawSave();
    if (!raw) {
      return applyDevModeGrants({ ...defaultSaveData });
    }

    const parsed = JSON.parse(raw) as Partial<SaveData> & LegacySaveData;
    if (parsed.version === 2) {
      return sanitizeV2Save(parsed);
    }

    const migrated = migrateSaveState(parsed);
    persistSaveData(migrated);
    return applyDevModeGrants(migrated);
  } catch {
    return applyDevModeGrants({ ...defaultSaveData });
  }
}

export function persistSaveData(data: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
