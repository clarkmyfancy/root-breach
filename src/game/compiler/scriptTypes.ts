export type CommandKind =
  | 'camera.disable'
  | 'camera.enable'
  | 'alarm.delay'
  | 'door.open'
  | 'door.close'
  | 'turret.retarget'
  | 'device.tag'
  | 'wait'
  | 'log';

export interface ParsedCommand {
  line: number;
  raw: string;
  kind: CommandKind;
  deviceId?: string;
  targetId?: string;
  textArg?: string;
  value?: number;
}

export interface CompileError {
  line: number;
  message: string;
}

export interface CompiledCommand {
  tick: number;
  line: number;
  kind: CommandKind;
  raw: string;
  deviceId?: string;
  targetId?: string;
  textArg?: string;
  value?: number;
}

export interface CompileResult {
  commands: CompiledCommand[];
  errors: CompileError[];
}
