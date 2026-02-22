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
  unlocksCommands: string[];
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
    unlocksCommands: ['camera.disable', 'camera.enable', 'door.open', 'door.close', 'wait', 'log'],
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
    description: 'Inject timing delays into visible alarm buses.',
  },
  {
    id: 'tool_target_redirector',
    category: 'CONTROL',
    name: 'Target Redirector',
    tier: 2,
    cost: 550,
    repRequired: 2,
    unlocksCommands: ['turret.retarget', 'device.tag'],
    description: 'Retarget hostile emplacements and annotate live nodes.',
  },
  {
    id: 'tool_mask_spoofer',
    category: 'MASK',
    name: 'Mask Spoofer',
    tier: 2,
    cost: 700,
    repRequired: 3,
    unlocksCommands: ['trace.spoof'],
    description: 'Emit synthetic signatures to distort trace attribution.',
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
  'door.open': 'tool_core_control',
  'door.close': 'tool_core_control',
  wait: 'tool_core_control',
  log: 'tool_core_control',
  'alarm.delay': 'tool_alarm_link',
  'turret.retarget': 'tool_target_redirector',
  'device.tag': 'tool_target_redirector',
  'trace.spoof': 'tool_mask_spoofer',
};
