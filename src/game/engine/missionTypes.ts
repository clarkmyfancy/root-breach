import type { ContractDefinition } from '../contracts/types';

export interface MissionConfig {
  contract: ContractDefinition;
  globalHeat?: number;
}
