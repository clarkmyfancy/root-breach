import type { CompiledCommand } from '../compiler/scriptTypes';
import type { LevelDefinition } from '../models/types';
import type { SimulationResult } from './eventTypes';
import type { MissionConfig } from './missionTypes';
import { runTickEngine } from './tickEngine';

export function runSimulation(
  level: LevelDefinition,
  commands: CompiledCommand[],
  missionConfig?: MissionConfig,
): SimulationResult {
  return runTickEngine(level, commands, missionConfig);
}
