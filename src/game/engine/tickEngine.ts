import type { CompiledCommand } from '../compiler/scriptTypes';
import { resolveAimExpression, type TurretAimContext } from '../compiler/turretAim';
import { createInitialSimulationState } from '../models/state';
import type {
  AlarmDevice,
  CameraDevice,
  Device,
  DoorDevice,
  LevelDefinition,
  PlayerState,
  SimulationState,
} from '../models/types';
import { buildFailureSummary } from './failureSummary';
import { GLOBAL_TICK_LIMIT } from './constants';
import type { EventCategory, EventRecord, EventType, SimulationResult } from './eventTypes';
import { buildFrame } from './replayRecorder';

interface TargetInfo {
  id: string;
  kind: 'player' | 'enemy';
  x: number;
  y: number;
}

interface TickContext {
  state: SimulationState;
  level: LevelDefinition;
  tickLimit: number;
  commandsByTick: Map<number, CompiledCommand[]>;
  cameraDetectionMemory: Record<string, boolean>;
  guardDetectionMemory: Record<string, boolean>;
  eventsThisTick: EventRecord[];
  events: EventRecord[];
  executedLines: number[];
  nextEventId: number;
}

function emit(
  ctx: TickContext,
  type: EventType,
  category: EventCategory,
  payload: Record<string, string | number | boolean | null>,
  line?: number,
): void {
  const record: EventRecord = {
    id: ctx.nextEventId,
    tick: ctx.state.tick,
    type,
    category,
    payload,
    line,
  };
  ctx.nextEventId += 1;
  ctx.eventsThisTick.push(record);
}

function getAlarm(state: SimulationState): AlarmDevice | undefined {
  const found = Object.values(state.devices).find((device) => device.type === 'alarm');
  if (!found || found.type !== 'alarm') {
    return undefined;
  }
  return found;
}

function getPrimaryTurret(ctx: TickContext): Extract<Device, { type: 'turret' }> | undefined {
  const scopedTurretId = ctx.level.networkScope.find((deviceId) => {
    const device = ctx.state.devices[deviceId];
    return device?.type === 'turret';
  });

  if (scopedTurretId) {
    const scoped = ctx.state.devices[scopedTurretId];
    if (scoped?.type === 'turret') {
      return scoped;
    }
  }

  return Object.values(ctx.state.devices).find((device): device is Extract<Device, { type: 'turret' }> => {
    return device.type === 'turret';
  });
}

function buildDynamicAimContext(state: SimulationState, turret: Extract<Device, { type: 'turret' }>): TurretAimContext {
  const activeGuards = Object.values(state.devices).filter((device): device is Extract<Device, { type: 'drone' | 'guard' }> => {
    return (device.type === 'drone' || device.type === 'guard') && device.alive && device.enabled;
  });

  return {
    intruderPosX: state.player.x - turret.x,
    intruderPosY: state.player.y - turret.y,
    numGuards: activeGuards.length,
    guardPosX: activeGuards.map((guard) => guard.x - turret.x),
    guardPosY: activeGuards.map((guard) => guard.y - turret.y),
  };
}

function resolveManualAimForTurret(
  state: SimulationState,
  turret: Extract<Device, { type: 'turret' }>,
): { x: number; y: number } | null {
  const hasExpr = Boolean(turret.manualAimXExpr && turret.manualAimYExpr);
  if (!hasExpr) {
    if (turret.manualAimX === undefined || turret.manualAimX === null || turret.manualAimY === undefined || turret.manualAimY === null) {
      return null;
    }
    return { x: turret.manualAimX, y: turret.manualAimY };
  }

  const context = buildDynamicAimContext(state, turret);
  const xResult = resolveAimExpression(turret.manualAimXExpr ?? '', context);
  const yResult = resolveAimExpression(turret.manualAimYExpr ?? '', context);
  if (xResult.error || yResult.error || xResult.value === undefined || yResult.value === undefined) {
    return null;
  }

  return {
    x: xResult.value,
    y: yResult.value,
  };
}

