import type { CommandKind } from '../compiler/scriptTypes';

export interface ToolOwnedState {
  owned: boolean;
  tier: 1 | 2 | 3 | 4;
}

export interface ToolDefinition {
  id: string;
  category: 'PROBE' | 'ACCESS' | 'CONTROL' | 'PAYLOAD' | 'MASK' | 'SCRUB' | 'AUTO';
  name: string;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  repRequired: number;
  unlocksCommands: CommandKind[];
  description: string;
}

export const toolCatalog: ToolDefinition[] = [
  {
    id: 'tool_core_control',
    category: 'CONTROL',
    name: 'Core Control Suite',
    tier: 1,
    cost: 0,
    repRequired: 0,
    unlocksCommands: [
      'camera.disable',
      'camera.enable',
      'door.open',
      'door.close',
      'device.tag',
      'wait',
      'log',
    ],
    description: 'Baseline actuator control and scheduler operations.',
  },
  {
    id: 'tool_alarm_link',
    category: 'CONTROL',
    name: 'Alarm Link Bridge',
    tier: 1,
    cost: 300,
    repRequired: 1,
    unlocksCommands: ['alarm.delay'],
    description: 'Inject timing delays into alarm escalation channels.',
  },
  {
    id: 'tool_target_redirector',
    category: 'CONTROL',
    name: 'Target Redirector',
    tier: 2,
    cost: 620,
    repRequired: 2,
    unlocksCommands: ['turret.retarget'],
    description: 'Override turret target selection and redirect engagements.',
  },
  {
    id: 'tool_probe_kit',
    category: 'PROBE',
    name: 'Probe Kit',
    tier: 1,
    cost: 350,
    repRequired: 1,
    unlocksCommands: ['scan.node', 'scan.device', 'scan.route', 'probe.logs'],
    description: 'Recon and topology inspection tools for mapping and log probes.',
  },
  {
    id: 'tool_access_spoof',
    category: 'ACCESS',
    name: 'Access Spoof Pack',
    tier: 2,
    cost: 700,
    repRequired: 2,
    unlocksCommands: ['access.door.bypass', 'access.terminal.spoof', 'access.auth.replayToken'],
    description: 'Credential replay and terminal spoof workflows.',
  },
  {
    id: 'tool_payload_ops',
    category: 'PAYLOAD',
    name: 'Payload Ops Suite',
    tier: 2,
    cost: 780,
    repRequired: 3,
    unlocksCommands: ['file.copy', 'file.delete', 'record.alter', 'device.sabotage'],
    description: 'Contract objective actions across files, records, and physical systems.',
  },
  {
    id: 'tool_mask_spoofer',
    category: 'MASK',
    name: 'Mask Spoofer',
    tier: 3,
    cost: 1200,
    repRequired: 4,
    unlocksCommands: ['trace.spoof', 'route.relay', 'route.agent', 'decoy.burst'],
    description: 'Signature spoofing, traffic relays, and decoy bursts to shape trace behavior.',
  },
  {
    id: 'tool_scrub_suite',
    category: 'SCRUB',
    name: 'Forensics Scrub Suite',
    tier: 3,
    cost: 1500,
    repRequired: 5,
    unlocksCommands: ['logs.scrub', 'logs.forge', 'logs.overwrite', 'evidence.frame'],
    description: 'Counter-forensics and attribution redirection workflows.',
  },
];

export const toolById: Record<string, ToolDefinition> = toolCatalog.reduce<Record<string, ToolDefinition>>((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {});

export const starterToolIds = ['tool_core_control'];

export const commandToolRequirements: Partial<Record<CommandKind, string>> = {
  'camera.disable': 'tool_core_control',
  'camera.enable': 'tool_core_control',
  'alarm.delay': 'tool_alarm_link',
  'door.open': 'tool_core_control',
  'door.close': 'tool_core_control',
  'turret.retarget': 'tool_target_redirector',
  'device.tag': 'tool_core_control',
  wait: 'tool_core_control',
  log: 'tool_core_control',
  'scan.node': 'tool_probe_kit',
  'scan.device': 'tool_probe_kit',
  'scan.route': 'tool_probe_kit',
  'probe.logs': 'tool_probe_kit',
  'access.door.bypass': 'tool_access_spoof',
  'access.terminal.spoof': 'tool_access_spoof',
  'access.auth.replayToken': 'tool_access_spoof',
  'file.copy': 'tool_payload_ops',
  'file.delete': 'tool_payload_ops',
  'record.alter': 'tool_payload_ops',
  'device.sabotage': 'tool_payload_ops',
  'trace.spoof': 'tool_mask_spoofer',
  'route.relay': 'tool_mask_spoofer',
  'route.agent': 'tool_mask_spoofer',
  'decoy.burst': 'tool_mask_spoofer',
  'logs.scrub': 'tool_scrub_suite',
  'logs.forge': 'tool_scrub_suite',
  'logs.overwrite': 'tool_scrub_suite',
  'evidence.frame': 'tool_scrub_suite',
};
