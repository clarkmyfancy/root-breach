import type { LevelDefinition } from '../models/types';

export interface SiteBlueprint {
  id: string;
  levelId: string;
  regionId: string;
  factionHintId: string;
  nodes: string[];
  routes: string[];
  fileTargets: string[];
  recordTargets: string[];
  authEndpoints: string[];
  level: LevelDefinition;
}