function getDevice<T extends Device['type']>(
  state: SimulationState,
  id: string | undefined,
  type: T,
): Extract<Device, { type: T }> | undefined {
  if (!id) {
    return undefined;
  }
  const device = state.devices[id];
  if (!device || device.type !== type) {
    return undefined;
  }
  return device as Extract<Device, { type: T }>;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function euclideanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function facingMatches(camera: CameraDevice, player: PlayerState): boolean {
  const dx = player.x - camera.x;
  const dy = player.y - camera.y;

  switch (camera.facing) {
    case 'up':
      return dy < 0 && Math.abs(dx) <= Math.abs(dy);
    case 'down':
      return dy > 0 && Math.abs(dx) <= Math.abs(dy);
    case 'left':
      return dx < 0 && Math.abs(dy) <= Math.abs(dx);
    case 'right':
      return dx > 0 && Math.abs(dy) <= Math.abs(dx);
    default:
      return false;
  }
}

function applyScheduledScriptActions(ctx: TickContext): void {
  const commands = ctx.commandsByTick.get(ctx.state.tick) ?? [];

  for (const command of commands) {
    ctx.executedLines.push(command.line);
    emit(
      ctx,
      'SCRIPT_LINE_EXECUTED',
      'script',
      {
        kind: command.kind,
        line: command.line,
        deviceId: command.deviceId ?? null,
      },
      command.line,
    );

    switch (command.kind) {
      case 'camera.disable': {
        const camera = getDevice(ctx.state, command.deviceId, 'camera');
        if (!camera) {
          break;
        }
        camera.enabled = false;
        camera.disabledUntilTick = command.value !== undefined ? ctx.state.tick + command.value : null;
        emit(
          ctx,
          'DEVICE_DISABLED',
          'script',
          { deviceId: camera.id, duration: command.value ?? null },
          command.line,
        );
        break;
      }
      case 'camera.enable': {
        const camera = getDevice(ctx.state, command.deviceId, 'camera');
        if (!camera) {
          break;
        }
        camera.enabled = true;
        camera.disabledUntilTick = null;
        emit(ctx, 'DEVICE_ENABLED', 'script', { deviceId: camera.id }, command.line);
        break;
      }
      case 'alarm.delay': {
        const alarm = getAlarm(ctx.state);
        if (!alarm || !command.value) {
          break;
        }
        if (alarm.state === 'YELLOW' && alarm.redAtTick !== null) {
          alarm.redAtTick += command.value;
        } else {
          alarm.manualDelayBuffer += command.value;
        }
        emit(ctx, 'ALARM_DELAY_APPLIED', 'script', { amount: command.value }, command.line);
        break;
      }
      case 'alarm.trigger': {
        const alarm = getDevice(ctx.state, command.deviceId, 'alarm');
        if (!alarm) {
          break;
        }
        const before = alarm.state;
        alarm.state = 'RED';
        alarm.redAtTick = null;
        alarm.manualDelayBuffer = 0;
        const resetAtTick = ctx.state.tick + Math.max(1, alarm.scriptTriggerDuration ?? 6);
        alarm.scriptedResetAtTick = resetAtTick;
        if (before !== alarm.state) {
          emit(ctx, 'ALARM_STATE_CHANGED', 'script', { from: before, to: alarm.state }, command.line);
          applyDoorLockdown(ctx);
        }
        emit(
          ctx,
          'ALARM_TRIGGERED',
          'script',
          {
            alarmId: alarm.id,
            resetAtTick,
          },
          command.line,
        );
        break;
      }
      case 'door.open': {
        const door = getDevice(ctx.state, command.deviceId, 'door');
        if (!door) {
          break;
        }
        door.isOpen = true;
        emit(ctx, 'DOOR_OPENED', 'script', { doorId: door.id }, command.line);
        break;
      }
      case 'door.close': {
        const door = getDevice(ctx.state, command.deviceId, 'door');
        if (!door) {
          break;
        }
        door.isOpen = false;
        emit(ctx, 'DOOR_CLOSED', 'script', { doorId: door.id }, command.line);
        break;
      }
      case 'generator.overclock': {
        const generator = getDevice(ctx.state, command.deviceId, 'generator');
        if (!generator || !generator.isOnline) {
          break;
        }
        generator.overloadAtTick = ctx.state.tick + Math.max(1, generator.overloadTicks);
        emit(
          ctx,
          'GENERATOR_OVERCLOCKED',
          'script',
          { generatorId: generator.id, burnoutTick: generator.overloadAtTick },
          command.line,
        );
        break;
      }
      case 'turret.retarget': {
        const turret = getDevice(ctx.state, command.deviceId, 'turret');
        if (!turret || !command.targetId) {
          break;
        }
        turret.desiredTargetId = command.targetId;
        turret.manualAimX = null;
        turret.manualAimY = null;
        turret.manualAimXExpr = null;
        turret.manualAimYExpr = null;
        turret.currentTargetId = null;
        turret.lockTicks = 0;
        emit(
          ctx,
          'TURRET_RETARGETED',
          'script',
          { turretId: turret.id, targetId: command.targetId },
          command.line,
        );
        break;
      }
      case 'turret.setAim': {
        const turret = getPrimaryTurret(ctx);
        if (!turret || command.xValue === undefined || command.yValue === undefined) {
          break;
        }
        turret.manualAimX = command.xValue;
        turret.manualAimY = command.yValue;
        turret.manualAimXExpr = command.xExpr ?? null;
        turret.manualAimYExpr = command.yExpr ?? null;
        turret.desiredTargetId = null;
        turret.currentTargetId = null;
        turret.lockTicks = 0;
        emit(
          ctx,
          'TURRET_RETARGETED',
          'script',
          {
            turretId: turret.id,
            targetId: `coord:${turret.x + command.xValue},${turret.y + command.yValue}`,
          },
          command.line,
        );
        break;
      }
      case 'device.tag': {
        const device = command.deviceId ? ctx.state.devices[command.deviceId] : undefined;
        if (!device || !command.textArg) {
          break;
        }
        device.tag = command.textArg;
        emit(ctx, 'DEVICE_TAGGED', 'script', { deviceId: device.id, tag: command.textArg }, command.line);
        break;
      }
      case 'log': {
        emit(ctx, 'LOG', 'script', { message: command.textArg ?? '' }, command.line);
        break;
      }
      case 'wait':
      default:
        break;
    }
  }
}

function updateDeviceTimers(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type === 'camera') {
      const camera = device;
      if (!camera.enabled && camera.disabledUntilTick !== null && ctx.state.tick >= camera.disabledUntilTick) {
        camera.enabled = true;
        camera.disabledUntilTick = null;
        emit(ctx, 'DEVICE_ENABLED', 'system', { deviceId: camera.id });
      }
      continue;
    }

    if (device.type === 'generator') {
      const generator = device;
      if (!generator.isOnline || generator.overloadAtTick === null || ctx.state.tick < generator.overloadAtTick) {
        continue;
      }

      generator.isOnline = false;
      generator.enabled = false;
      generator.overloadAtTick = null;
      emit(ctx, 'GENERATOR_BURNT_OUT', 'system', { generatorId: generator.id });

      for (const poweredId of generator.poweredDeviceIds) {
        const poweredDevice = ctx.state.devices[poweredId];
        if (!poweredDevice || !poweredDevice.enabled) {
          continue;
        }
        poweredDevice.enabled = false;
        emit(ctx, 'DEVICE_DISABLED', 'system', { deviceId: poweredDevice.id, reason: 'generator_offline' });
      }
    }
  }
}

