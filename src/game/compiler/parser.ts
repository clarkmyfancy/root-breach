import type { CompileError, ParsedCommand } from './scriptTypes';

function splitTopLevelArgs(source: string): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = 0;

  for (let idx = 0; idx < source.length; idx += 1) {
    const ch = source[idx];
    if (ch === '(' || ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth -= 1;
      if (depth < 0) {
        return null;
      }
      continue;
    }
    if (ch === ',' && depth === 0) {
      args.push(source.slice(start, idx).trim());
      start = idx + 1;
    }
  }

  if (depth !== 0) {
    return null;
  }

  args.push(source.slice(start).trim());
  return args;
}

function parseSetAim(raw: string, line: number): ParseLineResult | null {
  const match = raw.match(/^setAim\((.*)\)$/);
  if (!match) {
    return null;
  }

  const inner = match[1].trim();
  const args = splitTopLevelArgs(inner);
  if (!args || args.length !== 2 || !args[0] || !args[1]) {
    return {
      error: { line, message: 'Invalid setAim syntax. Expected: setAim(xExpr, yExpr)' },
    };
  }

  return {
    command: {
      line,
      raw,
      kind: 'turret.setAim',
      xExpr: args[0],
      yExpr: args[1],
    },
  };
}

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
    kind: 'camera.disable',
    regex: /^camera\("([A-Za-z0-9_:-]+)"\)\.disable\(\)$/,
    map: (m, line, raw) => ({ line, raw, kind: 'camera.disable', deviceId: m[1] }),
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

export interface ParseLineResult {
  command?: ParsedCommand;
  error?: CompileError;
}

export function parseLine(rawLine: string, line: number): ParseLineResult {
  const raw = rawLine.trim();
  if (!raw || raw.startsWith('//') || raw.startsWith('#')) {
    return {};
  }

  const setAimParsed = parseSetAim(raw, line);
  if (setAimParsed) {
    return setAimParsed;
  }

  const pattern = patterns.find((item) => item.regex.test(raw));
  if (!pattern) {
    return {
      error: { line, message: `Unrecognized command syntax: ${raw}` },
    };
  }

  const match = raw.match(pattern.regex);
  if (!match) {
    return {
      error: { line, message: `Unable to parse command: ${raw}` },
    };
  }

  return {
    command: pattern.map(match, line, raw),
  };
}

export function parseScript(source: string): ParseResult {
  const commands: ParsedCommand[] = [];
  const errors: CompileError[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((lineText, idx) => {
    const line = idx + 1;
    const parsed = parseLine(lineText, line);
    if (parsed.error) {
      errors.push(parsed.error);
      return;
    }
    if (parsed.command) {
      commands.push(parsed.command);
    }
  });

  return { commands, errors };
}
