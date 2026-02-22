import type { EventRecord, FailureSummary } from './eventTypes';

function findLast(events: EventRecord[], type: EventRecord['type']): EventRecord | undefined {
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    if (events[idx].type === type) {
      return events[idx];
    }
  }
  return undefined;
}

function findBefore(events: EventRecord[], type: EventRecord['type'], tick: number): EventRecord | undefined {
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    const event = events[idx];
    if (event.tick > tick) {
      continue;
    }
    if (event.type === type) {
      return event;
    }
  }
  return undefined;
}

export function buildFailureSummary(events: EventRecord[]): FailureSummary {
  const traceMaxed = findLast(events, 'TRACE_MAXED');
  if (traceMaxed) {
    return {
      primaryCause: 'Trace reached 100 and origin attribution locked in',
      causeChain: [`Trace threshold reached at tick ${traceMaxed.tick}`],
      suggestedFocus: 'Reduce noisy actions, add relay/decoy tooling, and scrub evidence during cleanup',
      objectiveStatus: findLast(events, 'OBJECTIVE_COMPLETED') ? 'complete' : 'incomplete',
      cleanupStatus: findLast(events, 'CLEANUP_COMPLETED') ? 'complete' : 'failed',
      exposureCauses: ['Mission trace overflow'],
      attributionConclusion: String(traceMaxed.payload.attributedTo ?? 'OPERATOR'),
    };
  }

  const cleanupFailed = findLast(events, 'CLEANUP_FAILED');
  if (cleanupFailed) {
    return {
      primaryCause: 'Cleanup phase failed before mission closure',
      causeChain: [`Cleanup condition unmet: ${String(cleanupFailed.payload.reason ?? 'unknown')}`],
      suggestedFocus: 'Use scrub/forge commands and reduce operator-attributed evidence before timeout',
      objectiveStatus: 'complete',
      cleanupStatus: 'failed',
      exposureCauses: [String(cleanupFailed.payload.reason ?? 'unspecified')],
      attributionConclusion: String(cleanupFailed.payload.attributedTo ?? 'OPERATOR'),
    };
  }

  const killed = findLast(events, 'PLAYER_KILLED');
  if (killed) {
    const turretId = String(killed.payload.turretId ?? 'unknown turret');
    const lock = findBefore(events, 'TURRET_TARGET_LOCK', killed.tick);
    const red = findBefore(events, 'ALARM_STATE_CHANGED', killed.tick);
    const detected = findBefore(events, 'CAMERA_DETECTED_PLAYER', killed.tick);
    const chain: string[] = [];

    if (detected) {
      chain.push(`Camera ${detected.payload.cameraId} detected player`);
    }
    if (red && red.payload.to === 'RED') {
      chain.push('Alarm escalated to RED');
    }
    if (lock) {
      chain.push(`Turret ${lock.payload.turretId} acquired target ${lock.payload.targetId}`);
    }
    chain.push(`Turret ${turretId} fired on player`);

    return {
      primaryCause: `Turret ${turretId} killed player`,
      causeChain: chain.slice(-4),
      suggestedFocus: detected
        ? `Disable ${detected.payload.cameraId} or delay alarm before turret lock`
        : `Retarget ${turretId} to a drone or keep alarm below RED`,
    };
  }

  const blocked = findLast(events, 'PLAYER_BLOCKED_BY_DOOR');
  if (blocked) {
    const doorId = String(blocked.payload.doorId ?? 'unknown door');
    const red = findBefore(events, 'ALARM_STATE_CHANGED', blocked.tick);
    const chain = [`Door ${doorId} blocked movement`];
    if (red && red.payload.to === 'RED') {
      chain.unshift('Alarm escalated to RED');
    }

    return {
      primaryCause: `Player was stopped by door ${doorId}`,
      causeChain: chain.slice(0, 4),
      suggestedFocus: `Open ${doorId} earlier or prevent alarm-triggered lockdown`,
    };
  }

  const timeout = findLast(events, 'RUN_TIMEOUT');
  if (timeout) {
    return {
      primaryCause: 'Run timed out before mission completion',
      causeChain: ['No successful objective/cleanup completion before tick limit'],
      suggestedFocus: 'Reduce waits and complete objective plus cleanup steps earlier',
      objectiveStatus: findLast(events, 'OBJECTIVE_COMPLETED') ? 'complete' : 'incomplete',
      cleanupStatus: findLast(events, 'CLEANUP_COMPLETED') ? 'complete' : 'pending',
    };
  }

  return {
    primaryCause: 'Run failed',
    causeChain: ['Simulation ended without satisfying mission requirements'],
    suggestedFocus: 'Inspect event log and forensics panel to adjust script timing and cleanup',
  };
}