function hasWall(level: LevelDefinition, x: number, y: number): boolean {
  return level.map.walls.some((wall) => wall.x === x && wall.y === y);
}

function hasClosedDoor(state: SimulationState, x: number, y: number): boolean {
  return Object.values(state.devices).some((device) => device.type === 'door' && !device.isOpen && device.x === x && device.y === y);
}

function isWalkableTile(level: LevelDefinition, state: SimulationState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.map.width || y >= level.map.height) {
    return false;
  }

  if (hasWall(level, x, y)) {
    return false;
  }

  return !hasClosedDoor(state, x, y);
}

function isPatrolEnemy(device: Device): device is Extract<Device, { type: 'drone' | 'guard' }> {
  return device.type === 'drone' || device.type === 'guard';
}

function choosePatrolEnemyStep(
  ctx: TickContext,
  from: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const horizontal = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const vertical = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const prioritizeHorizontal = Math.abs(dx) >= Math.abs(dy);

  const candidates = prioritizeHorizontal
    ? [
        { dx: horizontal, dy: 0 },
        { dx: 0, dy: vertical },
      ]
    : [
        { dx: 0, dy: vertical },
        { dx: horizontal, dy: 0 },
      ];

  for (const candidate of candidates) {
    if (candidate.dx === 0 && candidate.dy === 0) {
      continue;
    }

    const nextX = from.x + candidate.dx;
    const nextY = from.y + candidate.dy;
    if (!isWalkableTile(ctx.level, ctx.state, nextX, nextY)) {
      continue;
    }

    return { x: nextX, y: nextY };
  }

  return from;
}

