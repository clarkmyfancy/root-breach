export type CommandKind =
  | 'scan.node'
  | 'scan.device'
  | 'scan.route'
  | 'probe.logs'
  | 'access.door.bypass'
  | 'access.terminal.spoof'
  | 'access.auth.replayToken'
  | 'camera.disable'
  | 'camera.enable'
  | 'alarm.delay'
  | 'door.open'
  | 'door.close'
  | 'turret.retarget'
  | 'device.tag'
  | 'file.copy'
  | 'file.delete'
  | 'record.alter'
  | 'device.sabotage'
  | 'trace.spoof'
  | 'route.relay'
  | 'route.agent'
  | 'decoy.burst'
  | 'logs.scrub'
  | 'logs.forge'
  | 'logs.overwrite'
  | 'evidence.frame'
  | 'identity.assume'
  | 'narrative.ticket'
  | 'wait'
  | 'log';

export interface ParsedCommand {
  line: number;
  raw: string;
  kind: CommandKind;
  deviceId?: string;
  targetId?: string;
  textArg?: string;
  extraTextArg?: string;
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
  extraTextArg?: string;
  value?: number;
}

export interface CompileResult {
  commands: CompiledCommand[];
  errors: CompileError[];
}
