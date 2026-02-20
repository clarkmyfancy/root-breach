import type { CompiledCommand } from '../compiler/scriptTypes';
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
  kind: 'player' | 'drone';
  x: number;
  y: number;
}

interface TickContext {
  state: SimulationState;
  level: LevelDefinition;
  tickLimit: number;
  commandsByTick: Map<number, CompiledCommand[]>;
  cameraDetectionMemory: Record<string, boolean>;
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
      case 'turret.retarget': {
        const turret = getDevice(ctx.state, command.deviceId, 'turret');
        if (!turret || !command.targetId) {
          break;
        }
        turret.desiredTargetId = command.targetId;
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
    }
  }
}

function updateDroneMovement(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'drone') {
      continue;
    }
    const drone = device;
    if (!drone.enabled || !drone.alive || drone.path.length < 2) {
      continue;
    }

    drone.stepTimer += 1;
    if (drone.stepTimer < drone.stepInterval) {
      continue;
    }

    drone.stepTimer = 0;
    drone.pathIndex = (drone.pathIndex + 1) % drone.path.length;
    const point = drone.path[drone.pathIndex];
    drone.x = point.x;
    drone.y = point.y;
  }
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
}

function resolveTarget(state: SimulationState, preferredTargetId: string | null): TargetInfo | undefined {
  const playerTarget: TargetInfo | undefined = state.player.alive
    ? { id: 'player', kind: 'player', x: state.player.x, y: state.player.y }
    : undefined;

  if (preferredTargetId) {
    const preferred = state.devices[preferredTargetId];
    if (preferred && preferred.type === 'drone' && preferred.alive && preferred.enabled) {
      return {
        id: preferred.id,
        kind: 'drone',
        x: preferred.x,
        y: preferred.y,
      };
    }
  }

  return playerTarget;
}

function updateTurrets(ctx: TickContext): void {
  const alarm = getAlarm(ctx.state);

  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'turret') {
      continue;
    }

    const turret = device;
    if (!turret.enabled) {
      continue;
    }

    const active = turret.alarmTrigger === 'ALWAYS' || alarm?.state === 'RED';
    if (!active) {
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

    if (distance(turret, target) > turret.range) {
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

    if (target.kind === 'drone') {
      const drone = getDevice(ctx.state, target.id, 'drone');
      if (drone?.alive) {
        drone.alive = false;
        drone.enabled = false;
        emit(ctx, 'DRONE_DESTROYED', 'combat', { droneId: drone.id, turretId: turret.id });
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

  if (ctx.state.tick >= ctx.tickLimit) {
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
    eventsThisTick: [],
    events,
    executedLines: [],
    nextEventId: 1,
  };

  while (ctx.state.outcome === 'running') {
    ctx.eventsThisTick = [];
    ctx.executedLines = [];

    applyScheduledScriptActions(ctx);
    updateDeviceTimers(ctx);
    updateDroneMovement(ctx);
    const detected = updateCameraDetection(ctx);
    updateAlarmBus(ctx, detected);
    updateTurrets(ctx);
    updatePlayerMovement(ctx);
    if (ctx.state.tick >= ctx.tickLimit) {
      emit(ctx, 'RUN_TIMEOUT', 'system', { tickLimit: ctx.tickLimit });
    }

    const frame = buildFrame(ctx.state, ctx.eventsThisTick, ctx.executedLines);
    frames.push(frame);
    events.push(...ctx.eventsThisTick);

    const done = checkWinLose(ctx);
    if (done) {
      break;
    }

    ctx.state.tick += 1;
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