function deriveFacingFromStep(
  previous: { x: number; y: number },
  next: { x: number; y: number },
  fallback: 'up' | 'down' | 'left' | 'right',
): 'up' | 'down' | 'left' | 'right' {
  if (next.x > previous.x) {
    return 'right';
  }
  if (next.x < previous.x) {
    return 'left';
  }
  if (next.y > previous.y) {
    return 'down';
  }
  if (next.y < previous.y) {
    return 'up';
  }
  return fallback;
}

function findTriggeredAlarmForPatrolEnemy(
  state: SimulationState,
  enemy: Extract<Device, { type: 'drone' | 'guard' }>,
): Extract<Device, { type: 'alarm' }> | undefined {
  if (!enemy.investigateAlarmId) {
    return undefined;
  }
  const alarm = state.devices[enemy.investigateAlarmId];
  if (!alarm || alarm.type !== 'alarm' || !alarm.enabled || alarm.state !== 'RED') {
    return undefined;
  }
  return alarm;
}

function updatePatrolEnemyMovement(ctx: TickContext): void {
  if (!ctx.state.player.alive) {
    ctx.guardDetectionMemory = {};
  }

  for (const device of Object.values(ctx.state.devices)) {
    if (!isPatrolEnemy(device)) {
      continue;
    }

    const enemy = device;
    if (!enemy.enabled || !enemy.alive) {
      continue;
    }

    enemy.stepTimer += 1;
    if (enemy.stepTimer < Math.max(1, enemy.stepInterval)) {
      continue;
    }
    enemy.stepTimer = 0;

    if (enemy.type === 'guard' && ctx.state.player.alive) {
      const canSeePlayer = guardCanSeePlayer(ctx.level, ctx.state, enemy);
      const wasSeeing = ctx.guardDetectionMemory[enemy.id] ?? false;
      if (canSeePlayer) {
        if (!wasSeeing) {
          emit(ctx, 'PLAYER_SPOTTED_BY_GUARD', 'detection', { guardId: enemy.id, player: 'agent' });
        }
        ctx.guardDetectionMemory[enemy.id] = true;
        const step = choosePatrolEnemyStep(ctx, enemy, ctx.state.player);
        enemy.facing = deriveFacingFromStep(enemy, step, enemy.facing);
        enemy.x = step.x;
        enemy.y = step.y;
        continue;
      }
      if (wasSeeing) {
        ctx.guardDetectionMemory[enemy.id] = false;
      }
    }

    const investigateAlarm = findTriggeredAlarmForPatrolEnemy(ctx.state, enemy);
    if (investigateAlarm) {
      const step = choosePatrolEnemyStep(ctx, enemy, investigateAlarm);
      if (enemy.type === 'guard') {
        enemy.facing = deriveFacingFromStep(enemy, step, enemy.facing);
      }
      enemy.x = step.x;
      enemy.y = step.y;
      continue;
    }

    if (enemy.path.length < 2) {
      continue;
    }

    const nextPathIndex = (enemy.pathIndex + 1) % enemy.path.length;
    const targetPoint = enemy.path[nextPathIndex];
    const step = choosePatrolEnemyStep(ctx, enemy, targetPoint);
    if (enemy.type === 'guard') {
      enemy.facing = deriveFacingFromStep(enemy, step, enemy.facing);
    }
    enemy.x = step.x;
    enemy.y = step.y;

    if (enemy.x === targetPoint.x && enemy.y === targetPoint.y) {
      enemy.pathIndex = nextPathIndex;
    }
  }
}

