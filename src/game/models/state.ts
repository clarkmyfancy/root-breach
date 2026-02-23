import type {
  AttributionResult,
  Device,
  LevelDefinition,
  NodeRuntimeState,
  PlayerState,
  SimulationState,
} from './types';

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

function createInitialAttribution(): AttributionResult {
  return {
    suspectedActor: 'UNKNOWN',
    confidence: 0,
    actorScores: {
      OPERATOR: 0,
      UNKNOWN: 0,
    },
    reasons: [],
  };
}

function createInitialNodeRuntime(level: LevelDefinition): Record<string, NodeRuntimeState> {
  const nodes: Record<string, NodeRuntimeState> = {};
  for (const id of level.networkScope) {
    nodes[id] = {
      id,
      nodeType: level.devices.find((device) => device.id === id) ? 'DEVICE' : 'SYSTEM',
      accessState: 'VISIBLE',
      riskState: 'LOW',
      lastTouchedTick: -1,
      evidenceSurfacesTouched: [],
    };
  }
  return nodes;
}

export function createInitialSimulationState(level: LevelDefinition): SimulationState {
  const initialAttribution = createInitialAttribution();
  const initialAttributionCopy = createInitialAttribution();
  return {
    tick: 0,
    player: createInitialPlayer(level),
    devices: levelDevicesToMap(level),
    outcome: 'running',
    mission: {
      phase: 'PLANNING',
      objectiveCompleted: false,
      cleanupCompleted: false,
      cleanupRequired: false,
      cleanupDeadlineTick: null,
      trace: {
        progress: 0,
        ratePerTick: 0,
        lockRisk: 0,
        confidenceAgainstOperator: 0,
        sources: [],
        lockedOn: false,
        thresholdEventsFired: [],
        decoyBuffer: 0,
        relays: [],
      },
      evidence: [],
      nodes: createInitialNodeRuntime(level),
      attribution: initialAttribution,
      outcome: {
        status: 'RUNNING',
        objectivePassed: false,
        cleanupPassed: false,
        tracePassed: true,
        attributionPassed: true,
        failedRules: [],
        finalTrace: 0,
        finalAttribution: initialAttributionCopy,
        ruleChecks: [],
      },
      attributionTarget: null,
      identityState: 'GUEST',
      sessionRoute: [],
      detectedAtLeastOnce: false,
      objectiveFlags: {
        fileCopied: false,
        fileDeleted: false,
        recordAltered: false,
        sabotageDone: false,
        frameSet: false,
        exfilCommitted: false,
      },
    },
  };
}
