import type { AlarmState, Device, PlayerState } from '../models/types';

export type EventCategory = 'script' | 'detection' | 'alarm' | 'combat' | 'movement' | 'system';

export type EventType =
  | 'CAMERA_DETECTED_PLAYER'
  | 'ALARM_STATE_CHANGED'
  | 'ALARM_TRIGGERED'
  | 'SCRIPT_LINE_EXECUTED'
  | 'DEVICE_DISABLED'
  | 'DEVICE_ENABLED'
  | 'GENERATOR_OVERCLOCKED'
  | 'GENERATOR_BURNT_OUT'
  | 'TURRET_RETARGETED'
  | 'DOOR_OPENED'
  | 'DOOR_CLOSED'
  | 'ALARM_DELAY_APPLIED'
  | 'DEVICE_TAGGED'
  | 'TURRET_TARGET_LOCK'
  | 'TURRET_FIRED'
  | 'DRONE_DESTROYED'
  | 'GUARD_NEUTRALIZED'
  | 'PLAYER_SPOTTED_BY_GUARD'
  | 'PLAYER_CAUGHT_BY_DRONE'
  | 'PLAYER_CAUGHT_BY_GUARD'
  | 'PLAYER_BLOCKED_BY_DOOR'
  | 'PLAYER_KILLED'
  | 'PLAYER_REACHED_EXIT'
  | 'LOG'
  | 'RUN_TIMEOUT';

export interface EventRecord {
  id: number;
  tick: number;
  type: EventType;
  category: EventCategory;
  line?: number;
  payload: Record<string, string | number | boolean | null>;
}

export interface SimulationSnapshot {
  tick: number;
  player: PlayerState;
  devices: Record<string, Device>;
  alarmState: AlarmState;
}

export interface ReplayFrame {
  tick: number;
  snapshot: SimulationSnapshot;
  events: EventRecord[];
  executedLines: number[];
}

export interface FailureSummary {
  primaryCause: string;
  causeChain: string[];
  suggestedFocus: string;
}

export interface SimulationResult {
  frames: ReplayFrame[];
  events: EventRecord[];
  outcome: 'success' | 'failure';
  finalTick: number;
  tickLimit: number;
  failureSummary?: FailureSummary;
}