function hasLineOfSight(
  level: LevelDefinition,
  state: SimulationState,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    if (x0 === x1 && y0 === y1) {
      return true;
    }

    if (hasWall(level, x0, y0) || hasClosedDoor(state, x0, y0)) {
      return false;
    }
  }

  return true;
}

function guardCanSeePlayer(
  level: LevelDefinition,
  state: SimulationState,
  guard: Extract<Device, { type: 'guard' }>,
): boolean {
  const dx = state.player.x - guard.x;
  const dy = state.player.y - guard.y;

  let forward = 0;
  let lateral = 0;
  switch (guard.facing) {
    case 'up':
      forward = -dy;
      lateral = Math.abs(dx);
      break;
    case 'down':
      forward = dy;
      lateral = Math.abs(dx);
      break;
    case 'left':
      forward = -dx;
      lateral = Math.abs(dy);
      break;
    case 'right':
      forward = dx;
      lateral = Math.abs(dy);
      break;
    default:
      return false;
  }

  if (forward <= 0 || forward > Math.max(1, guard.visionRange)) {
    return false;
  }

  const coneWidth = Math.max(1, Math.floor(forward / 2));
  if (lateral > coneWidth) {
    return false;
  }

  return hasLineOfSight(level, state, guard, state.player);
}

function checkPlayerCaughtByPatrolEnemy(ctx: TickContext): void {
  if (!ctx.state.player.alive) {
    return;
  }

  const caughtBy = Object.values(ctx.state.devices).find((device): device is Extract<Device, { type: 'drone' | 'guard' }> => {
    return isPatrolEnemy(device) && device.enabled && device.alive && device.x === ctx.state.player.x && device.y === ctx.state.player.y;
  });

  if (!caughtBy) {
    return;
  }

  ctx.state.player.alive = false;
  if (caughtBy.type === 'guard') {
    emit(ctx, 'PLAYER_CAUGHT_BY_GUARD', 'combat', { guardId: caughtBy.id });
  } else {
    emit(ctx, 'PLAYER_CAUGHT_BY_DRONE', 'combat', { droneId: caughtBy.id });
  }
}

function updateObjectiveDoors(ctx: TickContext): void {
  const alivePatrolEnemies = Object.values(ctx.state.devices).some((device) => {
    return isPatrolEnemy(device) && device.enabled && device.alive;
  });
  if (alivePatrolEnemies) {
    return;
  }

  const nextDoor = ctx.state.devices.NEXT_DOOR;
  if (!nextDoor || nextDoor.type !== 'door' || nextDoor.isOpen) {
    return;
  }

  nextDoor.isOpen = true;
  emit(ctx, 'DOOR_OPENED', 'system', { doorId: nextDoor.id, reason: 'objective_cleared' });
}

function updateCameraDetection(ctx: TickContext): boolean {
  if (!ctx.state.player.alive) {
    for (const device of Object.values(ctx.state.devices)) {
      if (device.type === 'camera') {
        ctx.cameraDetectionMemory[device.id] = false;
      }
    }
    return false;
  }

  let detected = false;
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'camera') {
      continue;
    }
    const camera = device;
    const wasDetecting = ctx.cameraDetectionMemory[camera.id] ?? false;
    if (!camera.enabled) {
      ctx.cameraDetectionMemory[camera.id] = false;
      continue;
    }

    const inRange = distance(camera, ctx.state.player) <= camera.range;
    const nowDetecting = inRange && facingMatches(camera, ctx.state.player);
    if (!nowDetecting) {
      ctx.cameraDetectionMemory[camera.id] = false;
      continue;
    }

    detected = true;
    if (!wasDetecting) {
      emit(ctx, 'CAMERA_DETECTED_PLAYER', 'detection', { cameraId: camera.id, player: 'agent' });
    }
    ctx.cameraDetectionMemory[camera.id] = true;
  }

  return detected;
}

