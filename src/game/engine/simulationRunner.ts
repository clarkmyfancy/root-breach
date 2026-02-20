import type { CompiledCommand } from '../compiler/scriptTypes';
import type { LevelDefinition } from '../models/types';
import type { SimulationResult } from './eventTypes';
import { runTickEngine } from './tickEngine';

export function runSimulation(level: LevelDefinition, commands: CompiledCommand[]): SimulationResult {
  return runTickEngine(level, commands);
}
