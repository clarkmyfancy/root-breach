import type { ContractDefinition } from '../contracts/types';
import type { LevelDefinition } from '../models/types';
import { GLOBAL_TICK_LIMIT } from '../engine/constants';
import { parseScript } from './parser';
import type { CommandKind, CompiledCommand, CompileResult } from './scriptTypes';
import { validateCleanupPhaseLegality, validateParsedScript } from './validator';

export interface CompileOptions {
  ownedToolIds?: string[];
  requiredToolByCommand?: Partial<Record<CommandKind, string>>;
  contract?: ContractDefinition;
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
      extraTextArg: command.extraTextArg,
      value: command.value,
    });

    if (command.kind === 'wait') {
      cursor += command.value ?? 0;
    }
  }

  return scheduled;
}

export function compileScript(source: string, level: LevelDefinition, options: CompileOptions = {}): CompileResult {
  const parsed = parseScript(source);
  if (parsed.errors.length) {
    return { commands: [], errors: parsed.errors };
  }

  const validationErrors = validateParsedScript(level, parsed.commands, options);
  if (validationErrors.length) {
    return { commands: [], errors: validationErrors };
  }

  const scheduled = scheduleCommands(parsed.commands);
  const effectiveTickLimit = Math.min(level.constraints.tickLimit, GLOBAL_TICK_LIMIT);
  const outOfRange = scheduled.find((command) => command.tick >= effectiveTickLimit);

  if (outOfRange) {
    return {
      commands: [],
      errors: [
        {
          line: outOfRange.line,
          message: `Command is scheduled at tick ${outOfRange.tick}, outside run range [0, ${effectiveTickLimit})`,
        },
      ],
    };
  }

  if (options.contract) {
    const cleanupStartTickHint = Math.max(1, level.playerPath.length - 1);
    const phaseErrors = validateCleanupPhaseLegality(scheduled, cleanupStartTickHint);
    if (phaseErrors.length) {
      return {
        commands: [],
        errors: phaseErrors,
      };
    }
  }

  return { commands: scheduled, errors: [] };
}