function applyDoorLockdown(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'door') {
      continue;
    }
    const door = device;
    if (!door.closesOnAlarmRed || !door.isOpen) {
      continue;
    }
    door.isOpen = false;
    emit(ctx, 'DOOR_CLOSED', 'alarm', { doorId: door.id, reason: 'alarm_lockdown' });
  }
}

function updateAlarmBus(ctx: TickContext, detected: boolean): void {
  const alarm = getAlarm(ctx.state);
  if (!alarm) {
    return;
  }

  if (detected && alarm.state === 'GREEN') {
    const before = alarm.state;
    alarm.state = 'YELLOW';
    alarm.redAtTick = ctx.state.tick + alarm.baseEscalationTicks + alarm.manualDelayBuffer;
    alarm.manualDelayBuffer = 0;
    emit(ctx, 'ALARM_STATE_CHANGED', 'alarm', { from: before, to: alarm.state });
  }

  if (alarm.state === 'YELLOW' && alarm.redAtTick !== null && ctx.state.tick >= alarm.redAtTick) {
    const before = alarm.state;
    alarm.state = 'RED';
    alarm.redAtTick = null;
    emit(ctx, 'ALARM_STATE_CHANGED', 'alarm', { from: before, to: alarm.state });
    applyDoorLockdown(ctx);
  }

  if (alarm.state === 'RED' && alarm.scriptedResetAtTick != null && ctx.state.tick >= alarm.scriptedResetAtTick) {
    const before = alarm.state;
    alarm.state = 'GREEN';
    alarm.redAtTick = null;
    alarm.manualDelayBuffer = 0;
    alarm.scriptedResetAtTick = null;
    emit(ctx, 'ALARM_STATE_CHANGED', 'alarm', { from: before, to: alarm.state });
  }
}

function resolveTarget(state: SimulationState, preferredTargetId: string | null): TargetInfo | undefined {
  const playerTarget: TargetInfo | undefined = state.player.alive
    ? { id: 'player', kind: 'player', x: state.player.x, y: state.player.y }
    : undefined;

  if (preferredTargetId) {
    const preferred = state.devices[preferredTargetId];
    if (preferred && (preferred.type === 'drone' || preferred.type === 'guard') && preferred.alive && preferred.enabled) {
      return {
        id: preferred.id,
        kind: 'enemy',
        x: preferred.x,
        y: preferred.y,
      };
    }
  }

  return playerTarget;
}

function findAlivePatrolEnemyAt(
  state: SimulationState,
  x: number,
  y: number,
): Extract<Device, { type: 'drone' | 'guard' }> | undefined {
  return Object.values(state.devices).find((device): device is Extract<Device, { type: 'drone' | 'guard' }> => {
    return (device.type === 'drone' || device.type === 'guard') && device.alive && device.enabled && device.x === x && device.y === y;
  });
}

