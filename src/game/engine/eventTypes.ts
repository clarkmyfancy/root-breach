import type {
  AlarmState,
  Device,
  EvidenceRecord,
  MissionPhase,
  PlayerState,
  TraceSource,
} from '../models/types';

export type EventCategory =
  | 'script'
  | 'detection'
  | 'alarm'
  | 'combat'
  | 'movement'
  | 'system'
  | 'trace'
  | 'evidence'
  | 'objective'
  | 'mission';

export type EventType =
  | 'CAMERA_DETECTED_PLAYER'
  | 'ALARM_STATE_CHANGED'
  | 'SCRIPT_LINE_EXECUTED'
  | 'DEVICE_DISABLED'
  | 'DEVICE_ENABLED'
  | 'TURRET_RETARGETED'
  | 'DOOR_OPENED'
  | 'DOOR_CLOSED'
  | 'ALARM_DELAY_APPLIED'
  | 'DEVICE_TAGGED'
  | 'TRACE_SPOOFED'
  | 'TURRET_TARGET_LOCK'
  | 'TURRET_FIRED'
  | 'DRONE_DESTROYED'
  | 'PLAYER_BLOCKED_BY_DOOR'
  | 'PLAYER_KILLED'
  | 'PLAYER_REACHED_EXIT'
  | 'LOG'
  | 'RUN_TIMEOUT'
  | 'NODE_SCANNED'
  | 'DEVICE_SCANNED'
  | 'ROUTE_SCANNED'
  | 'LOG_SURFACE_PROBED'
  | 'ACCESS_BYPASS_APPLIED'
  | 'ACCESS_SPOOF_APPLIED'
  | 'ACCESS_TOKEN_REPLAYED'
  | 'FILE_COPIED'
  | 'FILE_DELETED'
  | 'RECORD_ALTERED'
  | 'DEVICE_SABOTAGED'
  | 'ROUTE_RELAY_APPLIED'
  | 'ROUTE_AGENT_SELECTED'
  | 'DECOY_BURST_APPLIED'
  | 'LOGS_SCRUBBED'
  | 'LOGS_FORGED'
  | 'LOGS_OVERWRITTEN'
  | 'EVIDENCE_FRAME_SET'
  | 'EVIDENCE_LOGGED'
  | 'EVIDENCE_ATTRIBUTION_SHIFTED'
  | 'TRACE_UPDATED'
  | 'TRACE_THRESHOLD_REACHED'
  | 'TRACE_MAXED'
  | 'MISSION_PHASE_CHANGED'
  | 'OBJECTIVE_PROGRESS'
  | 'OBJECTIVE_COMPLETED'
  | 'CLEANUP_COMPLETED'
  | 'CLEANUP_FAILED';

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
  missionPhase: MissionPhase;
  objectiveCompleted: boolean;
  cleanupCompleted: boolean;
  traceProgress: number;
  traceRatePerTick: number;
  traceLockedOn: boolean;
  traceSources: TraceSource[];
  evidence: EvidenceRecord[];
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
  objectiveStatus?: 'incomplete' | 'complete';
  cleanupStatus?: 'not_required' | 'pending' | 'complete' | 'failed';
  exposureCauses?: string[];
  attributionConclusion?: string;
}

export interface SimulationResult {
  frames: ReplayFrame[];
  events: EventRecord[];
  outcome: 'success' | 'failure';
  finalTick: number;
  tickLimit: number;
  failureSummary?: FailureSummary;
}
