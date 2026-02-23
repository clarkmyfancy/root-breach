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
    traceLockRisk: state.mission.trace.lockRisk,
    traceConfidenceAgainstOperator: state.mission.trace.confidenceAgainstOperator,
    traceSources: [...state.mission.trace.sources],
    missionNodes: Object.fromEntries(
      Object.entries(state.mission.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          evidenceSurfacesTouched: [...node.evidenceSurfacesTouched],
        },
      ]),
    ),
    attribution: {
      suspectedActor: state.mission.attribution.suspectedActor,
      confidence: state.mission.attribution.confidence,
      actorScores: { ...state.mission.attribution.actorScores },
      reasons: state.mission.attribution.reasons.map((reason) => ({ ...reason })),
    },
    missionOutcome: {
      ...state.mission.outcome,
      failedRules: [...state.mission.outcome.failedRules],
      ruleChecks: state.mission.outcome.ruleChecks.map((check) => ({ ...check })),
      finalAttribution: {
        suspectedActor: state.mission.outcome.finalAttribution.suspectedActor,
        confidence: state.mission.outcome.finalAttribution.confidence,
        actorScores: { ...state.mission.outcome.finalAttribution.actorScores },
        reasons: state.mission.outcome.finalAttribution.reasons.map((reason) => ({ ...reason })),
      },
    },
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
