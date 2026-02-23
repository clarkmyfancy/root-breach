import type { LevelDefinition } from '../models/types';

export interface TurretAimContext {
  intruderPosX: number;
  intruderPosY: number;
  numGuards: number;
  guardPosX: number[];
  guardPosY: number[];
}

export function getTurretAimContext(level: LevelDefinition): TurretAimContext | null {
  const turret = level.devices.find((device) => device.type === 'turret');
  if (!turret || turret.type !== 'turret') {
    return null;
  }

  const guards = level.devices.filter((device) => device.type === 'drone');
  return {
    intruderPosX: level.entry.x - turret.x,
    intruderPosY: level.entry.y - turret.y,
    numGuards: guards.length,
    guardPosX: guards.map((guard) => guard.x - turret.x),
    guardPosY: guards.map((guard) => guard.y - turret.y),
  };
}

class ExpressionParser {
  private pos = 0;

  constructor(
    private readonly source: string,
    private readonly context: TurretAimContext,
    private readonly locals: Record<string, number>,
  ) {}

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token "${this.peek()}"`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.consumeIf('+')) {
        value += this.parseTerm();
        continue;
      }
      if (this.consumeIf('-')) {
        value -= this.parseTerm();
        continue;
      }
      return value;
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      if (this.consumeIf('*')) {
        value *= this.parseUnary();
        continue;
      }
      if (this.consumeIf('/')) {
        const divisor = this.parseUnary();
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        value /= divisor;
        continue;
      }
      return value;
    }
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.consumeIf('+')) {
      return this.parseUnary();
    }
    if (this.consumeIf('-')) {
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.consumeIf('(')) {
      const value = this.parseExpression();
      this.skipWhitespace();
      this.expect(')');
      return value;
    }

    if (this.isNumberStart(this.peek())) {
      return this.parseNumber();
    }

    const identifier = this.parseIdentifier();
    if (!identifier) {
      throw new Error('Expected a number, identifier, or "("');
    }

    if (identifier === 'sqrt') {
      this.skipWhitespace();
      this.expect('(');
      const arg = this.parseExpression();
      this.skipWhitespace();
      this.expect(')');
      if (arg < 0) {
        throw new Error('sqrt() requires a non-negative value');
      }
      return Math.sqrt(arg);
    }

    if (identifier === 'intruderPosX') {
      return this.context.intruderPosX;
    }
    if (identifier === 'intruderPosY') {
      return this.context.intruderPosY;
    }
    if (identifier === 'numGuards') {
      return this.context.numGuards;
    }

    if (identifier === 'guardPosX' || identifier === 'guardPosY') {
      this.skipWhitespace();
      this.expect('[');
      const rawIndex = this.parseExpression();
      this.skipWhitespace();
      this.expect(']');
      if (!Number.isInteger(rawIndex)) {
        throw new Error(`${identifier} index ${rawIndex} must be an integer`);
      }

      const index = rawIndex;
      const source = identifier === 'guardPosX' ? this.context.guardPosX : this.context.guardPosY;
      if (index < 0 || index >= source.length) {
        throw new Error(`${identifier} index ${index} is out of range (0-${Math.max(0, source.length - 1)})`);
      }
      return source[index];
    }

    if (Object.prototype.hasOwnProperty.call(this.locals, identifier)) {
      return this.locals[identifier];
    }

    throw new Error(`Unknown identifier "${identifier}"`);
  }

  private parseNumber(): number {
    const start = this.pos;
    while (!this.isAtEnd() && /[0-9.]/.test(this.peek())) {
      this.pos += 1;
    }
    const token = this.source.slice(start, this.pos);
    if (!/^\d+(\.\d+)?$/.test(token)) {
      throw new Error(`Invalid number "${token}"`);
    }
    return Number(token);
  }

  private parseIdentifier(): string | null {
    this.skipWhitespace();
    if (this.isAtEnd() || !/[A-Za-z_]/.test(this.peek())) {
      return null;
    }
    const start = this.pos;
    this.pos += 1;
    while (!this.isAtEnd() && /[A-Za-z0-9_]/.test(this.peek())) {
      this.pos += 1;
    }
    return this.source.slice(start, this.pos);
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.pos += 1;
    }
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private consumeIf(ch: string): boolean {
    this.skipWhitespace();
    if (this.peek() !== ch) {
      return false;
    }
    this.pos += 1;
    return true;
  }

  private expect(ch: string): void {
    if (!this.consumeIf(ch)) {
      throw new Error(`Expected "${ch}"`);
    }
  }

  private isNumberStart(ch: string): boolean {
    return /[0-9]/.test(ch);
  }
}

export function resolveAimExpression(
  expr: string,
  context: TurretAimContext,
  locals: Record<string, number> = {},
): { value?: number; error?: string } {
  const trimmed = expr.trim();
  if (trimmed.length === 0) {
    return { error: 'Aim value cannot be empty' };
  }

  try {
    const parser = new ExpressionParser(trimmed, context, locals);
    const value = parser.parse();
    if (!Number.isFinite(value)) {
      return { error: 'Expression resolved to a non-finite number' };
    }
    return { value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
}
