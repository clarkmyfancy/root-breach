import assert from 'node:assert/strict';
import test from 'node:test';
import { contractById } from '../../src/game/contracts';
import { compileScript } from '../../src/game/compiler/compile';
import { runSimulation } from '../../src/game/engine/simulationRunner';
import { levelById } from '../../src/game/levels';
import { commandToolRequirements, toolCatalog } from '../../src/game/tools';

const allToolIds = toolCatalog.map((tool) => tool.id);

function compileForContract(contractId: string, source: string) {
  const contract = contractById[contractId];
  const level = levelById[contract.siteId];
  const compiled = compileScript(source, level, {
    contract,
    ownedToolIds: allToolIds,
    requiredToolByCommand: commandToolRequirements,
  });
  assert.equal(compiled.errors.length, 0, compiled.errors.map((error) => `${error.line}:${error.message}`).join('\n'));
  return { contract, level, commands: compiled.commands };
}

test('trace updates are emitted and progress increases under active mission pressure', () => {
  const { contract, level, commands } = compileForContract('contract_tut_02', 'door("D2").open()');
  const result = runSimulation(level, commands, { contract, globalHeat: 4 });

  assert.ok(result.events.some((event) => event.type === 'TRACE_UPDATED'));
  const lastFrame = result.frames[result.frames.length - 1];
  assert.ok(lastFrame.snapshot.traceProgress > 0);
});

test('objective can complete but mission still fails when cleanup conditions are unmet', () => {
  const { contract, level, commands } = compileForContract(
    'contract_tut_05',
    ['camera("C5A").disable(40)', 'camera("C5B").disable(40)', 'door("D5A").open()', 'door("D5B").open()', 'file("FIN_AUDIT_BUNDLE").copy()'].join('\n'),
  );
  const result = runSimulation(level, commands, { contract, globalHeat: 0 });

  assert.equal(result.events.some((event) => event.type === 'OBJECTIVE_COMPLETED'), true);
  assert.equal(result.events.some((event) => event.type === 'CLEANUP_FAILED'), true);
  assert.equal(result.outcome, 'failure');
});

test('frame contract can succeed when forged evidence matches target attribution', () => {
  const { contract, level, commands } = compileForContract(
    'contract_act1_08',
    [
      'device("D4").sabotage("valve_pulse")',
      'wait(12)',
      'evidence().frame("RIVAL_OPS")',
      'logs("NETFLOW").forge("rival_sig")',
    ].join('\n'),
  );
  const result = runSimulation(level, commands, { contract, globalHeat: 0 });

  assert.equal(result.events.some((event) => event.type === 'OBJECTIVE_COMPLETED'), true);
  assert.equal(result.events.some((event) => event.type === 'CLEANUP_COMPLETED'), true);
  assert.equal(result.outcome, 'success');
});

test('non-exfil contracts can succeed without reaching exit when objective is complete', () => {
  const { contract, level, commands } = compileForContract(
    'contract_tut_03',
    ['device("D3").sabotage("pulse")'].join('\n'),
  );
  const result = runSimulation(level, commands, { contract, globalHeat: 0 });

  assert.equal(result.outcome, 'success');
  assert.equal(result.events.some((event) => event.type === 'OBJECTIVE_COMPLETED'), true);
  assert.equal(result.events.some((event) => event.type === 'PLAYER_REACHED_EXIT'), false);
});

test('event stream rows expose mission-readable message and impact fields', () => {
  const { contract, level, commands } = compileForContract('contract_tut_02', 'door("D2").open()');
  const result = runSimulation(level, commands, { contract, globalHeat: 4 });
  const traceEvent = result.events.find((event) => event.type === 'TRACE_UPDATED');
  assert.ok(traceEvent);
  assert.equal(typeof traceEvent?.message, 'string');
  assert.equal(typeof traceEvent?.target, 'string');
  assert.equal(typeof traceEvent?.traceImpact, 'number');
});
