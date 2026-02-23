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

interface StructuredAssignStatement {
  type: 'assign';
  line: number;
  variable: string;
  expression: string;
}

interface StructuredIncrementStatement {
  type: 'increment';
  line: number;
  variable: string;
}

interface StructuredIfStatement {
  type: 'if';
  line: number;
  condition: string;
  body: StructuredStatement[];
}

interface StructuredWhileStatement {
  type: 'while';
  line: number;
  condition: string;
  body: StructuredStatement[];
}

interface StructuredLoopStatement {
  type: 'loop';
  line: number;
  countExpr: string;
  body: StructuredStatement[];
}

type StructuredStatement =
  | StructuredLineStatement
  | StructuredAssignStatement
  | StructuredIncrementStatement
  | StructuredIfStatement
  | StructuredWhileStatement
  | StructuredLoopStatement;

const MAX_WHILE_ITERATIONS = 5000;

function isCommentOrEmpty(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#');
}

function parseBlockHeader(
  trimmed: string,
  keyword: 'while' | 'if' | 'loop',
): { expression: string; hasOpeningBrace: boolean } | null {
  const match = trimmed.match(new RegExp(`^${keyword}\\s*\\((.+)\\)\\s*(\\{)?$`));
  if (!match) {
    return null;
  }
  return {
    expression: match[1].trim(),
    hasOpeningBrace: Boolean(match[2]),
  };
}

