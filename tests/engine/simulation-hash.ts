import { compileScript } from '../../src/game/compiler/compile';
import type { LevelDefinition } from '../../src/game/models/types';
import { runSimulation } from '../../src/game/engine/simulationRunner';
import type { SimulationResult } from '../../src/game/engine/eventTypes';

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function simulationOutcomeHash(result: SimulationResult): string {
  const eventDigest = result.events
    .map((event) => `${event.tick}|${event.type}|${JSON.stringify(event.payload)}`)
    .join('\n');
  const lastFrame = result.frames[result.frames.length - 1];
  const tail = lastFrame
    ? `${lastFrame.tick}|${lastFrame.snapshot.player.x},${lastFrame.snapshot.player.y}|${lastFrame.snapshot.player.alive}|${lastFrame.snapshot.player.reachedExit}`
    : 'no-frame';

  return hashString(
    JSON.stringify({
      outcome: result.outcome,
      finalTick: result.finalTick,
      tickLimit: result.tickLimit,
      eventDigest,
      tail,
    }),
  );
}

export function simulateAndHash(level: LevelDefinition, source: string): string {
  const compiled = compileScript(source, level);
  if (compiled.errors.length > 0) {
    const firstError = compiled.errors[0];
    throw new Error(`Script did not compile (line ${firstError.line}): ${firstError.message}`);
  }
  return simulationOutcomeHash(runSimulation(level, compiled.commands));
}
