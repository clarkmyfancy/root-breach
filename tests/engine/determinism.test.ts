import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScript } from '../../src/game/compiler/compile';
import { level1 } from '../../src/game/levels/level1';
import { level4 } from '../../src/game/levels/level4';
import { runSimulation } from '../../src/game/engine/simulationRunner';

test('simulation is deterministic for the same level + script', () => {
  const source = [
    'camera("C4A").disable(6)',
    'door("D4").open()',
    'wait(6)',
    'camera("C4B").disable(6)',
    'turret("T4").retarget("DR4")',
  ].join('\n');
  const compiled = compileScript(source, level4);
  assert.equal(compiled.errors.length, 0);

  const runA = runSimulation(level4, compiled.commands);
  const runB = runSimulation(level4, compiled.commands);

  assert.deepEqual(runA, runB);
});

test('replay includes initial tick-0 snapshot before first simulation step', () => {
  const result = runSimulation(level1, []);

  assert.ok(result.frames.length >= 2);
  assert.equal(result.frames[0].tick, 0);
  assert.equal(result.frames[0].events.length, 0);
});

test('timeout is emitted at tickLimit with no processing beyond [0, tickLimit)', () => {
  const result = runSimulation(level1, []);
  const timeout = result.events.find((event) => event.type === 'RUN_TIMEOUT');
  assert.ok(timeout);

  assert.equal(result.finalTick, level1.constraints.tickLimit);
  assert.equal(timeout?.tick, level1.constraints.tickLimit);
  assert.equal(
    result.events.some((event) => event.tick > level1.constraints.tickLimit),
    false,
  );
});
