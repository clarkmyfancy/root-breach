import type { LevelDefinition } from '../models/types';
import type { CompileError, ParsedCommand } from './scriptTypes';

export function validateParsedScript(
  level: LevelDefinition,
  commands: ParsedCommand[],
): CompileError[] {
  const errors: CompileError[] = [];
  const deviceMap = new Map(level.devices.map((device) => [device.id, device]));
  const alarmsInScope = level.devices.filter((device) => device.type === 'alarm' && level.networkScope.includes(device.id));

  for (const command of commands) {
    switch (command.kind) {
      case 'wait': {
        if (!command.value || command.value <= 0) {
          errors.push({ line: command.line, message: 'wait(n) must be greater than 0' });
        }
        break;
      }
      case 'alarm.delay': {
        if (!alarmsInScope.length) {
          errors.push({ line: command.line, message: 'Alarm bus is not visible in this terminal scope' });
        }
        if (!command.value || command.value <= 0) {
          errors.push({ line: command.line, message: 'delay(n) must be greater than 0' });
        }
        break;
      }
      case 'camera.disable': {
        if (command.value !== undefined && command.value <= 0) {
          errors.push({ line: command.line, message: 'disable(n) must be greater than 0 when provided' });
        }
        break;
      }
      default:
        break;
    }

    if (!command.deviceId) {
      if (command.kind === 'alarm.delay' || command.kind === 'wait' || command.kind === 'log') {
        continue;
      }
      continue;
    }

    const targetDevice = deviceMap.get(command.deviceId);
    if (!targetDevice) {
      errors.push({ line: command.line, message: `Unknown device "${command.deviceId}"` });
      continue;
    }

    if (!level.networkScope.includes(command.deviceId)) {
      errors.push({ line: command.line, message: `Device "${command.deviceId}" is not in terminal network scope` });
      continue;
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

    if (command.kind === 'turret.retarget') {
      if (!command.targetId) {
        errors.push({ line: command.line, message: 'retarget() requires a target device id' });
      } else {
        const target = deviceMap.get(command.targetId);
        if (!target) {
          errors.push({ line: command.line, message: `retarget target "${command.targetId}" does not exist` });
        } else if (target.type !== 'drone') {
          errors.push({ line: command.line, message: `retarget target "${command.targetId}" is not a valid target` });
        }
      }
    }
  }

  return errors;
}
