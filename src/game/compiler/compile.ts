import type { LevelDefinition } from '../models/types';
import { GLOBAL_TICK_LIMIT } from '../engine/constants';
import { parseScript } from './parser';
import type { CompiledCommand, CompileResult } from './scriptTypes';
import { validateParsedScript } from './validator';

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

export function compileScript(source: string, level: LevelDefinition): CompileResult {
  const parsed = parseScript(source);
  if (parsed.errors.length) {
    return { commands: [], errors: parsed.errors };
  }

  const validationErrors = validateParsedScript(level, parsed.commands);
  if (validationErrors.length) {
    return { commands: [], errors: validationErrors };
  }

  const scheduled = scheduleCommands(parsed.commands);
  const lastTick = scheduled.reduce((max, command) => Math.max(max, command.tick), 0);
  const effectiveTickLimit = Math.min(level.constraints.tickLimit, GLOBAL_TICK_LIMIT);

  if (lastTick > effectiveTickLimit) {
    return {
      commands: [],
      errors: [{ line: 1, message: `Script schedule exceeds run tick limit (${effectiveTickLimit})` }],
    };
  }

  return { commands: scheduled, errors: [] };
}
