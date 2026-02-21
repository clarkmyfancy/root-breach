export type DeviceType = 'camera' | 'turret' | 'drone' | 'door' | 'alarm' | 'terminal';
export type AlarmState = 'GREEN' | 'YELLOW' | 'RED';
export type Facing = 'up' | 'down' | 'left' | 'right';

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
  alarmTrigger: 'RED' | 'ALWAYS';
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
  suggestedScript?: string;
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
}
