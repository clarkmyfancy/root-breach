import assert from 'node:assert/strict';
import test from 'node:test';
import { contractById } from '../../src/game/contracts';
import { compileScript } from '../../src/game/compiler/compile';
import { levelById } from '../../src/game/levels';
import { commandToolRequirements, toolCatalog } from '../../src/game/tools';

const allToolIds = toolCatalog.map((tool) => tool.id);

test('compiler accepts expanded v2 command namespaces with full capability set', () => {
  const contract = contractById.contract_act1_09;
  const level = levelById[contract.siteId];
  const source = [
    'scan.node("N5_CHECKPOINT_A")',
    'probe.logs("AUTH")',
    'access.auth("AUTH_L5").replayToken("tokenA")',
    'file("FIN_AUDIT_BUNDLE").copy()',
    'record("EMP_042").alter("status","inactive")',
    'trace().spoof("FACILITY_MAINT")',
    'route().relay("N5_VAULT_EDGE")',
    'decoy().burst(2)',
    'wait(15)',
    'logs("AUTH").scrub("AUTH_L5")',
    'logs("NETFLOW").forge("competitor_sig")',
    'evidence().frame("CONTRACTOR_ZETA")',
  ].join('\n');

  const compiled = compileScript(source, level, {
    contract,
    ownedToolIds: allToolIds,
    requiredToolByCommand: commandToolRequirements,
  });

  assert.equal(compiled.errors.length, 0);
  assert.ok(compiled.commands.length > 8);
});

test('compiler rejects command when required tool is not owned', () => {
  const contract = contractById.contract_tut_05;
  const level = levelById[contract.siteId];

  const result = compileScript('file("FIN_AUDIT_BUNDLE").copy()', level, {
    contract,
    ownedToolIds: ['tool_core_control'],
    requiredToolByCommand: commandToolRequirements,
  });

  assert.ok(result.errors.some((error) => /requires tool "tool_payload_ops"/.test(error.message)));
});

test('compiler rejects invalid contract-scoped targets', () => {
  const contract = contractById.contract_act1_06;
  const level = levelById[contract.siteId];

  const result = compileScript('route().relay("UNKNOWN_NODE")', level, {
    contract,
    ownedToolIds: allToolIds,
    requiredToolByCommand: commandToolRequirements,
  });

  assert.ok(result.errors.some((error) => /not in contract scope/.test(error.message)));
});

test('compiler enforces cleanup-only command scheduling', () => {
  const contract = contractById.contract_tut_05;
  const level = levelById[contract.siteId];

  const result = compileScript('logs("AUTH").scrub("AUTH_L5")', level, {
    contract,
    ownedToolIds: allToolIds,
    requiredToolByCommand: commandToolRequirements,
  });

  assert.ok(result.errors.some((error) => /cleanup-phase only/.test(error.message)));
});
