import type { ContractDefinition } from '../contracts/types';
import type { LevelDefinition } from '../models/types';
import type { CommandKind, CompileError, ParsedCommand } from './scriptTypes';

export interface ScriptValidationOptions {
  ownedToolIds?: string[];
  requiredToolByCommand?: Partial<Record<CommandKind, string>>;
  contract?: ContractDefinition;
}

const cleanupOnlyCommands: Set<CommandKind> = new Set([
  'logs.scrub',
  'logs.forge',
  'logs.overwrite',
  'evidence.frame',
]);

const validEvidenceSurfaces = new Set(['NETFLOW', 'AUTH', 'DEVICE', 'FILE_AUDIT', 'ALARM', 'PROCESS']);

function validateDeviceCommand(level: LevelDefinition, command: ParsedCommand, errors: CompileError[]): void {
  if (!command.deviceId) {
    return;
  }
  const deviceMap = new Map(level.devices.map((device) => [device.id, device]));
  const targetDevice = deviceMap.get(command.deviceId);
  if (!targetDevice) {
    errors.push({ line: command.line, message: `Unknown device "${command.deviceId}"` });
    return;
  }

  if (!level.networkScope.includes(command.deviceId)) {
    errors.push({ line: command.line, message: `Device "${command.deviceId}" is not in terminal network scope` });
    return;
  }

  if (command.kind.startsWith('camera.') && targetDevice.type !== 'camera') {
    errors.push({ line: command.line, message: `Device "${command.deviceId}" is not a camera` });
  }
  if (command.kind.startsWith('door.') && targetDevice.type !== 'door') {
    errors.push({ line: command.line, message: `Device "${command.deviceId}" is not a door` });
  }
  if (command.kind.startsWith('turret.') && targetDevice.type !== 'turret') {
    errors.push({ line: command.line, message: `Device "${command.deviceId}" is not a turret` });
  }
  if (command.kind === 'access.terminal.spoof' && targetDevice.type !== 'terminal') {
    errors.push({ line: command.line, message: `Device "${command.deviceId}" is not a terminal` });
  }
}

const physicalDeviceCommands: Set<CommandKind> = new Set([
  'camera.disable',
  'camera.enable',
  'door.open',
  'door.close',
  'turret.retarget',
  'device.tag',
  'device.sabotage',
  'access.door.bypass',
  'access.terminal.spoof',
  'scan.device',
]);

function validateContractTargets(command: ParsedCommand, contract: ContractDefinition, errors: CompileError[]): void {
  switch (command.kind) {
    case 'scan.node':
    case 'route.relay':
      if (!command.targetId || !contract.siteNodes.includes(command.targetId)) {
        errors.push({ line: command.line, message: `Node "${command.targetId ?? ''}" is not in contract scope` });
      }
      break;
    case 'route.agent':
      if (!command.targetId) {
        errors.push({ line: command.line, message: 'route.agent requires a route id' });
      }
      break;
    case 'probe.logs':
    case 'logs.scrub':
    case 'logs.forge':
    case 'logs.overwrite':
      if (!command.textArg || !validEvidenceSurfaces.has(command.textArg)) {
        errors.push({ line: command.line, message: `Invalid evidence surface "${command.textArg ?? ''}"` });
      }
      break;
    case 'file.copy':
    case 'file.delete':
      if (!command.deviceId || !contract.fileTargets.includes(command.deviceId)) {
        errors.push({ line: command.line, message: `File target "${command.deviceId ?? ''}" not available for contract` });
      }
      break;
    case 'record.alter':
      if (!command.deviceId || !contract.recordTargets.includes(command.deviceId)) {
        errors.push({
          line: command.line,
          message: `Record target "${command.deviceId ?? ''}" not available for contract`,
        });
      }
      if (!command.textArg || !command.extraTextArg) {
        errors.push({
          line: command.line,
          message: 'record().alter(field,value) requires both field and value arguments',
        });
      }
      break;
    case 'access.auth.replayToken':
      if (!command.deviceId || !contract.authEndpoints.includes(command.deviceId)) {
        errors.push({
          line: command.line,
          message: `Auth endpoint "${command.deviceId ?? ''}" not available for contract`,
        });
      }
      break;
    case 'evidence.frame': {
      if (!contract.missionRules.allowFrameTarget) {
        errors.push({
          line: command.line,
          message: 'This contract does not allow frame targeting',
        });
        break;
      }
      const validTargets = new Set([
        ...(contract.frameTargets ?? []),
        ...(contract.missionRules.targetFrameIdentity ? [contract.missionRules.targetFrameIdentity] : []),
      ]);
      if (!command.textArg || !validTargets.has(command.textArg)) {
        errors.push({
          line: command.line,
          message: `Frame target "${command.textArg ?? ''}" is not allowed for this contract`,
        });
      }
      break;
    }
    case 'narrative.ticket':
      if (!command.targetId || !command.textArg) {
        errors.push({
          line: command.line,
          message: 'narrative.ticket(ticketId,reason) requires ticket id and reason',
        });
      }
      break;
    default:
      break;
  }
}