function updateTurrets(ctx: TickContext, detected: boolean): void {
  const alarm = getAlarm(ctx.state);

  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'turret') {
      continue;
    }

    const turret = device;
    if (!turret.enabled) {
      continue;
    }

    const active =
      turret.alarmTrigger === 'ALWAYS' ||
      (turret.alarmTrigger === 'RED' && alarm?.state === 'RED') ||
      (turret.alarmTrigger === 'DETECTION' && (detected || turret.currentTargetId !== null));
    if (!active) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    const manualAim = resolveManualAimForTurret(ctx.state, turret);
    if (manualAim) {
      const targetX = turret.x + manualAim.x;
      const targetY = turret.y + manualAim.y;
      const targetId = `coord:${targetX},${targetY}`;

      if (euclideanDistance(turret, { x: targetX, y: targetY }) > turret.range) {
        turret.currentTargetId = null;
        turret.lockTicks = 0;
        continue;
      }

      if (turret.currentTargetId !== targetId) {
        turret.currentTargetId = targetId;
        turret.lockTicks = 1;
        emit(ctx, 'TURRET_TARGET_LOCK', 'combat', { turretId: turret.id, targetId });
      } else {
        turret.lockTicks += 1;
      }

      if (turret.lockTicks < turret.lockDelay) {
        continue;
      }

      emit(ctx, 'TURRET_FIRED', 'combat', { turretId: turret.id, targetId });

      if (ctx.state.player.alive && ctx.state.player.x === targetX && ctx.state.player.y === targetY) {
        ctx.state.player.alive = false;
        emit(ctx, 'PLAYER_KILLED', 'combat', { turretId: turret.id });
      }

      const enemy = findAlivePatrolEnemyAt(ctx.state, targetX, targetY);
      if (enemy) {
        enemy.alive = false;
        enemy.enabled = false;
        if (enemy.type === 'guard') {
          emit(ctx, 'GUARD_NEUTRALIZED', 'combat', { guardId: enemy.id, turretId: turret.id });
        } else {
          emit(ctx, 'DRONE_DESTROYED', 'combat', { droneId: enemy.id, turretId: turret.id });
        }
      }

      turret.lockTicks = 0;
      continue;
    }

    const requiresExplicitInstruction = ctx.level.uiVariant === 'turretAim';
    if (requiresExplicitInstruction && !turret.desiredTargetId) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    const target = resolveTarget(ctx.state, turret.desiredTargetId);
    if (!target) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    if (euclideanDistance(turret, target) > turret.range) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    if (turret.currentTargetId !== target.id) {
      turret.currentTargetId = target.id;
      turret.lockTicks = 1;
      emit(ctx, 'TURRET_TARGET_LOCK', 'combat', { turretId: turret.id, targetId: target.id });
    } else {
      turret.lockTicks += 1;
    }

    if (turret.lockTicks < turret.lockDelay) {
      continue;
    }

    emit(ctx, 'TURRET_FIRED', 'combat', { turretId: turret.id, targetId: target.id });

    if (target.kind === 'player' && ctx.state.player.alive) {
      ctx.state.player.alive = false;
      emit(ctx, 'PLAYER_KILLED', 'combat', { turretId: turret.id });
    }

    if (target.kind === 'enemy') {
      const targetDevice = ctx.state.devices[target.id];
      if (targetDevice && (targetDevice.type === 'drone' || targetDevice.type === 'guard') && targetDevice.alive) {
        targetDevice.alive = false;
        targetDevice.enabled = false;
        if (targetDevice.type === 'guard') {
          emit(ctx, 'GUARD_NEUTRALIZED', 'combat', { guardId: targetDevice.id, turretId: turret.id });
        } else {
          emit(ctx, 'DRONE_DESTROYED', 'combat', { droneId: targetDevice.id, turretId: turret.id });
        }
      }
    }

    turret.lockTicks = 0;
  }
}

function findBlockingDoor(state: SimulationState, x: number, y: number): DoorDevice | undefined {
  for (const device of Object.values(state.devices)) {
    if (device.type !== 'door') {
      continue;
    }
    if (!device.isOpen && device.x === x && device.y === y) {
      return device;
    }
  }
  return undefined;
}

function updatePlayerMovement(ctx: TickContext): void {
  const player = ctx.state.player;
  if (!player.alive || player.reachedExit) {
    return;
  }

  const next = ctx.level.playerPath[player.pathIndex + 1];
  if (!next) {
    if (player.x === ctx.level.exit.x && player.y === ctx.level.exit.y) {
      player.reachedExit = true;
      emit(ctx, 'PLAYER_REACHED_EXIT', 'movement', { exit: 'goal' });
    }
    return;
  }

  const door = findBlockingDoor(ctx.state, next.x, next.y);
  if (door) {
    if (player.blockedByDoorId !== door.id) {
      emit(ctx, 'PLAYER_BLOCKED_BY_DOOR', 'movement', { doorId: door.id });
    }
    player.blockedByDoorId = door.id;
    return;
  }

  player.blockedByDoorId = null;
  player.x = next.x;
  player.y = next.y;
  player.pathIndex += 1;

  if (player.x === ctx.level.exit.x && player.y === ctx.level.exit.y) {
    player.reachedExit = true;
    emit(ctx, 'PLAYER_REACHED_EXIT', 'movement', { exit: 'goal' });
  }
}

