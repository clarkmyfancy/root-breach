export type DeviceType = 'camera' | 'turret' | 'drone' | 'door' | 'alarm' | 'terminal';
export type AlarmState = 'GREEN' | 'YELLOW' | 'RED';
export type Facing = 'up' | 'down' | 'left' | 'right';
export type MissionPhase = 'PLANNING' | 'OBJECTIVE' | 'CLEANUP' | 'COMPLETE' | 'FAILED';
export type EvidenceSurface = 'NETFLOW' | 'AUTH' | 'DEVICE' | 'FILE_AUDIT' | 'ALARM' | 'PROCESS';
export type NodeType = 'DEVICE' | 'AUTH' | 'FILE' | 'RECORD' | 'ROUTE' | 'SYSTEM';
export type NodeAccessState = 'UNKNOWN' | 'VISIBLE' | 'SCANNED' | 'CONTROLLED';
export type NodeRiskState = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Point {
  x: number;
  y: number;
}

export interface BaseDevice {
  id: string;
  type: DeviceType;
  x: number;
  y: number;
  enabled: boolean;
  tag?: string;
}

export interface CameraDevice extends BaseDevice {
  type: 'camera';
  range: number;
  facing: Facing;
  disabledUntilTick: number | null;
}

export interface TurretDevice extends BaseDevice {
  type: 'turret';
  range: number;
  lockDelay: number;
  alarmTrigger: 'RED' | 'ALWAYS' | 'DETECTION';
  desiredTargetId: string | null;
  currentTargetId: string | null;
  lockTicks: number;
}

export interface DroneDevice extends BaseDevice {
  type: 'drone';
  path: Point[];
  pathIndex: number;
  stepInterval: number;
  stepTimer: number;
  alive: boolean;
}

export interface DoorDevice extends BaseDevice {
  type: 'door';
  isOpen: boolean;
  closesOnAlarmRed?: boolean;
}

export interface AlarmDevice extends BaseDevice {
  type: 'alarm';
  state: AlarmState;
  baseEscalationTicks: number;
  redAtTick: number | null;
  manualDelayBuffer: number;
}

export interface TerminalDevice extends BaseDevice {
  type: 'terminal';
}

export type Device =
  | CameraDevice
  | TurretDevice
  | DroneDevice
  | DoorDevice
  | AlarmDevice
  | TerminalDevice;

export interface LevelConstraints {
  tickLimit: number;
}

export interface LevelMap {
  width: number;
  height: number;
  walls: Point[];
}

export interface LevelDefinition {
  id: string;
  name: string;
  brief: string;
  map: LevelMap;
  entry: Point;
  exit: Point;
  playerPath: Point[];
  devices: Device[];
  networkScope: string[];
  constraints: LevelConstraints;
}

export interface PlayerState {
  x: number;
  y: number;
  pathIndex: number;
  alive: boolean;
  reachedExit: boolean;
  blockedByDoorId: string | null;
}

export interface SimulationState {
  tick: number;
  player: PlayerState;
  devices: Record<string, Device>;
  outcome: 'running' | 'success' | 'failure';
  mission: MissionState;
}

export interface TraceSource {
  id: string;
  label: string;
  delta: number;
}

export interface TraceState {
  progress: number;
  ratePerTick: number;
  lockRisk: number;
  confidenceAgainstOperator: number;
  sources: TraceSource[];
  lockedOn: boolean;
  thresholdEventsFired: number[];
  decoyBuffer: number;
  relays: string[];
}

export interface EvidenceRecord {
  id: string;
  tick: number;
  surface: EvidenceSurface;
  siteNodeId: string;
  severity: 1 | 2 | 3;
  signature: string;
  attributedTo?: string;
  hidden?: boolean;
  scrubbed?: boolean;
  forged?: boolean;
}

export interface MissionObjectiveFlags {
  fileCopied: boolean;
  fileDeleted: boolean;
  recordAltered: boolean;
  sabotageDone: boolean;
  frameSet: boolean;
  exfilCommitted: boolean;
}

export interface NodeRuntimeState {
  id: string;
  nodeType: NodeType;
  accessState: NodeAccessState;
  riskState: NodeRiskState;
  lastTouchedTick: number;
  evidenceSurfacesTouched: EvidenceSurface[];
}

export interface AttributionReason {
  label: string;
  weight: number;
}

export interface AttributionResult {
  suspectedActor: string;
  confidence: number;
  actorScores: Record<string, number>;
  reasons: AttributionReason[];
}

export interface MissionRuleCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface MissionOutcomeState {
  status: 'RUNNING' | 'SUCCESS' | 'FAILURE';
  objectivePassed: boolean;
  cleanupPassed: boolean;
  tracePassed: boolean;
  attributionPassed: boolean;
  failedRules: string[];
  finalTrace: number;
  finalAttribution: AttributionResult;
  ruleChecks: MissionRuleCheck[];
}

export interface MissionState {
  phase: MissionPhase;
  objectiveCompleted: boolean;
  cleanupCompleted: boolean;
  cleanupRequired: boolean;
  cleanupDeadlineTick: number | null;
  trace: TraceState;
  evidence: EvidenceRecord[];
  nodes: Record<string, NodeRuntimeState>;
  attribution: AttributionResult;
  outcome: MissionOutcomeState;
  attributionTarget: string | null;
  identityState: string;
  sessionRoute: string[];
  detectedAtLeastOnce: boolean;
  objectiveFlags: MissionObjectiveFlags;
}
