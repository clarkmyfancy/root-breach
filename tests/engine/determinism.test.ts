import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScript } from '../../src/game/compiler/compile';
import { level1 } from '../../src/game/levels/level1';
import { level3 } from '../../src/game/levels/level3';
import { level4 } from '../../src/game/levels/level4';
import type { LevelDefinition } from '../../src/game/models/types';
import { runSimulation } from '../../src/game/engine/simulationRunner';

test('simulation is deterministic for the same level + script', () => {
  const source = ['setAim(guardPosX[0], guardPosY[0])', 'wait(5)', 'setAim(-3, -3)'].join('\n');
  const compiled = compileScript(source, level1);
  assert.equal(compiled.errors.length, 0);

  const runA = runSimulation(level1, compiled.commands);
  const runB = runSimulation(level1, compiled.commands);

  assert.deepEqual(runA, runB);
});

test('replay includes initial tick-0 snapshot before first simulation step', () => {
  const result = runSimulation(level1, []);

  assert.ok(result.frames.length >= 2);
  assert.equal(result.frames[0].tick, 0);
  assert.equal(result.frames[0].events.length, 0);
});

test('simulation never processes beyond tickLimit bounds', () => {
  const result = runSimulation(level1, []);

  assert.ok(result.finalTick <= level1.constraints.tickLimit);
  assert.ok(result.events.some((event) => event.type === 'PLAYER_KILLED' || event.type === 'RUN_TIMEOUT'));
  assert.equal(
    result.events.some((event) => event.tick > level1.constraints.tickLimit),
    false,
  );
});

test('manual turret aim lets the player survive while turret fires at guards', () => {
  const compiled = compileScript('setAim(guardPosX[0], guardPosY[0])', level1);
  assert.equal(compiled.errors.length, 0);

  const result = runSimulation(level1, compiled.commands);
  assert.equal(result.outcome, 'failure');
  assert.ok(result.events.some((event) => event.type === 'DRONE_DESTROYED'));
  assert.ok(result.events.every((event) => event.type !== 'PLAYER_KILLED'));
});

test('fixed setAim target remains coordinate-locked and does not follow player', () => {
  const compiled = compileScript('setAim(-2, -2)', level1);
  assert.equal(compiled.errors.length, 0);

  const result = runSimulation(level1, compiled.commands);
  const firedTargets = result.events
    .filter((event) => event.type === 'TURRET_FIRED')
    .map((event) => String(event.payload.targetId));

  assert.ok(firedTargets.length > 0);
  assert.ok(firedTargets.every((targetId) => targetId === 'coord:9,8'));
  assert.ok(result.events.every((event) => event.type !== 'PLAYER_KILLED'));
});

test('commented setAim line is ignored and next fixed setAim is applied', () => {
  const source = ['//setAim(intruderPosX, intruderPosY)', 'setAim(-2,-2)'].join('\n');
  const compiled = compileScript(source, level1);
  assert.equal(compiled.errors.length, 0);

  const result = runSimulation(level1, compiled.commands);
  const firedTargets = result.events
    .filter((event) => event.type === 'TURRET_FIRED')
    .map((event) => String(event.payload.targetId));

  assert.ok(firedTargets.length > 0);
  assert.ok(firedTargets.every((targetId) => targetId === 'coord:9,8'));
});

test('turret aim level requires explicit script instructions to fire', () => {
  const compiled = compileScript('//setAim(intruderPosX, intruderPosY)', level1);
  assert.equal(compiled.errors.length, 0);
  assert.equal(compiled.commands.length, 0);

  const result = runSimulation(level1, compiled.commands);
  assert.equal(result.events.some((event) => event.type === 'TURRET_FIRED'), false);
  assert.equal(result.events.some((event) => event.type === 'PLAYER_KILLED'), false);
});

test('setAim(intruderPosX, intruderPosY) tracks moving intruder over time', () => {
  const trackingLevel: LevelDefinition = {
    ...level1,
    map: {
      width: 9,
      height: 5,
      walls: [],
    },
    entry: { x: 1, y: 2 },
    exit: { x: 4, y: 2 },
    playerPath: [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
    devices: [
      {
        id: 'T1',
        type: 'turret',
        x: 6,
        y: 2,
        enabled: true,
        range: 10,
        lockDelay: 99,
        alarmTrigger: 'ALWAYS',
        desiredTargetId: null,
        currentTargetId: null,
        lockTicks: 0,
        manualAimX: null,
        manualAimY: null,
        manualAimXExpr: null,
        manualAimYExpr: null,
      },
      {
        id: 'TERM1',
        type: 'terminal',
        x: 0,
        y: 0,
        enabled: true,
      },
    ],
    networkScope: ['T1'],
    constraints: {
      tickLimit: 12,
    },
  };

  const compiled = compileScript('setAim(intruderPosX, intruderPosY)', trackingLevel);
  assert.equal(compiled.errors.length, 0);

  const result = runSimulation(trackingLevel, compiled.commands);
  const targetIds = result.frames
    .map((frame) => frame.snapshot.devices.T1)
    .filter((device): device is Extract<typeof trackingLevel.devices[number], { type: 'turret' }> => {
      return Boolean(device) && device.type === 'turret' && typeof device.currentTargetId === 'string';
    })
    .map((turret) => String(turret.currentTargetId));

  const uniqueTargets = new Set(targetIds);
  assert.ok(uniqueTargets.size > 1);
});

test('alarm trap level succeeds with lure + lock script and fails without it', () => {
  const source = ['alarm("SIDE_ALARM").trigger()', 'wait(3)', 'door("SIDE_ROOM_DOOR").close()'].join('\n');
  const compiled = compileScript(source, level3);
  assert.equal(compiled.errors.length, 0);

  const successRun = runSimulation(level3, compiled.commands);
  const failureRun = runSimulation(level3, []);

  assert.equal(successRun.outcome, 'success');
  assert.equal(failureRun.outcome, 'failure');
  assert.ok(
    failureRun.events.some((event) => event.type === 'PLAYER_CAUGHT_BY_GUARD' || event.type === 'PLAYER_CAUGHT_BY_DRONE'),
  );
});

test('generator shutdown level succeeds with overclock and fails without power cut', () => {
  const compiled = compileScript('generator("GEN_CORE").overclock()', level4);
  assert.equal(compiled.errors.length, 0);

  const successRun = runSimulation(level4, compiled.commands);
  const failureRun = runSimulation(level4, []);

  assert.equal(successRun.outcome, 'success');
  assert.equal(failureRun.outcome, 'failure');
  assert.ok(successRun.events.some((event) => event.type === 'GENERATOR_BURNT_OUT'));
});
