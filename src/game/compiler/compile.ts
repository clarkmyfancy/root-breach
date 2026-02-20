import type { EffectiveConstraints, LevelDefinition, UpgradeState } from '../models/types';
import { parseScript } from './parser';
import type { CompiledCommand, CompileResult } from './scriptTypes';
import { validateParsedScript } from './validator';

export function getEffectiveConstraints(level: LevelDefinition, upgrades: UpgradeState): EffectiveConstraints {
  return {
    ...level.constraints,
    maxLines: level.constraints.maxLines + upgrades.maxLinesBonus,
    maxCommands: level.constraints.maxCommands + upgrades.maxCommandsBonus,
    maxDelayTicks: level.constraints.maxDelayTicks + upgrades.maxDelayBonus,
  };
}

function scheduleCommands(commands: ReturnType<typeof parseScript>['commands']): CompiledCommand[] {
  const scheduled: CompiledCommand[] = [];
  let cursor = 0;

  for (const command of commands) {
    scheduled.push({
      tick: cursor,
      line: command.line,
      kind: command.kind,
      raw: command.raw,
      deviceId: command.deviceId,
      targetId: command.targetId,
      textArg: command.textArg,
      value: command.value,
    });

    if (command.kind === 'wait') {
      cursor += command.value ?? 0;
    }
  }

  return scheduled;
}

export function compileScript(source: string, level: LevelDefinition, upgrades: UpgradeState): CompileResult {
  const parsed = parseScript(source);
  if (parsed.errors.length) {
    return { commands: [], errors: parsed.errors };
  }

  const constraints = getEffectiveConstraints(level, upgrades);
  const validationErrors = validateParsedScript(level, constraints, parsed.commands);
  if (validationErrors.length) {
    return { commands: [], errors: validationErrors };
  }

  const scheduled = scheduleCommands(parsed.commands);
  const lastTick = scheduled.reduce((max, command) => Math.max(max, command.tick), 0);

  if (lastTick > constraints.tickLimit) {
    return {
      commands: [],
      errors: [{ line: 1, message: `Script schedule exceeds level tick limit (${constraints.tickLimit})` }],
    };
  }

  return { commands: scheduled, errors: [] };
}
