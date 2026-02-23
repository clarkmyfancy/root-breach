import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScript } from '../../src/game/compiler/compile';
import { level1 } from '../../src/game/levels/level1';

test('compile rejects commands scheduled at or after tickLimit', () => {
  const source = ['wait(40)', 'setAim(-1, -1)'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.commands.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 2);
  assert.match(result.errors[0].message, /outside run range \[0, 40\)/);
});

test('compile accepts commands scheduled within [0, tickLimit)', () => {
  const source = ['wait(39)', 'setAim(-1, -1)'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.errors.length, 0);
  assert.equal(result.commands.length, 2);
  assert.equal(result.commands[1].tick, 39);
});

test('setAim resolves challenge variables into numeric turret offsets', () => {
  const result = compileScript('setAim(intruderPosX, intruderPosY)', level1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.commands.length, 1);
  assert.equal(result.commands[0].kind, 'turret.setAim');
  assert.equal(result.commands[0].xExpr, 'intruderPosX');
  assert.equal(result.commands[0].yExpr, 'intruderPosY');
  assert.equal(result.commands[0].xValue, -3);
  assert.equal(result.commands[0].yValue, 1);
});

test('setAim rejects out-of-range guard index', () => {
  const result = compileScript('setAim(guardPosX[99], guardPosY[0])', level1);
  assert.equal(result.commands.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /guardPosX index 99 is out of range/);
});

test('compiler skips full-line comments prefixed with //', () => {
  const source = ['// aim away from intruder start', 'setAim(-3, -3)'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.errors.length, 0);
  assert.equal(result.commands.length, 1);
  assert.equal(result.commands[0].kind, 'turret.setAim');
});

test('compiler supports while loops with braces and unrolls until tick limit', () => {
  const source = ['while (true) {', '  setAim(-2, -2)', '  wait(1)', '}'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.errors.length, 0);
  assert.equal(result.commands.length, 80);
  assert.equal(result.commands[0].tick, 0);
  assert.equal(result.commands[result.commands.length - 1].tick, 39);
});

test('while(true) must advance time with wait(n)', () => {
  const source = ['while (true) {', '  setAim(-2, -2)', '}'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.commands.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /while loop must advance time with wait/);
});
