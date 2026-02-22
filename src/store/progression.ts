import type { ContractDefinition } from '../game/contracts/types';
import type { SaveData } from '../persistence/saveGame';

function countScriptCommands(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#')).length;
}

export function withAttemptAndScript(save: SaveData, contractId: string, script: string): SaveData {
  return {
    ...save,
    campaign: {
      ...save.campaign,
      attemptsByContract: {
        ...save.campaign.attemptsByContract,
        [contractId]: (save.campaign.attemptsByContract[contractId] ?? 0) + 1,
      },
    },
    scriptsByContract: {
      ...save.scriptsByContract,
      [contractId]: script,
    },
  };
}

export function withScript(save: SaveData, contractId: string, script: string): SaveData {
  return {
    ...save,
    scriptsByContract: {
      ...save.scriptsByContract,
      [contractId]: script,
    },
  };
}

export function withContractOutcome(
  save: SaveData,
  contracts: ContractDefinition[],
  contract: ContractDefinition,
  outcome: 'success' | 'failure',
  script: string,
): SaveData {
  const nextSave: SaveData = {
    ...save,
    campaign: {
      ...save.campaign,
      contractHistory: [
        ...save.campaign.contractHistory,
        {
          contractId: contract.id,
          outcome,
          payoutDelta: outcome === 'success' ? contract.payout : 0,
          repDelta: outcome === 'success' ? contract.repReward : 0,
          heatDelta: outcome === 'success' ? 0 : contract.heatPenaltyOnFail,
          timestamp: Date.now(),
        },
      ],
    },
  };

  if (outcome !== 'success') {
    return {
      ...nextSave,
      campaign: {
        ...nextSave.campaign,
        globalHeat: nextSave.campaign.globalHeat + contract.heatPenaltyOnFail,
      },
    };
  }

  const contractIndex = contracts.findIndex((entry) => entry.id === contract.id);
  const nextUnlockId = contractIndex >= 0 ? contracts[contractIndex + 1]?.id : undefined;
  const unlockedContracts = nextUnlockId
    ? Array.from(new Set([...nextSave.campaign.unlockedContracts, nextUnlockId]))
    : nextSave.campaign.unlockedContracts;
  const completedContracts = Array.from(new Set([...nextSave.campaign.completedContracts, contract.id]));

  const currentCommandCount = countScriptCommands(script);
  const previousBest = nextSave.bestScriptsByContract[contract.id];
  const shouldReplaceBest = !previousBest || currentCommandCount <= previousBest.commandCount;

  return {
    ...nextSave,
    campaign: {
      ...nextSave.campaign,
      credits: nextSave.campaign.credits + contract.payout,
      reputation: nextSave.campaign.reputation + contract.repReward,
      unlockedContracts,
      completedContracts,
    },
    bestScriptsByContract: shouldReplaceBest
      ? {
          ...nextSave.bestScriptsByContract,
          [contract.id]: {
            commandCount: currentCommandCount,
            script,
          },
        }
      : nextSave.bestScriptsByContract,
  };
}

export function withSeenLevel1Walkthrough(save: SaveData): SaveData {
  if (save.completedTutorialFlags.level1_walkthrough_seen) {
    return save;
  }
  return {
    ...save,
    completedTutorialFlags: {
      ...save.completedTutorialFlags,
      level1_walkthrough_seen: true,
    },
  };
}
