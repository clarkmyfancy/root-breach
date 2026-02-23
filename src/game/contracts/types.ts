export type ContractObjectiveType =
  | 'RETRIEVE'
  | 'DELETE'
  | 'ALTER'
  | 'SABOTAGE'
  | 'FRAME'
  | 'ESCORT'
  | 'EXFIL';

export interface ContractBonus {
  id: string;
  description: string;
  creditBonus: number;
}

export interface MissionRules {
  tickLimit?: number;
  allowCivilianCollateral?: boolean;
  requireNoTrace?: boolean;
  allowFrameTarget?: boolean;
  forcedDetection?: boolean;
  targetFrameIdentity?: string;
  cleanupWindowTicks?: number;
  traceTolerance?: number;
  allowTraceOverflow?: boolean;
}

export interface ContractDefinition {
  id: string;
  title: string;
  clientCodename: string;
  factionId: string;
  regionId: string;
  siteId: string;
  objectiveType: ContractObjectiveType;
  summary: string;
  knownIntel: string[];
  unknowns: string[];
  payout: number;
  repReward: number;
  heatPenaltyOnFail: number;
  requiredTools?: string[];
  optionalBonuses?: ContractBonus[];
  missionRules: MissionRules;
  siteNodes: string[];
  fileTargets: string[];
  recordTargets: string[];
  authEndpoints: string[];
  frameTargets: string[];
  storyIntro: string[];
  storyTags?: string[];
}
