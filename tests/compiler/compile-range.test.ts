import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScript } from '../../src/game/compiler/compile';
import { level1 } from '../../src/game/levels/level1';

test('compile rejects commands scheduled at or after tickLimit', () => {
  const source = ['wait(15)', 'door("D1").open()'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.commands.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 2);
  assert.match(result.errors[0].message, /outside run range \[0, 15\)/);
});

test('compile accepts commands scheduled within [0, tickLimit)', () => {
  const source = ['wait(14)', 'door("D1").open()'].join('\n');
  const result = compileScript(source, level1);

  assert.equal(result.errors.length, 0);
  assert.equal(result.commands.length, 2);
  assert.equal(result.commands[1].tick, 14);
});
