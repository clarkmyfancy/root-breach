import type { Device, LevelDefinition, PlayerState, SimulationState } from './types';

export function cloneDevice<T extends Device>(device: T): T {
  return JSON.parse(JSON.stringify(device)) as T;
}

export function cloneDeviceMap(devices: Record<string, Device>): Record<string, Device> {
  const next: Record<string, Device> = {};
  for (const [id, device] of Object.entries(devices)) {
    next[id] = cloneDevice(device);
  }
  return next;
}

export function levelDevicesToMap(level: LevelDefinition): Record<string, Device> {
  const map: Record<string, Device> = {};
  for (const device of level.devices) {
    map[device.id] = cloneDevice(device);
  }
  return map;
}

export function createInitialPlayer(level: LevelDefinition): PlayerState {
  return {
    x: level.entry.x,
    y: level.entry.y,
    pathIndex: 0,
    alive: true,
    reachedExit: false,
    blockedByDoorId: null,
  };
}

export function createInitialSimulationState(level: LevelDefinition): SimulationState {
  return {
    tick: 0,
    player: createInitialPlayer(level),
    devices: levelDevicesToMap(level),
    outcome: 'running',
  };
}
