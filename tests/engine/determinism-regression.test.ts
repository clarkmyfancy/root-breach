import assert from 'node:assert/strict';
import test from 'node:test';
import { levels } from '../../src/game/levels';
import { runSimulation } from '../../src/game/engine/simulationRunner';
import { simulationOutcomeHash } from './simulation-hash';

const expectedEmptyScriptHashes: Record<string, string> = {
  level1: '3b7ed57a',
  level2: '2d86aedb',
  level3: '47e7e073',
  level4: '3678fc20',
  level5: 'c14a1c48',
};

test('empty-script baseline hashes remain stable for all tutorial sites', () => {
  for (const level of levels) {
    const result = runSimulation(level, []);
    const hash = simulationOutcomeHash(result);
    assert.equal(
      hash,
      expectedEmptyScriptHashes[level.id],
      `Regression hash mismatch for ${level.id}: expected ${expectedEmptyScriptHashes[level.id]}, got ${hash}`,
    );
  }
});
