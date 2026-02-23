import type { LevelDefinition } from '../models/types';

export interface TurretAimContext {
  intruderPosX: number;
  intruderPosY: number;
  numGuards: number;
  guardPosX: number[];
  guardPosY: number[];
}

function isIntegerToken(token: string): boolean {
  return /^-?\d+$/.test(token);
}

function parseGuardIndex(token: string, prefix: 'guardPosX' | 'guardPosY'): number | null {
  const match = token.match(new RegExp(`^${prefix}\\[(\\d+)\\]$`));
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function getTurretAimContext(level: LevelDefinition): TurretAimContext | null {
  const turret = level.devices.find((device) => device.type === 'turret');
  if (!turret || turret.type !== 'turret') {
    return null;
  }

  const guards = level.devices.filter((device) => device.type === 'drone');
  return {
    intruderPosX: level.entry.x - turret.x,
    intruderPosY: level.entry.y - turret.y,
    numGuards: guards.length,
    guardPosX: guards.map((guard) => guard.x - turret.x),
    guardPosY: guards.map((guard) => guard.y - turret.y),
  };
}

export function resolveAimExpression(expr: string, context: TurretAimContext): { value?: number; error?: string } {
  const token = expr.trim();
  if (token.length === 0) {
    return { error: 'Aim value cannot be empty' };
  }

  if (isIntegerToken(token)) {
    return { value: Number(token) };
  }

  if (token === 'intruderPosX') {
    return { value: context.intruderPosX };
  }

  if (token === 'intruderPosY') {
    return { value: context.intruderPosY };
  }

  if (token === 'numGuards') {
    return { value: context.numGuards };
  }

  const guardXIndex = parseGuardIndex(token, 'guardPosX');
  if (guardXIndex !== null) {
    if (guardXIndex < 0 || guardXIndex >= context.guardPosX.length) {
      return { error: `guardPosX index ${guardXIndex} is out of range (0-${Math.max(0, context.guardPosX.length - 1)})` };
    }
    return { value: context.guardPosX[guardXIndex] };
  }

  const guardYIndex = parseGuardIndex(token, 'guardPosY');
  if (guardYIndex !== null) {
    if (guardYIndex < 0 || guardYIndex >= context.guardPosY.length) {
      return { error: `guardPosY index ${guardYIndex} is out of range (0-${Math.max(0, context.guardPosY.length - 1)})` };
    }
    return { value: context.guardPosY[guardYIndex] };
  }

  return {
    error: `Unsupported expression "${token}". Use integers, intruderPosX/Y, numGuards, or guardPosX[i]/guardPosY[i]`,
  };
}