export function validateParsedScript(
  level: LevelDefinition,
  commands: ParsedCommand[],
  options: ScriptValidationOptions = {},
): CompileError[] {
  const errors: CompileError[] = [];
  const alarmsInScope = level.devices.filter((device) => device.type === 'alarm' && level.networkScope.includes(device.id));
  const ownedToolIds = new Set(options.ownedToolIds ?? []);
  const requiredToolByCommand = options.requiredToolByCommand ?? {};
  if (options.contract?.requiredTools) {
    for (const toolId of options.contract.requiredTools) {
      if (!ownedToolIds.has(toolId)) {
        errors.push({
          line: 1,
          message: `Contract requires tool "${toolId}" before deployment`,
        });
      }
    }
  }

  for (const command of commands) {
    const requiredTool = requiredToolByCommand[command.kind];
    if (requiredTool && !ownedToolIds.has(requiredTool)) {
      errors.push({
        line: command.line,
        message: `Command "${command.kind}" requires tool "${requiredTool}"`,
      });
      continue;
    }

    switch (command.kind) {
      case 'wait':
      case 'decoy.burst':
      case 'alarm.delay': {
        if (!command.value || command.value <= 0) {
          const label = command.kind === 'alarm.delay' ? 'delay(n)' : command.kind;
          errors.push({ line: command.line, message: `${label} must be greater than 0` });
        }
        if (command.kind === 'alarm.delay' && !alarmsInScope.length) {
          errors.push({ line: command.line, message: 'Alarm bus is not visible in this terminal scope' });
        }
        break;
      }
      case 'camera.disable':
        if (command.value !== undefined && command.value <= 0) {
          errors.push({ line: command.line, message: 'disable(n) must be greater than 0 when provided' });
        }
        break;
      case 'trace.spoof':
      case 'device.tag':
      case 'device.sabotage':
      case 'access.terminal.spoof':
      case 'access.auth.replayToken':
      case 'logs.forge':
      case 'evidence.frame':
      case 'identity.assume':
        if (!command.textArg) {
          errors.push({ line: command.line, message: `${command.kind} requires a non-empty string argument` });
        }
        break;
      case 'logs.scrub':
      case 'logs.overwrite':
      case 'turret.retarget':
        if (!command.targetId) {
          errors.push({ line: command.line, message: `${command.kind} requires a target id` });
        }
        break;
      default:
        break;
    }

    if (command.deviceId && physicalDeviceCommands.has(command.kind)) {
      validateDeviceCommand(level, command, errors);
    }

    if (command.kind === 'turret.retarget') {
      const target = level.devices.find((device) => device.id === command.targetId);
      if (!target) {
        errors.push({ line: command.line, message: `retarget target "${command.targetId}" does not exist` });
      } else if (target.type !== 'drone') {
        errors.push({ line: command.line, message: `retarget target "${command.targetId}" is not a valid target` });
      }
    }

    if (options.contract) {
      validateContractTargets(command, options.contract, errors);
    }
  }

  return errors;
}

export function validateCleanupPhaseLegality(
  commands: Array<{ kind: CommandKind; tick: number; line: number }>,
  cleanupStartTickHint: number,
): CompileError[] {
  const errors: CompileError[] = [];
  for (const command of commands) {
    if (!cleanupOnlyCommands.has(command.kind)) {
      continue;
    }
    if (command.tick < cleanupStartTickHint) {
      errors.push({
        line: command.line,
        message: `${command.kind} is cleanup-phase only and cannot be scheduled before tick ${cleanupStartTickHint}`,
      });
    }
  }
  return errors;
}