function checkWinLose(ctx: TickContext): boolean {
  if (ctx.state.player.reachedExit) {
    ctx.state.outcome = 'success';
    return true;
  }

  if (!ctx.state.player.alive) {
    ctx.state.outcome = 'failure';
    return true;
  }

  return false;
}

function buildCommandsByTick(commands: CompiledCommand[]): Map<number, CompiledCommand[]> {
  const byTick = new Map<number, CompiledCommand[]>();

  for (const command of commands) {
    const arr = byTick.get(command.tick);
    if (arr) {
      arr.push(command);
    } else {
      byTick.set(command.tick, [command]);
    }
  }

  return byTick;
}

export function runTickEngine(level: LevelDefinition, commands: CompiledCommand[]): SimulationResult {
  const tickLimit = Math.min(level.constraints.tickLimit, GLOBAL_TICK_LIMIT);
  const state = createInitialSimulationState(level);
  const commandsByTick = buildCommandsByTick(commands);
  const events: EventRecord[] = [];
  const frames: SimulationResult['frames'] = [];

  const ctx: TickContext = {
    state,
    level,
    tickLimit,
    commandsByTick,
    cameraDetectionMemory: {},
    guardDetectionMemory: {},
    eventsThisTick: [],
    events,
    executedLines: [],
    nextEventId: 1,
  };

  // Always include tick-0 baseline before any script/device updates.
  frames.push(buildFrame(ctx.state, [], []));

  while (ctx.state.outcome === 'running') {
    ctx.eventsThisTick = [];
    ctx.executedLines = [];

    if (ctx.state.tick >= ctx.tickLimit) {
      emit(ctx, 'RUN_TIMEOUT', 'system', { tickLimit: ctx.tickLimit });
      ctx.state.outcome = 'failure';

      const frame = buildFrame(ctx.state, ctx.eventsThisTick, ctx.executedLines);
      frames.push(frame);
      events.push(...ctx.eventsThisTick);
      break;
    }

    applyScheduledScriptActions(ctx);
    updateDeviceTimers(ctx);
    updatePatrolEnemyMovement(ctx);
    checkPlayerCaughtByPatrolEnemy(ctx);
    const detected = updateCameraDetection(ctx);
    updateAlarmBus(ctx, detected);
    updateTurrets(ctx, detected);
    updateObjectiveDoors(ctx);
    updatePlayerMovement(ctx);
    checkPlayerCaughtByPatrolEnemy(ctx);

    const done = checkWinLose(ctx);
    ctx.state.tick += 1;

    if (!done && ctx.state.tick >= ctx.tickLimit) {
      emit(ctx, 'RUN_TIMEOUT', 'system', { tickLimit: ctx.tickLimit });
      ctx.state.outcome = 'failure';
    }

    const frame = buildFrame(ctx.state, ctx.eventsThisTick, ctx.executedLines);
    frames.push(frame);
    events.push(...ctx.eventsThisTick);

    if (ctx.state.outcome !== 'running') {
      const killedThisTick = ctx.eventsThisTick.some((event) => event.type === 'PLAYER_KILLED');
      if (killedThisTick) {
        // Add one settle frame after kill so transient muzzle/projectile effects clear.
        ctx.state.tick += 1;
        frames.push(buildFrame(ctx.state, [], []));
      }
      break;
    }
  }

  const outcome = ctx.state.outcome === 'success' ? 'success' : 'failure';
  const failureSummary = outcome === 'failure' ? buildFailureSummary(events) : undefined;

  return {
    frames,
    events,
    outcome,
    finalTick: ctx.state.tick,
    tickLimit,
    failureSummary,
  };
}
