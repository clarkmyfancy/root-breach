import { cloneDeviceMap } from '../models/state';
import type { AlarmState, SimulationState } from '../models/types';
import type { ReplayFrame, SimulationSnapshot } from './eventTypes';

export function getAlarmStateFromDevices(state: SimulationState): AlarmState {
  const alarm = Object.values(state.devices).find((device) => device.type === 'alarm');
  if (!alarm || alarm.type !== 'alarm') {
    return 'GREEN';
  }
  return alarm.state;
}

export function buildSnapshot(state: SimulationState): SimulationSnapshot {
  return {
    tick: state.tick,
    player: { ...state.player },
    devices: cloneDeviceMap(state.devices),
    alarmState: getAlarmStateFromDevices(state),
    missionPhase: state.mission.phase,
    objectiveCompleted: state.mission.objectiveCompleted,
    cleanupCompleted: state.mission.cleanupCompleted,
    traceProgress: state.mission.trace.progress,
    traceRatePerTick: state.mission.trace.ratePerTick,
    traceLockedOn: state.mission.trace.lockedOn,
    traceSources: [...state.mission.trace.sources],
    evidence: state.mission.evidence.map((record) => ({ ...record })),
  };
}

export function buildFrame(state: SimulationState, events: ReplayFrame['events'], executedLines: number[]): ReplayFrame {
  return {
    tick: state.tick,
    snapshot: buildSnapshot(state),
    events: [...events],
    executedLines: [...executedLines],
  };
}