function findBodyStart(lines: string[], index: number): { bodyStart?: number; error?: string } {
  let cursor = index;
  while (cursor < lines.length && isCommentOrEmpty(lines[cursor])) {
    cursor += 1;
  }

  if (cursor >= lines.length || lines[cursor].trim() !== '{') {
    return { error: 'Expected "{" to open block body' };
  }

  return { bodyStart: cursor + 1 };
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

    if (trimmed === '{') {
      errors.push({ line: lineNumber, message: 'Unexpected opening brace "{"' });
      idx += 1;
      continue;
    }

    const whileHeader = parseBlockHeader(trimmed, 'while');
    if (whileHeader) {
      const bodyStartResult = whileHeader.hasOpeningBrace ? { bodyStart: idx + 1 } : findBodyStart(lines, idx + 1);
      if (bodyStartResult.error || bodyStartResult.bodyStart === undefined) {
        errors.push({ line: lineNumber, message: bodyStartResult.error ?? 'Invalid while block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      const inner = parseStructuredBlock(lines, bodyStartResult.bodyStart, true);
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
        condition: whileHeader.expression,
        body: inner.statements,
      });
      idx = inner.nextIndex;
      continue;
    }

    const ifHeader = parseBlockHeader(trimmed, 'if');
    if (ifHeader) {
      const bodyStartResult = ifHeader.hasOpeningBrace ? { bodyStart: idx + 1 } : findBodyStart(lines, idx + 1);
      if (bodyStartResult.error || bodyStartResult.bodyStart === undefined) {
        errors.push({ line: lineNumber, message: bodyStartResult.error ?? 'Invalid if block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      const inner = parseStructuredBlock(lines, bodyStartResult.bodyStart, true);
      if (inner.errors.length) {
        errors.push(...inner.errors);
      }
      if (!inner.closed) {
        errors.push({ line: lineNumber, message: 'Missing closing brace for if block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      statements.push({
        type: 'if',
        line: lineNumber,
        condition: ifHeader.expression,
        body: inner.statements,
      });
      idx = inner.nextIndex;
      continue;
    }

    const loopHeader = parseBlockHeader(trimmed, 'loop');
    if (loopHeader) {
      const bodyStartResult = loopHeader.hasOpeningBrace ? { bodyStart: idx + 1 } : findBodyStart(lines, idx + 1);
      if (bodyStartResult.error || bodyStartResult.bodyStart === undefined) {
        errors.push({ line: lineNumber, message: bodyStartResult.error ?? 'Invalid loop block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      const inner = parseStructuredBlock(lines, bodyStartResult.bodyStart, true);
      if (inner.errors.length) {
        errors.push(...inner.errors);
      }
      if (!inner.closed) {
        errors.push({ line: lineNumber, message: 'Missing closing brace for loop block' });
        return {
          statements,
          nextIndex: lines.length,
          closed: false,
          errors,
        };
      }

      statements.push({
        type: 'loop',
        line: lineNumber,
        countExpr: loopHeader.expression,
        body: inner.statements,
      });
      idx = inner.nextIndex;
      continue;
    }

    const incrementMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\+\+$/);
    if (incrementMatch) {
      statements.push({
        type: 'increment',
        line: lineNumber,
        variable: incrementMatch[1],
      });
      idx += 1;
      continue;
    }

    const assignMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      statements.push({
        type: 'assign',
        line: lineNumber,
        variable: assignMatch[1],
        expression: assignMatch[2].trim(),
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

function createImplicitWaitCommand(line: number): ParsedCommand {
  return {
    line,
    raw: 'wait(1)',
    kind: 'wait',
    value: 1,
  };
}

function createFallbackAimContext(): NonNullable<ReturnType<typeof getTurretAimContext>> {
  return {
    intruderPosX: 0,
    intruderPosY: 0,
    numGuards: 0,
    guardPosX: [],
    guardPosY: [],
  };
}

function resolveNumericExpression(
  expression: string,
  level: LevelDefinition,
  locals: Record<string, number>,
): { value?: number; error?: string } {
  const context = getTurretAimContext(level) ?? createFallbackAimContext();
  const resolved = resolveAimExpression(expression.trim(), context, locals);
  if (resolved.error || resolved.value === undefined) {
    return { error: resolved.error ?? `Unsupported expression "${expression.trim()}"` };
  }

  return { value: resolved.value };
}

function evaluateCondition(
  condition: string,
  level: LevelDefinition,
  locals: Record<string, number>,
): { value?: boolean; error?: string } {
  const trimmed = condition.trim();

  if (/^true$/i.test(trimmed)) {
    return { value: true };
  }

  if (/^false$/i.test(trimmed)) {
    return { value: false };
  }

  const comparison = trimmed.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (comparison) {
    const left = resolveNumericExpression(comparison[1], level, locals);
    if (left.error || left.value === undefined) {
      return { error: left.error ?? 'Unable to resolve left operand' };
    }

    const right = resolveNumericExpression(comparison[3], level, locals);
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

  const operand = resolveNumericExpression(trimmed, level, locals);
  if (operand.error || operand.value === undefined) {
    return { error: operand.error ?? `Unsupported while condition "${trimmed}"` };
  }

  return { value: operand.value !== 0 };
}

interface ExpansionState {
  cursor: number;
  commands: ParsedCommand[];
  locals: Record<string, number>;
}

function snapshotLocals(locals: Record<string, number>): string {
  return JSON.stringify(locals, Object.keys(locals).sort());
}

function expressionReferencesLocals(expression: string, locals: Record<string, number>): boolean {
  const localNames = Object.keys(locals);
  return localNames.some((name) => {
    const pattern = new RegExp(`\\b${name}\\b`);
    return pattern.test(expression);
  });
}

function executeStructuredStatements(
  statements: StructuredStatement[],
  level: LevelDefinition,
  effectiveTickLimit: number,
  state: ExpansionState,
): CompileError | null {
  for (const statement of statements) {
    if (statement.type === 'line') {
      if (statement.command.kind === 'turret.setAim') {
        const xExpr = statement.command.xExpr ?? '';
        const yExpr = statement.command.yExpr ?? '';
        const shouldResolveLocals =
          expressionReferencesLocals(xExpr, state.locals) || expressionReferencesLocals(yExpr, state.locals);

        if (shouldResolveLocals) {
          const xResult = resolveNumericExpression(xExpr, level, state.locals);
          if (xResult.error || xResult.value === undefined) {
            return {
              line: statement.command.line,
              message: `Invalid x expression: ${xResult.error ?? xExpr}`,
            };
          }

          const yResult = resolveNumericExpression(yExpr, level, state.locals);
          if (yResult.error || yResult.value === undefined) {
            return {
              line: statement.command.line,
              message: `Invalid y expression: ${yResult.error ?? yExpr}`,
            };
          }

          const rewritten: ParsedCommand = {
            ...statement.command,
            xExpr: String(xResult.value),
            yExpr: String(yResult.value),
          };
          state.commands.push(rewritten);
          continue;
        }
      }

      state.commands.push(statement.command);
      if (statement.command.kind === 'wait') {
        state.cursor += statement.command.value ?? 0;
      }
      continue;
    }

    if (statement.type === 'assign') {
      const result = resolveNumericExpression(statement.expression, level, state.locals);
      if (result.error || result.value === undefined) {
        return {
          line: statement.line,
          message: `Invalid assignment expression: ${result.error ?? statement.expression}`,
        };
      }
      state.locals[statement.variable] = result.value;
      continue;
    }

    if (statement.type === 'increment') {
      const current = state.locals[statement.variable] ?? 0;
      state.locals[statement.variable] = current + 1;
      continue;
    }

    if (statement.type === 'if') {
      const condition = evaluateCondition(statement.condition, level, state.locals);
      if (condition.error || condition.value === undefined) {
        return {
          line: statement.line,
          message: `Invalid if condition: ${condition.error ?? statement.condition}`,
        };
      }

      if (!condition.value) {
        continue;
      }

      const innerError = executeStructuredStatements(statement.body, level, effectiveTickLimit, state);
      if (innerError) {
        return innerError;
      }
      continue;
    }

    if (statement.type === 'loop') {
      const countResult = resolveNumericExpression(statement.countExpr, level, state.locals);
      if (countResult.error || countResult.value === undefined) {
        return {
          line: statement.line,
          message: `Invalid loop count expression: ${countResult.error ?? statement.countExpr}`,
        };
      }

      if (!Number.isFinite(countResult.value) || countResult.value < 0 || !Number.isInteger(countResult.value)) {
        return {
          line: statement.line,
          message: `loop(count) requires a non-negative integer, received ${countResult.value}`,
        };
      }

      if (countResult.value > MAX_WHILE_ITERATIONS) {
        return {
          line: statement.line,
          message: `loop(count) exceeded max iteration budget (${MAX_WHILE_ITERATIONS})`,
        };
      }

      for (let idx = 0; idx < countResult.value; idx += 1) {
        const innerError = executeStructuredStatements(statement.body, level, effectiveTickLimit, state);
        if (innerError) {
          return innerError;
        }
      }
      continue;
    }

    const condition = evaluateCondition(statement.condition, level, state.locals);
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

      const conditionResult = evaluateCondition(statement.condition, level, state.locals);
      if (conditionResult.error || conditionResult.value === undefined) {
        return {
          line: statement.line,
          message: `Invalid while condition: ${conditionResult.error ?? statement.condition}`,
        };
      }
      if (!conditionResult.value) {
        break;
      }

      const cursorBefore = state.cursor;
      const commandCountBefore = state.commands.length;
      const localsBefore = snapshotLocals(state.locals);
      const bodyError = executeStructuredStatements(statement.body, level, effectiveTickLimit, state);
      if (bodyError) {
        return bodyError;
      }

      const addedCommands = state.commands.length > commandCountBefore;
      const advancedTime = state.cursor > cursorBefore;
      const localsChanged = localsBefore !== snapshotLocals(state.locals);

      if (!addedCommands && !advancedTime && !localsChanged) {
        return {
          line: statement.line,
          message: 'while loop body cannot be empty',
        };
      }

      if (!advancedTime && !localsChanged) {
        // Allow concise loops without explicit wait(n): advance by one tick implicitly.
        state.commands.push(createImplicitWaitCommand(statement.line));
        state.cursor += 1;
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
    locals: {},
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
