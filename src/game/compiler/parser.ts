import type { CompileError, ParsedCommand } from './scriptTypes';

const patterns: Array<{
  kind: ParsedCommand['kind'];
  regex: RegExp;
  map: (m: RegExpMatchArray, line: number, raw: string) => ParsedCommand;
}> = [
  {
    kind: 'camera.disable',
    regex: /^camera\("([A-Za-z0-9_:-]+)"\)\.disable\((\d+)\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'camera.disable', deviceId: m[1], value: Number(m[2]) }),
  },
  {
    kind: 'camera.enable',
    regex: /^camera\("([A-Za-z0-9_:-]+)"\)\.enable\(\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'camera.enable', deviceId: m[1] }),
  },
  {
    kind: 'alarm.delay',
    regex: /^alarm\(\)\.delay\((\d+)\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'alarm.delay', value: Number(m[1]) }),
  },
  {
    kind: 'door.open',
    regex: /^door\("([A-Za-z0-9_:-]+)"\)\.open\(\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'door.open', deviceId: m[1] }),
  },
  {
    kind: 'door.close',
    regex: /^door\("([A-Za-z0-9_:-]+)"\)\.close\(\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'door.close', deviceId: m[1] }),
  },
  {
    kind: 'turret.retarget',
    regex: /^turret\("([A-Za-z0-9_:-]+)"\)\.retarget\("([A-Za-z0-9_:-]+)"\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'turret.retarget', deviceId: m[1], targetId: m[2] }),
  },
  {
    kind: 'device.tag',
    regex: /^device\("([A-Za-z0-9_:-]+)"\)\.tag\("([A-Za-z0-9_:-]+)"\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'device.tag', deviceId: m[1], textArg: m[2] }),
  },
  {
    kind: 'wait',
    regex: /^wait\((\d+)\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'wait', value: Number(m[1]) }),
  },
  {
    kind: 'log',
    regex: /^log\("([^"]*)"\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'log', textArg: m[1] }),
  },
];

export interface ParseResult {
  commands: ParsedCommand[];
  errors: CompileError[];
}

export function parseScript(source: string): ParseResult {
  const commands: ParsedCommand[] = [];
  const errors: CompileError[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((lineText, idx) => {
    const line = idx + 1;
    const raw = lineText.trim();

    if (!raw || raw.startsWith('//') || raw.startsWith('#')) {
      return;
    }

    const pattern = patterns.find((item) => item.regex.test(raw));
    if (!pattern) {
      errors.push({ line, message: `Unrecognized command syntax: ${raw}` });
      return;
    }

    const match = raw.match(pattern.regex);
    if (!match) {
      errors.push({ line, message: `Unable to parse command: ${raw}` });
      return;
    }

    commands.push(pattern.map(match, line, raw));
  });

  return { commands, errors };
}
