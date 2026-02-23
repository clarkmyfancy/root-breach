import type { LevelDefinition } from '../models/types';
import { GLOBAL_TICK_LIMIT } from '../engine/constants';
import { parseLine } from './parser';
import type { CompiledCommand, CompileError, CompileResult, ParsedCommand } from './scriptTypes';
import { getTurretAimContext, resolveAimExpression } from './turretAim';
import { validateParsedScript } from './validator';

interface StructuredLineStatement {
  type: 'line';
  command: ParsedCommand;
}

interface StructuredWhileStatement {
  type: 'while';
  line: number;
  condition: string;
  body: StructuredStatement[];
}

type StructuredStatement = StructuredLineStatement | StructuredWhileStatement;

const MAX_WHILE_ITERATIONS = 5000;

function isCommentOrEmpty(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#');
}

function parseStructuredBlock(
  lines: string[],
  startIndex: number,
  expectClosingBrace: boolean,
): {
  statements: StructuredStatement[];
  nextIndex: number;
  closed: boolean;
  errors: CompileError[];
} {
  const statements: StructuredStatement[] = [];
  const errors: CompileError[] = [];
  let idx = startIndex;

  while (idx < lines.length) {
    const rawLine = lines[idx];
    const lineNumber = idx + 1;
    const trimmed = rawLine.trim();

    if (isCommentOrEmpty(rawLine)) {
      idx += 1;
      continue;
    }

    if (trimmed === '}') {
      if (!expectClosingBrace) {
        errors.push({ line: lineNumber, message: 'Unexpected closing brace "}"' });
        idx += 1;
        continue;
      }

      return {
        statements,
        nextIndex: idx + 1,
        closed: true,
        errors,
      };
    }

    const whileMatch = trimmed.match(/^while\s*\((.+)\)\s*\{$/);
    if (whileMatch) {
      const condition = whileMatch[1].trim();
      const inner = parseStructuredBlock(lines, idx + 1, true);
      if (inner.errors.length) {
        errors.push(...inner.errors);
      }
      if (!inner.closed) {
        errors.push({ line: lineNumber, message: 'Missing closing brace for while block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      statements.push({
        type: 'while',
        line: lineNumber,
        condition,
        body: inner.statements,
      });
      idx = inner.nextIndex;
      continue;
    }

    if (trimmed.includes('{') || trimmed.includes('}')) {
      errors.push({
        line: lineNumber,
        message: 'Unsupported brace syntax. Use: while (<condition>) { ... }',
      });
      idx += 1;
      continue;
    }

    const parsed = parseLine(rawLine, lineNumber);
    if (parsed.error) {
      errors.push(parsed.error);
      idx += 1;
      continue;
    }

    if (!parsed.command) {
      idx += 1;
      continue;
    }

    statements.push({
      type: 'line',
      command: parsed.command,
    });
    idx += 1;
  }

  return {
    statements,
    nextIndex: idx,
    closed: !expectClosingBrace,
    errors,
  };
}

function parseStructuredSource(source: string): { statements: StructuredStatement[]; errors: CompileError[] } {
  const lines = source.split(/\r?\n/);
  const parsed = parseStructuredBlock(lines, 0, false);
  return {
    statements: parsed.statements,
    errors: parsed.errors,
  };
}

function resolveConditionOperand(token: string, level: LevelDefinition): { value?: number; error?: string } {
  const trimmed = token.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return { value: Number(trimmed) };
  }

  const context = getTurretAimContext(level);
  if (!context) {
    return { error: `Unsupported condition operand "${trimmed}"` };
  }

  const resolved = resolveAimExpression(trimmed, context);
  if (resolved.error || resolved.value === undefined) {
    return { error: resolved.error ?? `Unsupported condition operand "${trimmed}"` };
  }

  return { value: resolved.value };
}

function evaluateWhileCondition(condition: string, level: LevelDefinition): { value?: boolean; error?: string } {
  const trimmed = condition.trim();

  if (/^true$/i.test(trimmed)) {
    return { value: true };
  }

  if (/^false$/i.test(trimmed)) {
    return { value: false };
  }

  const comparison = trimmed.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (comparison) {
    const left = resolveConditionOperand(comparison[1], level);
    if (left.error || left.value === undefined) {
      return { error: left.error ?? 'Unable to resolve left operand' };
    }

    const right = resolveConditionOperand(comparison[3], level);
    if (right.error || right.value === undefined) {
      return { error: right.error ?? 'Unable to resolve right operand' };
    }

    const operator = comparison[2];
    const lhs = left.value;
    const rhs = right.value;
    switch (operator) {
      case '==':
        return { value: lhs === rhs };
      case '!=':
        return { value: lhs !== rhs };
      case '<=':
        return { value: lhs <= rhs };
      case '>=':
        return { value: lhs >= rhs };
      case '<':
        return { value: lhs < rhs };
      case '>':
        return { value: lhs > rhs };
      default:
        return { error: `Unsupported condition operator "${operator}"` };
    }
  }

  const operand = resolveConditionOperand(trimmed, level);
  if (operand.error || operand.value === undefined) {
    return { error: operand.error ?? `Unsupported while condition "${trimmed}"` };
  }

  return { value: operand.value !== 0 };
}

interface ExpansionState {
  cursor: number;
  commands: ParsedCommand[];
}

function executeStructuredStatements(
  statements: StructuredStatement[],
  level: LevelDefinition,
  effectiveTickLimit: number,
  state: ExpansionState,
): CompileError | null {
  for (const statement of statements) {
    if (statement.type === 'line') {
      state.commands.push(statement.command);
      if (statement.command.kind === 'wait') {
        state.cursor += statement.command.value ?? 0;
      }
      continue;
    }

    const condition = evaluateWhileCondition(statement.condition, level);
    if (condition.error || condition.value === undefined) {
      return {
        line: statement.line,
        message: `Invalid while condition: ${condition.error ?? statement.condition}`,
      };
    }

    if (!condition.value) {
      continue;
    }

    let iterations = 0;
    while (state.cursor < effectiveTickLimit) {
      if (iterations >= MAX_WHILE_ITERATIONS) {
        return {
          line: statement.line,
          message: `while loop exceeded max iteration budget (${MAX_WHILE_ITERATIONS})`,
        };
      }
      iterations += 1;

      const cursorBefore = state.cursor;
      const commandCountBefore = state.commands.length;
      const bodyError = executeStructuredStatements(statement.body, level, effectiveTickLimit, state);
      if (bodyError) {
        return bodyError;
      }

      const addedCommands = state.commands.length > commandCountBefore;
      const advancedTime = state.cursor > cursorBefore;
      if (!addedCommands && !advancedTime) {
        return {
          line: statement.line,
          message: 'while loop body cannot be empty',
        };
      }

      if (!advancedTime) {
        return {
          line: statement.line,
          message: 'while loop must advance time with wait(n)',
        };
      }
    }
  }

  return null;
}

function expandWithWhileLoops(
  source: string,
  level: LevelDefinition,
  effectiveTickLimit: number,
): { commands: ParsedCommand[]; errors: CompileError[] } {
  const structured = parseStructuredSource(source);
  if (structured.errors.length) {
    return { commands: [], errors: structured.errors };
  }

  const state: ExpansionState = {
    cursor: 0,
    commands: [],
  };

  const expansionError = executeStructuredStatements(structured.statements, level, effectiveTickLimit, state);
  if (expansionError) {
    return {
      commands: [],
      errors: [expansionError],
    };
  }

  return {
    commands: state.commands,
    errors: [],
  };
}

function scheduleCommands(
  commands: ParsedCommand[],
  level: LevelDefinition,
): { commands: CompiledCommand[]; errors: CompileResult['errors'] } {
  const scheduled: CompiledCommand[] = [];
  let cursor = 0;
  const turretAimContext = getTurretAimContext(level);

  for (const command of commands) {
    let xValue: number | undefined;
    let yValue: number | undefined;

    if (command.kind === 'turret.setAim') {
      if (!turretAimContext) {
        return {
          commands: [],
          errors: [{ line: command.line, message: 'setAim(x, y) requires turret challenge context' }],
        };
      }

      const xResult = resolveAimExpression(command.xExpr ?? '', turretAimContext);
      if (xResult.error || xResult.value === undefined) {
        return {
          commands: [],
          errors: [{ line: command.line, message: `Invalid x expression: ${xResult.error ?? 'unknown error'}` }],
        };
      }

      const yResult = resolveAimExpression(command.yExpr ?? '', turretAimContext);
      if (yResult.error || yResult.value === undefined) {
        return {
          commands: [],
          errors: [{ line: command.line, message: `Invalid y expression: ${yResult.error ?? 'unknown error'}` }],
        };
      }

      xValue = xResult.value;
      yValue = yResult.value;
    }

    scheduled.push({
      tick: cursor,
      line: command.line,
      kind: command.kind,
      raw: command.raw,
      deviceId: command.deviceId,
      targetId: command.targetId,
      textArg: command.textArg,
      value: command.value,
      xExpr: command.xExpr,
      yExpr: command.yExpr,
      xValue,
      yValue,
    });

    if (command.kind === 'wait') {
      cursor += command.value ?? 0;
    }
  }

  return { commands: scheduled, errors: [] };
}

export function compileScript(source: string, level: LevelDefinition): CompileResult {
  const effectiveTickLimit = Math.min(level.constraints.tickLimit, GLOBAL_TICK_LIMIT);
  const expanded = expandWithWhileLoops(source, level, effectiveTickLimit);
  if (expanded.errors.length) {
    return { commands: [], errors: expanded.errors };
  }

  const validationErrors = validateParsedScript(level, expanded.commands);
  if (validationErrors.length) {
    return { commands: [], errors: validationErrors };
  }

  const scheduledResult = scheduleCommands(expanded.commands, level);
  if (scheduledResult.errors.length) {
    return { commands: [], errors: scheduledResult.errors };
  }

  const scheduled = scheduledResult.commands;
  const outOfRange = scheduled.find((command) => command.tick >= effectiveTickLimit);

  if (outOfRange) {
    return {
      commands: [],
      errors: [
        {
          line: outOfRange.line,
          message: `Command is scheduled at tick ${outOfRange.tick}, outside run range [0, ${effectiveTickLimit})`,
        },
      ],
    };
  }

  return { commands: scheduled, errors: [] };
}
