import type { CompiledCommand } from '../compiler/scriptTypes';
import { createInitialSimulationState } from '../models/state';
import type {
  AlarmDevice,
  AttributionReason,
  AttributionResult,
  CameraDevice,
  Device,
  DoorDevice,
  EvidenceSurface,
  LevelDefinition,
  MissionPhase,
  PlayerState,
  SimulationState,
  TraceSource,
} from '../models/types';
import { buildFailureSummary } from './failureSummary';
import { GLOBAL_TICK_LIMIT } from './constants';
import type { EventCategory, EventRecord, EventType, LegacyEventCategory, SimulationResult } from './eventTypes';
import { buildFrame } from './replayRecorder';
import type { MissionConfig } from './missionTypes';

interface TargetInfo {
  id: string;
  kind: 'player' | 'drone';
  x: number;
  y: number;
}

interface TickContext {
  state: SimulationState;
  level: LevelDefinition;
  tickLimit: number;
  missionConfig?: MissionConfig;
  commandsByTick: Map<number, CompiledCommand[]>;
  cameraDetectionMemory: Record<string, boolean>;
  eventsThisTick: EventRecord[];
  events: EventRecord[];
  executedLines: number[];
  nextEventId: number;
  noisyScriptActionsThisTick: number;
}

function toEventCategory(type: EventType, legacyCategory: LegacyEventCategory): EventCategory {
  const fromType: Partial<Record<EventType, EventCategory>> = {
    SCRIPT_LINE_EXECUTED: 'COMMAND',
    LOG: 'COMMAND',
    RUN_TIMEOUT: 'FAILURE',
    TRACE_UPDATED: 'TRACE',
    TRACE_THRESHOLD_REACHED: 'TRACE',
    TRACE_MAXED: 'FAILURE',
    OBJECTIVE_PROGRESS: 'OBJECTIVE',
    OBJECTIVE_COMPLETED: 'OBJECTIVE',
    CLEANUP_COMPLETED: 'CLEANUP',
    CLEANUP_FAILED: 'CLEANUP',
    MISSION_PHASE_CHANGED: 'OBJECTIVE',
    ATTRIBUTION_UPDATED: 'ATTRIBUTION',
    MISSION_OUTCOME_UPDATED: 'ATTRIBUTION',
    EVIDENCE_LOGGED: 'PROCESS',
    EVIDENCE_ATTRIBUTION_SHIFTED: 'ATTRIBUTION',
    LOGS_SCRUBBED: 'CLEANUP',
    LOGS_FORGED: 'CLEANUP',
    LOGS_OVERWRITTEN: 'CLEANUP',
    EVIDENCE_FRAME_SET: 'ATTRIBUTION',
    CAMERA_DETECTED_PLAYER: 'ALARM',
    ALARM_STATE_CHANGED: 'ALARM',
    ALARM_DELAY_APPLIED: 'ALARM',
    ACCESS_BYPASS_APPLIED: 'AUTH',
    ACCESS_SPOOF_APPLIED: 'AUTH',
    ACCESS_TOKEN_REPLAYED: 'AUTH',
    FILE_COPIED: 'FILE',
    FILE_DELETED: 'FILE',
    RECORD_ALTERED: 'FILE',
    ROUTE_SCANNED: 'NETFLOW',
    ROUTE_RELAY_APPLIED: 'NETFLOW',
    ROUTE_AGENT_SELECTED: 'NETFLOW',
    TRACE_SPOOFED: 'NETFLOW',
    DECOY_BURST_APPLIED: 'NETFLOW',
    DEVICE_SCANNED: 'DEVICE',
    NODE_SCANNED: 'PROCESS',
    DEVICE_DISABLED: 'DEVICE',
    DEVICE_ENABLED: 'DEVICE',
    DEVICE_TAGGED: 'DEVICE',
    DEVICE_SABOTAGED: 'DEVICE',
    TURRET_RETARGETED: 'DEVICE',
    DOOR_OPENED: 'DEVICE',
    DOOR_CLOSED: 'DEVICE',
    TURRET_TARGET_LOCK: 'ALARM',
    TURRET_FIRED: 'ALARM',
    PLAYER_BLOCKED_BY_DOOR: 'FAILURE',
    PLAYER_KILLED: 'FAILURE',
    PLAYER_REACHED_EXIT: 'OBJECTIVE',
    DRONE_DESTROYED: 'DEVICE',
    LOG_SURFACE_PROBED: 'PROCESS',
  };
  if (fromType[type]) {
    return fromType[type] as EventCategory;
  }

  const fromLegacy: Record<LegacyEventCategory, EventCategory> = {
    script: 'COMMAND',
    detection: 'ALARM',
    alarm: 'ALARM',
    combat: 'FAILURE',
    movement: 'OBJECTIVE',
    system: 'PROCESS',
    trace: 'TRACE',
    evidence: 'PROCESS',
    objective: 'OBJECTIVE',
    mission: 'CLEANUP',
  };
  return fromLegacy[legacyCategory];
}

function messageForEvent(type: EventType, payload: Record<string, string | number | boolean | null>): string {
  switch (type) {
    case 'SCRIPT_LINE_EXECUTED':
      return `line ${payload.line} executed (${payload.kind})`;
    case 'CAMERA_DETECTED_PLAYER':
      return `${payload.cameraId} detected player`;
    case 'ALARM_STATE_CHANGED':
      return `Alarm ${payload.from} -> ${payload.to}`;
    case 'DEVICE_DISABLED':
      return `Disabled ${payload.deviceId}`;
    case 'DEVICE_ENABLED':
      return `Enabled ${payload.deviceId}`;
    case 'DOOR_OPENED':
      return `Door ${payload.doorId} opened`;
    case 'DOOR_CLOSED':
      return `Door ${payload.doorId} closed`;
    case 'ALARM_DELAY_APPLIED':
      return `Alarm delayed by ${payload.amount} ticks`;
    case 'TRACE_UPDATED':
      return `Trace ${payload.progress}% (${payload.delta}/tick)`;
    case 'TRACE_THRESHOLD_REACHED':
      return `Trace threshold ${payload.threshold}% reached`;
    case 'TRACE_MAXED':
      return 'Trace maxed out';
    case 'OBJECTIVE_PROGRESS':
      return `Objective progress ${payload.objectiveKey}`;
    case 'OBJECTIVE_COMPLETED':
      return 'Objective completed';
    case 'CLEANUP_COMPLETED':
      return 'Cleanup completed';
    case 'CLEANUP_FAILED':
      return `Cleanup failed (${payload.reason})`;
    case 'MISSION_PHASE_CHANGED':
      return `Mission phase ${payload.from} -> ${payload.to}`;
    case 'ATTRIBUTION_UPDATED':
      return `Attribution: ${payload.suspectedActor} (${payload.confidence})`;
    case 'MISSION_OUTCOME_UPDATED':
      return `Rule checks: ${payload.failedRules ?? 'none failed'}`;
    case 'LOGS_SCRUBBED':
      return `Logs scrubbed ${payload.surface} (${payload.count})`;
    case 'LOGS_FORGED':
      return `Logs forged ${payload.surface}`;
    case 'LOGS_OVERWRITTEN':
      return `Logs overwritten ${payload.surface} (${payload.count})`;
    case 'EVIDENCE_FRAME_SET':
      return `Frame target set ${payload.target}`;
    case 'EVIDENCE_ATTRIBUTION_SHIFTED':
      return `Attribution shifted to ${payload.target}`;
    case 'EVIDENCE_LOGGED':
      return `Evidence ${payload.surface} at ${payload.siteNodeId}`;
    case 'RUN_TIMEOUT':
      return 'Run timed out';
    case 'LOG':
      return String(payload.message ?? '');
    default:
      return type;
  }
}

function resolveEventTarget(payload: Record<string, string | number | boolean | null>): string {
  const keys = [
    'deviceId',
    'doorId',
    'cameraId',
    'turretId',
    'targetId',
    'nodeId',
    'siteNodeId',
    'fileId',
    'recordId',
    'authId',
    'target',
  ];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
}

function resolveTraceImpact(type: EventType, payload: Record<string, string | number | boolean | null>): number {
  if (type === 'TRACE_UPDATED' && typeof payload.delta === 'number') {
    return Number(payload.delta);
  }
  return 0;
}

function resolveEvidenceImpact(
  type: EventType,
  payload: Record<string, string | number | boolean | null>,
): EventRecord['evidenceImpact'] {
  if (type === 'EVIDENCE_LOGGED') {
    return {
      surface: String(payload.surface ?? 'PROCESS'),
      action: 'ADD',
      count: 1,
    };
  }
  if (type === 'LOGS_SCRUBBED') {
    return {
      surface: String(payload.surface ?? 'PROCESS'),
      action: 'SCRUB',
      count: Number(payload.count ?? 0),
    };
  }
  if (type === 'LOGS_FORGED') {
    return {
      surface: String(payload.surface ?? 'PROCESS'),
      action: 'FORGE',
      count: 1,
    };
  }
  if (type === 'LOGS_OVERWRITTEN') {
    return {
      surface: String(payload.surface ?? 'PROCESS'),
      action: 'OVERWRITE',
      count: Number(payload.count ?? 0),
    };
  }
  if (type === 'EVIDENCE_ATTRIBUTION_SHIFTED') {
    return {
      surface: 'PROCESS',
      action: 'SHIFT',
      count: Number(payload.count ?? 0),
    };
  }
  return null;
}

function emit(
  ctx: TickContext,
  type: EventType,
  legacyCategory: LegacyEventCategory,
  payload: Record<string, string | number | boolean | null>,
  line?: number,
): void {
  const record: EventRecord = {
    id: ctx.nextEventId,
    tick: ctx.state.tick,
    type,
    category: toEventCategory(type, legacyCategory),
    legacyCategory,
    message: messageForEvent(type, payload),
    target: resolveEventTarget(payload),
    traceImpact: resolveTraceImpact(type, payload),
    evidenceImpact: resolveEvidenceImpact(type, payload),
    payload,
    line,
  };
  ctx.nextEventId += 1;
  ctx.eventsThisTick.push(record);
}

function isMissionMode(ctx: TickContext): boolean {
  return Boolean(ctx.missionConfig?.contract);
}

function getAlarm(state: SimulationState): AlarmDevice | undefined {
  const found = Object.values(state.devices).find((device) => device.type === 'alarm');
  if (!found || found.type !== 'alarm') {
    return undefined;
  }
  return found;
}

function getDevice<T extends Device['type']>(
  state: SimulationState,
  id: string | undefined,
  type: T,
): Extract<Device, { type: T }> | undefined {
  if (!id) {
    return undefined;
  }
  const device = state.devices[id];
  if (!device || device.type !== type) {
    return undefined;
  }
  return device as Extract<Device, { type: T }>;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function facingMatches(camera: CameraDevice, player: PlayerState): boolean {
  const dx = player.x - camera.x;
  const dy = player.y - camera.y;

  switch (camera.facing) {
    case 'up':
      return dy < 0 && Math.abs(dx) <= Math.abs(dy);
    case 'down':
      return dy > 0 && Math.abs(dx) <= Math.abs(dy);
    case 'left':
      return dx < 0 && Math.abs(dy) <= Math.abs(dx);
    case 'right':
      return dx > 0 && Math.abs(dy) <= Math.abs(dx);
    default:
      return false;
  }
}

function markNoisyAction(ctx: TickContext): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  ctx.noisyScriptActionsThisTick += 1;
}

function setMissionPhase(ctx: TickContext, phase: MissionPhase): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  if (ctx.state.mission.phase === phase) {
    return;
  }
  const before = ctx.state.mission.phase;
  ctx.state.mission.phase = phase;
  emit(ctx, 'MISSION_PHASE_CHANGED', 'mission', { from: before, to: phase });
}

function recordEvidence(
  ctx: TickContext,
  surface: EvidenceSurface,
  siteNodeId: string,
  severity: 1 | 2 | 3,
  signature: string,
  options: {
    attributedTo?: string;
    hidden?: boolean;
    scrubbed?: boolean;
    forged?: boolean;
  } = {},
): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const evidenceId = `E${ctx.state.tick}_${ctx.state.mission.evidence.length + 1}`;
  const attributedTo = options.attributedTo ?? ctx.state.mission.attributionTarget ?? 'OPERATOR';
  const record = {
    id: evidenceId,
    tick: ctx.state.tick,
    surface,
    siteNodeId,
    severity,
    signature,
    attributedTo,
    hidden: options.hidden ?? false,
    scrubbed: options.scrubbed ?? false,
    forged: options.forged ?? false,
  };
  ctx.state.mission.evidence.push(record);
  markNodeEvidence(ctx, siteNodeId, surface, severity);
  emit(ctx, 'EVIDENCE_LOGGED', 'evidence', {
    evidenceId,
    surface,
    siteNodeId,
    severity,
    signature,
    attributedTo,
  });
}

function shiftEvidenceAttribution(ctx: TickContext, target: string): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  let shifted = 0;
  for (const evidence of ctx.state.mission.evidence) {
    if (evidence.scrubbed || evidence.forged) {
      continue;
    }
    if ((evidence.attributedTo ?? 'OPERATOR') !== 'OPERATOR') {
      continue;
    }
    evidence.attributedTo = target;
    shifted += 1;
  }
  if (shifted > 0) {
    emit(ctx, 'EVIDENCE_ATTRIBUTION_SHIFTED', 'evidence', { target, count: shifted });
  }
}

function scrubEvidence(ctx: TickContext, surface: string, target: string): number {
  if (!isMissionMode(ctx)) {
    return 0;
  }
  let scrubbed = 0;
  for (const evidence of ctx.state.mission.evidence) {
    if (evidence.scrubbed || evidence.surface !== surface) {
      continue;
    }
    if (evidence.siteNodeId !== target && evidence.signature !== target) {
      continue;
    }
    evidence.scrubbed = true;
    scrubbed += 1;
  }
  return scrubbed;
}

function overwriteEvidence(ctx: TickContext, surface: string, target: string): number {
  const scrubbedCount = scrubEvidence(ctx, surface, target);
  recordEvidence(ctx, surface as EvidenceSurface, target, 1, `overwrite:${target}`, {
    forged: true,
    attributedTo: ctx.state.mission.attributionTarget ?? 'UNKNOWN',
  });
  return scrubbedCount;
}

function trackObjectiveProgress(ctx: TickContext, key: keyof SimulationState['mission']['objectiveFlags']): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  if (ctx.state.mission.objectiveFlags[key]) {
    return;
  }
  ctx.state.mission.objectiveFlags[key] = true;
  emit(ctx, 'OBJECTIVE_PROGRESS', 'objective', { objectiveKey: key, completed: true });
}

function touchMissionNode(
  ctx: TickContext,
  id: string,
  updates: Partial<SimulationState['mission']['nodes'][string]> = {},
): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const existing = ctx.state.mission.nodes[id];
  if (!existing) {
    ctx.state.mission.nodes[id] = {
      id,
      nodeType: 'SYSTEM',
      accessState: 'VISIBLE',
      riskState: 'LOW',
      lastTouchedTick: ctx.state.tick,
      evidenceSurfacesTouched: [],
      ...updates,
    };
    return;
  }
  ctx.state.mission.nodes[id] = {
    ...existing,
    ...updates,
    evidenceSurfacesTouched: updates.evidenceSurfacesTouched ?? existing.evidenceSurfacesTouched,
    lastTouchedTick: ctx.state.tick,
  };
}

function markNodeEvidence(ctx: TickContext, siteNodeId: string, surface: EvidenceSurface, severity: 1 | 2 | 3): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const existing = ctx.state.mission.nodes[siteNodeId];
  const nextSurfaces = existing
    ? existing.evidenceSurfacesTouched.includes(surface)
      ? existing.evidenceSurfacesTouched
      : [...existing.evidenceSurfacesTouched, surface]
    : [surface];
  const riskState = severity >= 3 ? 'CRITICAL' : severity === 2 ? 'HIGH' : 'MEDIUM';
  touchMissionNode(ctx, siteNodeId, {
    accessState: 'SCANNED',
    riskState,
    evidenceSurfacesTouched: nextSurfaces,
  });
}

function weightBySurface(surface: EvidenceSurface): number {
  switch (surface) {
    case 'AUTH':
      return 1.3;
    case 'PROCESS':
      return 1.2;
    case 'ALARM':
      return 1.15;
    case 'FILE_AUDIT':
      return 1.1;
    case 'DEVICE':
      return 1;
    case 'NETFLOW':
    default:
      return 0.9;
  }
}

function recalculateAttribution(ctx: TickContext): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const contract = ctx.missionConfig?.contract;
  const candidates = new Set<string>(['OPERATOR', 'UNKNOWN']);
  for (const evidence of ctx.state.mission.evidence) {
    candidates.add(evidence.attributedTo ?? 'OPERATOR');
  }
  if (contract?.missionRules.targetFrameIdentity) {
    candidates.add(contract.missionRules.targetFrameIdentity);
  }
  for (const target of contract?.frameTargets ?? []) {
    candidates.add(target);
  }

  const actorScores: Record<string, number> = {};
  for (const actor of candidates) {
    actorScores[actor] = 0;
  }
  const reasonBuckets = new Map<string, number>();
  const unsanitized = ctx.state.mission.evidence.filter((record) => !record.scrubbed);
  for (const record of unsanitized) {
    const actor = record.attributedTo ?? 'OPERATOR';
    const base = record.severity * weightBySurface(record.surface);
    const forgedBoost = record.forged ? 0.8 : 0;
    const visibilityMultiplier = record.hidden ? 0.45 : 1;
    const score = (base + forgedBoost) * visibilityMultiplier;
    actorScores[actor] = (actorScores[actor] ?? 0) + score;

    const reasonKey = `${record.surface}${record.forged ? ' forged' : ''}`;
    reasonBuckets.set(reasonKey, (reasonBuckets.get(reasonKey) ?? 0) + score);
  }

  const ranked = Object.entries(actorScores).sort((a, b) => b[1] - a[1]);
  const [topActor, topScore] = ranked[0] ?? ['UNKNOWN', 0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const total = ranked.reduce((sum, [, score]) => sum + score, 0);
  const confidence = total <= 0 ? 0 : Number((topScore / (topScore + secondScore + 0.0001)).toFixed(2));
  const reasons: AttributionReason[] = Array.from(reasonBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, weight]) => ({ label, weight: Number(weight.toFixed(2)) }));

  const previous = ctx.state.mission.attribution;
  const next: AttributionResult = {
    suspectedActor: topActor,
    confidence,
    actorScores,
    reasons,
  };
  ctx.state.mission.attribution = next;
  ctx.state.mission.trace.confidenceAgainstOperator = Number(((actorScores.OPERATOR ?? 0) / (total || 1)).toFixed(2));

  const actorChanged = previous.suspectedActor !== next.suspectedActor;
  const confidenceDelta = Math.abs(previous.confidence - next.confidence);
  if (actorChanged || confidenceDelta >= 0.1) {
    emit(ctx, 'ATTRIBUTION_UPDATED', 'mission', {
      suspectedActor: next.suspectedActor,
      confidence: next.confidence,
    });
  }
}

function evaluateMissionOutcome(ctx: TickContext): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const contract = ctx.missionConfig?.contract;
  const traceValue = ctx.state.mission.trace.progress;
  const objectivePassed = ctx.state.mission.objectiveCompleted;
  const cleanupRequired = ctx.state.mission.cleanupRequired;
  const cleanupPassed = cleanupRequired ? ctx.state.mission.cleanupCompleted : true;
  const attribution = ctx.state.mission.attribution;
  const noTraceRule = Boolean(contract?.missionRules.requireNoTrace);
  const frameRule = Boolean(contract?.missionRules.allowFrameTarget);
  const forcedDetectionRule = Boolean(contract?.missionRules.forcedDetection);
  const allowTraceOverflow = Boolean(contract?.missionRules.allowTraceOverflow);
  const traceTolerance = contract?.missionRules.traceTolerance ?? (noTraceRule ? 40 : 100);
  const frameTarget = contract?.missionRules.targetFrameIdentity || ctx.state.mission.attributionTarget || '';

  const checks = [
    {
      id: 'objective',
      passed: objectivePassed,
      detail: objectivePassed ? 'Objective completed.' : 'Objective incomplete.',
    },
    {
      id: 'trace_hard_limit',
      passed: allowTraceOverflow || traceValue < 100,
      detail: allowTraceOverflow
        ? 'Trace overflow allowed by contract.'
        : traceValue < 100
          ? 'Trace below max threshold.'
          : 'Trace reached hard failure threshold.',
    },
    {
      id: 'cleanup',
      passed: cleanupPassed,
      detail: cleanupRequired
        ? cleanupPassed
          ? 'Cleanup requirements satisfied.'
          : 'Cleanup still incomplete.'
        : 'Cleanup not required for this contract.',
    },
    {
      id: 'no_trace_rule',
      passed: !noTraceRule || traceValue < traceTolerance,
      detail: !noTraceRule
        ? 'No-trace rule not active.'
        : traceValue < traceTolerance
          ? 'No-trace threshold satisfied.'
          : 'Trace above no-trace threshold.',
    },
    {
      id: 'frame_rule',
      passed: !frameRule || (attribution.suspectedActor === frameTarget && attribution.confidence >= 0.6),
      detail: !frameRule
        ? 'Framing rule not active.'
        : attribution.suspectedActor === frameTarget && attribution.confidence >= 0.6
          ? `Frame target matched (${frameTarget}) with confidence ${attribution.confidence}.`
          : `Framing mismatch. Expected ${frameTarget}, saw ${attribution.suspectedActor} @ ${attribution.confidence}.`,
    },
    {
      id: 'forced_detection_rule',
      passed: !forcedDetectionRule || ctx.state.mission.detectedAtLeastOnce,
      detail: !forcedDetectionRule
        ? 'Forced detection rule not active.'
        : ctx.state.mission.detectedAtLeastOnce
          ? 'Forced detection achieved.'
          : 'Forced detection was never triggered.',
    },
    {
      id: 'loud_diversion_attribution_rule',
      passed: !forcedDetectionRule || frameRule || attribution.suspectedActor !== 'OPERATOR' || attribution.confidence < 0.6,
      detail:
        !forcedDetectionRule || frameRule
          ? 'Diversion attribution rule not active.'
          : attribution.suspectedActor !== 'OPERATOR' || attribution.confidence < 0.6
            ? 'Detection occurred without conclusive operator attribution.'
            : 'Detection linked back to operator with high confidence.',
    },
  ];

  const failedRules = checks.filter((check) => !check.passed).map((check) => check.id);
  const tracePassed =
    (checks.find((check) => check.id === 'trace_hard_limit')?.passed ?? true) &&
    (checks.find((check) => check.id === 'no_trace_rule')?.passed ?? true);
  const attributionPassed =
    (checks.find((check) => check.id === 'frame_rule')?.passed ?? true) &&
    (checks.find((check) => check.id === 'loud_diversion_attribution_rule')?.passed ?? true);
  const status =
    ctx.state.outcome === 'success'
      ? 'SUCCESS'
      : ctx.state.outcome === 'failure'
        ? 'FAILURE'
        : 'RUNNING';

  const previousFailures = ctx.state.mission.outcome.failedRules.join('|');
  const nextFailures = failedRules.join('|');
  ctx.state.mission.outcome = {
    status,
    objectivePassed,
    cleanupPassed,
    tracePassed,
    attributionPassed,
    failedRules,
    finalTrace: Number(traceValue.toFixed(2)),
    finalAttribution: attribution,
    ruleChecks: checks,
  };

  if (previousFailures !== nextFailures) {
    emit(ctx, 'MISSION_OUTCOME_UPDATED', 'mission', {
      failedRules: failedRules.length ? failedRules.join(',') : 'none',
    });
  }
}

function applyScheduledScriptActions(ctx: TickContext): void {
  const commands = ctx.commandsByTick.get(ctx.state.tick) ?? [];
  const contract = ctx.missionConfig?.contract;

  for (const command of commands) {
    ctx.executedLines.push(command.line);
    emit(
      ctx,
      'SCRIPT_LINE_EXECUTED',
      'script',
      {
        kind: command.kind,
        line: command.line,
        deviceId: command.deviceId ?? null,
      },
      command.line,
    );

    switch (command.kind) {
      case 'scan.node':
        if (command.targetId) {
          touchMissionNode(ctx, command.targetId, { accessState: 'SCANNED' });
        }
        emit(ctx, 'NODE_SCANNED', 'script', { nodeId: command.targetId ?? null }, command.line);
        break;
      case 'scan.device':
        if (command.deviceId) {
          touchMissionNode(ctx, command.deviceId, { accessState: 'SCANNED', nodeType: 'DEVICE' });
        }
        emit(ctx, 'DEVICE_SCANNED', 'script', { deviceId: command.deviceId ?? null }, command.line);
        break;
      case 'scan.route':
        emit(ctx, 'ROUTE_SCANNED', 'script', { route: 'contract_scope' }, command.line);
        break;
      case 'probe.logs':
        emit(ctx, 'LOG_SURFACE_PROBED', 'script', { surface: command.textArg ?? null }, command.line);
        break;
      case 'access.door.bypass': {
        const door = getDevice(ctx.state, command.deviceId, 'door');
        if (!door) {
          break;
        }
        door.isOpen = true;
        touchMissionNode(ctx, door.id, { accessState: 'CONTROLLED', nodeType: 'DEVICE' });
        markNoisyAction(ctx);
        ctx.state.mission.objectiveFlags.exfilCommitted = true;
        emit(ctx, 'ACCESS_BYPASS_APPLIED', 'script', { doorId: door.id }, command.line);
        emit(ctx, 'DOOR_OPENED', 'script', { doorId: door.id, via: 'bypass' }, command.line);
        recordEvidence(ctx, 'AUTH', door.id, 2, `bypass:${door.id}`);
        break;
      }
      case 'access.terminal.spoof':
        markNoisyAction(ctx);
        if (command.deviceId) {
          touchMissionNode(ctx, command.deviceId, { accessState: 'CONTROLLED', nodeType: 'AUTH' });
        }
        if (command.textArg) {
          ctx.state.mission.identityState = command.textArg;
        }
        emit(ctx, 'ACCESS_SPOOF_APPLIED', 'script', { terminalId: command.deviceId ?? null, identity: command.textArg ?? '' }, command.line);
        recordEvidence(ctx, 'AUTH', command.deviceId ?? 'terminal', 1, `terminal_spoof:${command.textArg ?? ''}`, {
          forged: true,
          attributedTo: command.textArg ?? 'UNKNOWN',
        });
        break;
      case 'access.auth.replayToken':
        markNoisyAction(ctx);
        if (command.deviceId) {
          touchMissionNode(ctx, command.deviceId, { accessState: 'CONTROLLED', nodeType: 'AUTH' });
        }
        emit(ctx, 'ACCESS_TOKEN_REPLAYED', 'script', { authId: command.deviceId ?? null, token: command.textArg ?? '' }, command.line);
        recordEvidence(ctx, 'AUTH', command.deviceId ?? 'auth', 2, `token_replay:${command.textArg ?? ''}`);
        break;
      case 'camera.disable': {
        const camera = getDevice(ctx.state, command.deviceId, 'camera');
        if (!camera) {
          break;
        }
        camera.enabled = false;
        camera.disabledUntilTick = command.value !== undefined ? ctx.state.tick + command.value : null;
        markNoisyAction(ctx);
        emit(ctx, 'DEVICE_DISABLED', 'script', { deviceId: camera.id, duration: command.value ?? null }, command.line);
        recordEvidence(ctx, 'DEVICE', camera.id, 2, `camera_disable:${camera.id}`);
        break;
      }
      case 'camera.enable': {
        const camera = getDevice(ctx.state, command.deviceId, 'camera');
        if (!camera) {
          break;
        }
        camera.enabled = true;
        camera.disabledUntilTick = null;
        emit(ctx, 'DEVICE_ENABLED', 'script', { deviceId: camera.id }, command.line);
        recordEvidence(ctx, 'DEVICE', camera.id, 1, `camera_enable:${camera.id}`);
        break;
      }
      case 'alarm.delay': {
        const alarm = getAlarm(ctx.state);
        if (!alarm || !command.value) {
          break;
        }
        if (alarm.state === 'YELLOW' && alarm.redAtTick !== null) {
          alarm.redAtTick += command.value;
        } else {
          alarm.manualDelayBuffer += command.value;
        }
        emit(ctx, 'ALARM_DELAY_APPLIED', 'script', { amount: command.value }, command.line);
        recordEvidence(ctx, 'ALARM', alarm.id, 2, `alarm_delay:${command.value}`);
        break;
      }
      case 'door.open': {
        const door = getDevice(ctx.state, command.deviceId, 'door');
        if (!door) {
          break;
        }
        door.isOpen = true;
        ctx.state.mission.objectiveFlags.exfilCommitted = true;
        emit(ctx, 'DOOR_OPENED', 'script', { doorId: door.id }, command.line);
        recordEvidence(ctx, 'DEVICE', door.id, 1, `door_open:${door.id}`);
        break;
      }
      case 'door.close': {
        const door = getDevice(ctx.state, command.deviceId, 'door');
        if (!door) {
          break;
        }
        door.isOpen = false;
        emit(ctx, 'DOOR_CLOSED', 'script', { doorId: door.id }, command.line);
        recordEvidence(ctx, 'DEVICE', door.id, 1, `door_close:${door.id}`);
        break;
      }
      case 'turret.retarget': {
        const turret = getDevice(ctx.state, command.deviceId, 'turret');
        if (!turret || !command.targetId) {
          break;
        }
        turret.desiredTargetId = command.targetId;
        turret.currentTargetId = null;
        turret.lockTicks = 0;
        markNoisyAction(ctx);
        emit(ctx, 'TURRET_RETARGETED', 'script', { turretId: turret.id, targetId: command.targetId }, command.line);
        recordEvidence(ctx, 'DEVICE', turret.id, 2, `turret_retarget:${command.targetId}`);
        break;
      }
      case 'device.tag': {
        const device = command.deviceId ? ctx.state.devices[command.deviceId] : undefined;
        if (!device || !command.textArg) {
          break;
        }
        device.tag = command.textArg;
        emit(ctx, 'DEVICE_TAGGED', 'script', { deviceId: device.id, tag: command.textArg }, command.line);
        break;
      }
      case 'file.copy':
        markNoisyAction(ctx);
        emit(ctx, 'FILE_COPIED', 'script', { fileId: command.deviceId ?? null }, command.line);
        recordEvidence(ctx, 'FILE_AUDIT', command.deviceId ?? 'file', 2, `file_copy:${command.deviceId ?? ''}`);
        if (contract?.fileTargets.includes(command.deviceId ?? '')) {
          trackObjectiveProgress(ctx, 'fileCopied');
        }
        break;
      case 'file.delete':
        markNoisyAction(ctx);
        emit(ctx, 'FILE_DELETED', 'script', { fileId: command.deviceId ?? null }, command.line);
        recordEvidence(ctx, 'FILE_AUDIT', command.deviceId ?? 'file', 3, `file_delete:${command.deviceId ?? ''}`);
        if (contract?.fileTargets.includes(command.deviceId ?? '')) {
          trackObjectiveProgress(ctx, 'fileDeleted');
        }
        break;
      case 'record.alter':
        markNoisyAction(ctx);
        emit(
          ctx,
          'RECORD_ALTERED',
          'script',
          { recordId: command.deviceId ?? null, field: command.textArg ?? '', value: command.extraTextArg ?? '' },
          command.line,
        );
        recordEvidence(ctx, 'FILE_AUDIT', command.deviceId ?? 'record', 2, `record_alter:${command.textArg ?? ''}`);
        if (contract?.recordTargets.includes(command.deviceId ?? '')) {
          trackObjectiveProgress(ctx, 'recordAltered');
        }
        break;
      case 'device.sabotage':
        markNoisyAction(ctx);
        emit(ctx, 'DEVICE_SABOTAGED', 'script', { deviceId: command.deviceId ?? null, mode: command.textArg ?? '' }, command.line);
        recordEvidence(ctx, 'DEVICE', command.deviceId ?? 'device', 3, `sabotage:${command.textArg ?? ''}`);
        trackObjectiveProgress(ctx, 'sabotageDone');
        break;
      case 'trace.spoof':
        ctx.state.mission.trace.progress = Math.max(0, ctx.state.mission.trace.progress - 8);
        emit(ctx, 'TRACE_SPOOFED', 'script', { label: command.textArg ?? '' }, command.line);
        recordEvidence(ctx, 'NETFLOW', command.textArg ?? 'relay', 1, `trace_spoof:${command.textArg ?? ''}`, {
          forged: true,
          attributedTo: command.textArg ?? 'UNKNOWN',
        });
        break;
      case 'route.relay':
        if (command.targetId && !ctx.state.mission.trace.relays.includes(command.targetId)) {
          ctx.state.mission.trace.relays.push(command.targetId);
        }
        if (command.targetId) {
          ctx.state.mission.sessionRoute.push(command.targetId);
          touchMissionNode(ctx, command.targetId, { accessState: 'SCANNED', nodeType: 'ROUTE' });
        }
        emit(ctx, 'ROUTE_RELAY_APPLIED', 'script', { nodeId: command.targetId ?? null }, command.line);
        break;
      case 'route.agent':
        if (command.targetId) {
          ctx.state.mission.sessionRoute.push(command.targetId);
          touchMissionNode(ctx, command.targetId, { accessState: 'CONTROLLED', nodeType: 'ROUTE' });
        }
        ctx.state.mission.objectiveFlags.exfilCommitted = true;
        emit(ctx, 'ROUTE_AGENT_SELECTED', 'script', { route: command.targetId ?? null }, command.line);
        break;
      case 'decoy.burst':
        if (command.value) {
          ctx.state.mission.trace.decoyBuffer += command.value;
          emit(ctx, 'DECOY_BURST_APPLIED', 'script', { amount: command.value }, command.line);
          recordEvidence(ctx, 'NETFLOW', 'decoy', 1, `decoy_burst:${command.value}`, {
            hidden: true,
          });
        }
        break;
      case 'logs.scrub': {
        const count = scrubEvidence(ctx, command.textArg ?? '', command.targetId ?? '');
        emit(
          ctx,
          'LOGS_SCRUBBED',
          'script',
          { surface: command.textArg ?? '', target: command.targetId ?? '', count },
          command.line,
        );
        break;
      }
      case 'logs.forge':
        recordEvidence(ctx, (command.textArg ?? 'PROCESS') as EvidenceSurface, command.targetId ?? 'forge', 2, `forge:${command.targetId ?? ''}`, {
          forged: true,
          attributedTo: ctx.state.mission.attributionTarget ?? contract?.missionRules.targetFrameIdentity ?? 'UNKNOWN',
        });
        emit(
          ctx,
          'LOGS_FORGED',
          'script',
          { surface: command.textArg ?? '', signature: command.targetId ?? '' },
          command.line,
        );
        break;
      case 'logs.overwrite': {
        const count = overwriteEvidence(ctx, command.textArg ?? 'PROCESS', command.targetId ?? 'overwrite');
        emit(
          ctx,
          'LOGS_OVERWRITTEN',
          'script',
          { surface: command.textArg ?? '', target: command.targetId ?? '', count },
          command.line,
        );
        break;
      }
      case 'evidence.frame':
        if (command.textArg) {
          ctx.state.mission.attributionTarget = command.textArg;
          trackObjectiveProgress(ctx, 'frameSet');
          shiftEvidenceAttribution(ctx, command.textArg);
        }
        emit(ctx, 'EVIDENCE_FRAME_SET', 'script', { target: command.textArg ?? null }, command.line);
        break;
      case 'identity.assume':
        if (command.textArg) {
          ctx.state.mission.identityState = command.textArg;
          recordEvidence(ctx, 'AUTH', 'IDENTITY', 1, `identity_assume:${command.textArg}`, {
            forged: true,
            attributedTo: command.textArg,
          });
        }
        emit(ctx, 'ACCESS_SPOOF_APPLIED', 'script', { terminalId: 'identity', identity: command.textArg ?? '' }, command.line);
        break;
      case 'narrative.ticket':
        emit(
          ctx,
          'LOG',
          'script',
          { message: `ticket ${command.targetId ?? 'N/A'} filed: ${command.textArg ?? ''}` },
          command.line,
        );
        if (command.targetId) {
          touchMissionNode(ctx, command.targetId, { nodeType: 'SYSTEM', accessState: 'CONTROLLED' });
          recordEvidence(ctx, 'PROCESS', command.targetId, 1, `ticket:${command.textArg ?? ''}`, {
            forged: true,
            attributedTo: ctx.state.mission.identityState || 'UNKNOWN',
          });
        }
        break;
      case 'log':
        emit(ctx, 'LOG', 'script', { message: command.textArg ?? '' }, command.line);
        break;
      case 'wait':
      default:
        break;
    }
  }
}

function updateDeviceTimers(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type === 'camera') {
      const camera = device;
      if (!camera.enabled && camera.disabledUntilTick !== null && ctx.state.tick >= camera.disabledUntilTick) {
        camera.enabled = true;
        camera.disabledUntilTick = null;
        emit(ctx, 'DEVICE_ENABLED', 'system', { deviceId: camera.id });
      }
    }
  }
}

function updateDroneMovement(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'drone') {
      continue;
    }
    const drone = device;
    if (!drone.enabled || !drone.alive || drone.path.length < 2) {
      continue;
    }

    drone.stepTimer += 1;
    if (drone.stepTimer < drone.stepInterval) {
      continue;
    }

    drone.stepTimer = 0;
    drone.pathIndex = (drone.pathIndex + 1) % drone.path.length;
    const point = drone.path[drone.pathIndex];
    drone.x = point.x;
    drone.y = point.y;
  }
}

function updateCameraDetection(ctx: TickContext): boolean {
  if (isMissionMode(ctx)) {
    let detected = false;
    const alarm = getAlarm(ctx.state);
    const detectionPressure =
      ctx.noisyScriptActionsThisTick > 0 ||
      alarm?.state === 'RED' ||
      ctx.state.mission.trace.progress >= 70;

    for (const device of Object.values(ctx.state.devices)) {
      if (device.type !== 'camera') {
        continue;
      }
      const camera = device;
      const wasDetecting = ctx.cameraDetectionMemory[camera.id] ?? false;
      const nowDetecting = camera.enabled && detectionPressure;
      if (!nowDetecting) {
        ctx.cameraDetectionMemory[camera.id] = false;
        continue;
      }
      detected = true;
      if (!wasDetecting) {
        emit(ctx, 'CAMERA_DETECTED_PLAYER', 'detection', { cameraId: camera.id, player: 'session' });
        recordEvidence(ctx, 'ALARM', camera.id, 2, `camera_detected:${camera.id}`);
      }
      ctx.cameraDetectionMemory[camera.id] = true;
    }

    if (detected) {
      ctx.state.mission.detectedAtLeastOnce = true;
    }
    return detected;
  }

  if (!ctx.state.player.alive) {
    for (const device of Object.values(ctx.state.devices)) {
      if (device.type === 'camera') {
        ctx.cameraDetectionMemory[device.id] = false;
      }
    }
    return false;
  }

  let detected = false;
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'camera') {
      continue;
    }
    const camera = device;
    const wasDetecting = ctx.cameraDetectionMemory[camera.id] ?? false;
    if (!camera.enabled) {
      ctx.cameraDetectionMemory[camera.id] = false;
      continue;
    }

    const inRange = distance(camera, ctx.state.player) <= camera.range;
    const nowDetecting = inRange && facingMatches(camera, ctx.state.player);
    if (!nowDetecting) {
      ctx.cameraDetectionMemory[camera.id] = false;
      continue;
    }

    detected = true;
    if (!wasDetecting) {
      emit(ctx, 'CAMERA_DETECTED_PLAYER', 'detection', { cameraId: camera.id, player: 'agent' });
      recordEvidence(ctx, 'ALARM', camera.id, 2, `camera_detected:${camera.id}`);
    }
    ctx.cameraDetectionMemory[camera.id] = true;
  }

  if (detected && isMissionMode(ctx)) {
    ctx.state.mission.detectedAtLeastOnce = true;
  }
  return detected;
}

function applyDoorLockdown(ctx: TickContext): void {
  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'door') {
      continue;
    }
    const door = device;
    if (!door.closesOnAlarmRed || !door.isOpen) {
      continue;
    }
    door.isOpen = false;
    emit(ctx, 'DOOR_CLOSED', 'alarm', { doorId: door.id, reason: 'alarm_lockdown' });
    recordEvidence(ctx, 'ALARM', door.id, 2, `lockdown_close:${door.id}`);
  }
}

function updateAlarmBus(ctx: TickContext, detected: boolean): void {
  const alarm = getAlarm(ctx.state);
  if (!alarm) {
    return;
  }

  if (detected && alarm.state === 'GREEN') {
    const before = alarm.state;
    alarm.state = 'YELLOW';
    alarm.redAtTick = ctx.state.tick + alarm.baseEscalationTicks + alarm.manualDelayBuffer;
    alarm.manualDelayBuffer = 0;
    emit(ctx, 'ALARM_STATE_CHANGED', 'alarm', { from: before, to: alarm.state });
    recordEvidence(ctx, 'ALARM', alarm.id, 2, `alarm_state:${before}_to_${alarm.state}`);
  }

  if (alarm.state === 'YELLOW' && alarm.redAtTick !== null && ctx.state.tick >= alarm.redAtTick) {
    const before = alarm.state;
    alarm.state = 'RED';
    alarm.redAtTick = null;
    emit(ctx, 'ALARM_STATE_CHANGED', 'alarm', { from: before, to: alarm.state });
    recordEvidence(ctx, 'ALARM', alarm.id, 3, `alarm_state:${before}_to_${alarm.state}`);
    applyDoorLockdown(ctx);
  }
}

function updateTrace(ctx: TickContext, detected: boolean): void {
  if (!isMissionMode(ctx)) {
    return;
  }

  const sources: TraceSource[] = [];
  let delta = 0.2;
  sources.push({ id: 'base', label: 'Persistent connection window', delta: 0.2 });

  const globalHeat = ctx.missionConfig?.globalHeat ?? 0;
  if (globalHeat > 0) {
    const heatDelta = Math.min(2, globalHeat * 0.04);
    delta += heatDelta;
    sources.push({ id: 'global_heat', label: `Global heat (${globalHeat})`, delta: heatDelta });
  }

  if (detected) {
    delta += 3;
    sources.push({ id: 'detection', label: 'Camera detection', delta: 3 });
  }

  const alarm = getAlarm(ctx.state);
  if (alarm?.state === 'RED') {
    delta += 2;
    sources.push({ id: 'alarm_red', label: 'Alarm RED escalation', delta: 2 });
  } else if (alarm?.state === 'YELLOW') {
    delta += 1;
    sources.push({ id: 'alarm_yellow', label: 'Alarm YELLOW tracking', delta: 1 });
  }

  if (ctx.noisyScriptActionsThisTick > 0) {
    delta += ctx.noisyScriptActionsThisTick;
    sources.push({
      id: 'noisy_actions',
      label: `Noisy tool executions x${ctx.noisyScriptActionsThisTick}`,
      delta: ctx.noisyScriptActionsThisTick,
    });
  }

  if (ctx.state.mission.trace.relays.length > 0) {
    const relayDelta = Math.min(2, ctx.state.mission.trace.relays.length * 0.5);
    delta -= relayDelta;
    sources.push({
      id: 'relay',
      label: `Relay routing (${ctx.state.mission.trace.relays.length})`,
      delta: -relayDelta,
    });
  }

  if (ctx.state.mission.trace.decoyBuffer > 0) {
    ctx.state.mission.trace.decoyBuffer -= 1;
    delta -= 1;
    sources.push({ id: 'decoy', label: 'Decoy burst absorption', delta: -1 });
  }

  if (ctx.state.mission.phase === 'CLEANUP') {
    const unsanitized = ctx.state.mission.evidence.filter(
      (evidence) => !evidence.scrubbed && !evidence.hidden && (evidence.attributedTo ?? 'OPERATOR') === 'OPERATOR',
    );
    if (unsanitized.length > 0) {
      delta += 1;
      sources.push({ id: 'cleanup_exposure', label: 'Unsanitized operator evidence', delta: 1 });
    }
  }

  const previous = ctx.state.mission.trace.progress;
  const next = Math.max(0, Math.min(100, previous + delta));
  ctx.state.mission.trace.progress = next;
  ctx.state.mission.trace.ratePerTick = delta;
  ctx.state.mission.trace.sources = sources;
  ctx.state.mission.trace.lockRisk = Number(next.toFixed(2));
  ctx.state.mission.trace.lockedOn = ctx.state.mission.trace.lockRisk >= 75;

  emit(ctx, 'TRACE_UPDATED', 'trace', { delta: Number(delta.toFixed(2)), progress: Number(next.toFixed(2)) });

  for (const threshold of [25, 50, 75, 100]) {
    if (previous < threshold && next >= threshold && !ctx.state.mission.trace.thresholdEventsFired.includes(threshold)) {
      ctx.state.mission.trace.thresholdEventsFired.push(threshold);
      emit(ctx, 'TRACE_THRESHOLD_REACHED', 'trace', { threshold, progress: Number(next.toFixed(2)) });
    }
  }

  if (next >= 100) {
    recalculateAttribution(ctx);
    const attributedTo = ctx.state.mission.attribution.suspectedActor ?? 'OPERATOR';
    emit(ctx, 'TRACE_MAXED', 'trace', { attributedTo });
    if (!ctx.missionConfig?.contract.missionRules.allowTraceOverflow) {
      ctx.state.outcome = 'failure';
      setMissionPhase(ctx, 'FAILED');
    }
  }
}

function resolveTarget(state: SimulationState, preferredTargetId: string | null): TargetInfo | undefined {
  const playerTarget: TargetInfo | undefined = state.player.alive
    ? { id: 'player', kind: 'player', x: state.player.x, y: state.player.y }
    : undefined;

  if (preferredTargetId) {
    const preferred = state.devices[preferredTargetId];
    if (preferred && preferred.type === 'drone' && preferred.alive && preferred.enabled) {
      return {
        id: preferred.id,
        kind: 'drone',
        x: preferred.x,
        y: preferred.y,
      };
    }
  }

  return playerTarget;
}

function updateTurrets(ctx: TickContext, detected: boolean): void {
  if (isMissionMode(ctx)) {
    const alarm = getAlarm(ctx.state);
    if (alarm?.state !== 'RED') {
      return;
    }
    for (const device of Object.values(ctx.state.devices)) {
      if (device.type !== 'turret' || !device.enabled) {
        continue;
      }
      emit(ctx, 'TURRET_TARGET_LOCK', 'combat', { turretId: device.id, targetId: 'session' });
      emit(ctx, 'TURRET_FIRED', 'combat', { turretId: device.id, targetId: 'session' });
      recordEvidence(ctx, 'ALARM', device.id, 2, `turret_fire:session`);
    }
    return;
  }

  const alarm = getAlarm(ctx.state);

  for (const device of Object.values(ctx.state.devices)) {
    if (device.type !== 'turret') {
      continue;
    }

    const turret = device;
    if (!turret.enabled) {
      continue;
    }

    const active =
      turret.alarmTrigger === 'ALWAYS' ||
      (turret.alarmTrigger === 'RED' && alarm?.state === 'RED') ||
      (turret.alarmTrigger === 'DETECTION' && (detected || turret.currentTargetId !== null));
    if (!active) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    const target = resolveTarget(ctx.state, turret.desiredTargetId);
    if (!target) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    if (distance(turret, target) > turret.range) {
      turret.currentTargetId = null;
      turret.lockTicks = 0;
      continue;
    }

    if (turret.currentTargetId !== target.id) {
      turret.currentTargetId = target.id;
      turret.lockTicks = 1;
      emit(ctx, 'TURRET_TARGET_LOCK', 'combat', { turretId: turret.id, targetId: target.id });
    } else {
      turret.lockTicks += 1;
    }

    if (turret.lockTicks < turret.lockDelay) {
      continue;
    }

    emit(ctx, 'TURRET_FIRED', 'combat', { turretId: turret.id, targetId: target.id });
    recordEvidence(ctx, 'ALARM', turret.id, 3, `turret_fire:${target.id}`);

    if (target.kind === 'player' && ctx.state.player.alive) {
      ctx.state.player.alive = false;
      emit(ctx, 'PLAYER_KILLED', 'combat', { turretId: turret.id });
    }

    if (target.kind === 'drone') {
      const drone = getDevice(ctx.state, target.id, 'drone');
      if (drone?.alive) {
        drone.alive = false;
        drone.enabled = false;
        emit(ctx, 'DRONE_DESTROYED', 'combat', { droneId: drone.id, turretId: turret.id });
      }
    }

    turret.lockTicks = 0;
  }
}

function findBlockingDoor(state: SimulationState, x: number, y: number): DoorDevice | undefined {
  for (const device of Object.values(state.devices)) {
    if (device.type !== 'door') {
      continue;
    }
    if (!device.isOpen && device.x === x && device.y === y) {
      return device;
    }
  }
  return undefined;
}

function updatePlayerMovement(ctx: TickContext): void {
  if (isMissionMode(ctx)) {
    return;
  }
  const player = ctx.state.player;
  if (!player.alive || player.reachedExit) {
    return;
  }

  const next = ctx.level.playerPath[player.pathIndex + 1];
  if (!next) {
    if (player.x === ctx.level.exit.x && player.y === ctx.level.exit.y) {
      player.reachedExit = true;
      emit(ctx, 'PLAYER_REACHED_EXIT', 'movement', { exit: 'goal' });
    }
    return;
  }

  const door = findBlockingDoor(ctx.state, next.x, next.y);
  if (door) {
    if (player.blockedByDoorId !== door.id) {
      emit(ctx, 'PLAYER_BLOCKED_BY_DOOR', 'movement', { doorId: door.id });
    }
    player.blockedByDoorId = door.id;
    return;
  }

  player.blockedByDoorId = null;
  player.x = next.x;
  player.y = next.y;
  player.pathIndex += 1;

  if (player.x === ctx.level.exit.x && player.y === ctx.level.exit.y) {
    player.reachedExit = true;
    emit(ctx, 'PLAYER_REACHED_EXIT', 'movement', { exit: 'goal' });
  }
}

function evaluateObjectiveComplete(ctx: TickContext): boolean {
  const contract = ctx.missionConfig?.contract;
  if (!contract) {
    return ctx.state.player.reachedExit;
  }

  const flags = ctx.state.mission.objectiveFlags;
  switch (contract.objectiveType) {
    case 'RETRIEVE':
      return flags.fileCopied;
    case 'DELETE':
      return flags.fileDeleted;
    case 'ALTER':
      return flags.recordAltered;
    case 'SABOTAGE':
      return flags.sabotageDone;
    case 'FRAME':
      return flags.frameSet && (flags.sabotageDone || flags.fileDeleted || flags.recordAltered || flags.fileCopied);
    case 'ESCORT':
      return flags.exfilCommitted;
    case 'EXFIL':
    default:
      return flags.exfilCommitted;
  }
}

function updateObjectiveProgress(ctx: TickContext): void {
  if (!isMissionMode(ctx) || ctx.state.mission.objectiveCompleted) {
    return;
  }
  const objectiveComplete = evaluateObjectiveComplete(ctx);
  if (!objectiveComplete) {
    return;
  }

  ctx.state.mission.objectiveCompleted = true;
  emit(ctx, 'OBJECTIVE_COMPLETED', 'objective', { objectiveType: ctx.missionConfig?.contract.objectiveType ?? 'EXFIL' });

  const rules = ctx.missionConfig?.contract.missionRules;
  const cleanupRequired = Boolean(rules?.requireNoTrace || rules?.allowFrameTarget || rules?.forcedDetection);
  ctx.state.mission.cleanupRequired = cleanupRequired;

  if (!cleanupRequired) {
    ctx.state.outcome = 'success';
    setMissionPhase(ctx, 'COMPLETE');
    return;
  }

  const window = Math.max(8, rules?.cleanupWindowTicks ?? 20);
  ctx.state.mission.cleanupDeadlineTick = ctx.state.tick + window;
  setMissionPhase(ctx, 'CLEANUP');
}

function isCleanupSatisfied(ctx: TickContext): { ok: boolean; reason?: string; attributedTo?: string } {
  const contract = ctx.missionConfig?.contract;
  if (!contract) {
    return { ok: true };
  }

  const rules = contract.missionRules;
  const attribution = ctx.state.mission.attribution;
  const unsanitizedOperatorEvidence = ctx.state.mission.evidence.filter(
    (evidence) =>
      !evidence.scrubbed &&
      !evidence.hidden &&
      (evidence.attributedTo ?? 'OPERATOR') === 'OPERATOR' &&
      evidence.severity >= 2,
  );
  const frameTarget = rules.targetFrameIdentity ?? ctx.state.mission.attributionTarget ?? null;
  const traceTolerance = rules.traceTolerance ?? (rules.requireNoTrace ? 40 : 100);
  const framedEvidence = frameTarget
    ? ctx.state.mission.evidence.filter(
        (evidence) => !evidence.scrubbed && (evidence.attributedTo ?? '') === frameTarget && (evidence.forged ?? false),
      )
    : [];

  if (rules.requireNoTrace) {
    if (ctx.state.mission.trace.progress >= traceTolerance) {
      return { ok: false, reason: 'trace_above_clean_threshold', attributedTo: 'OPERATOR' };
    }
    if (unsanitizedOperatorEvidence.length > 0) {
      return { ok: false, reason: 'operator_evidence_remaining', attributedTo: 'OPERATOR' };
    }
    if (attribution.suspectedActor === 'OPERATOR' && attribution.confidence >= 0.6) {
      return { ok: false, reason: 'operator_attribution_confident', attributedTo: 'OPERATOR' };
    }
  }

  if (rules.allowFrameTarget) {
    if (!frameTarget) {
      return { ok: false, reason: 'missing_frame_target', attributedTo: 'OPERATOR' };
    }
    if (framedEvidence.length === 0) {
      return { ok: false, reason: 'no_framed_evidence', attributedTo: 'OPERATOR' };
    }
    if (unsanitizedOperatorEvidence.length > 0) {
      return { ok: false, reason: 'operator_evidence_remaining', attributedTo: 'OPERATOR' };
    }
    if (attribution.suspectedActor !== frameTarget || attribution.confidence < 0.6) {
      return {
        ok: false,
        reason: 'frame_target_not_confirmed',
        attributedTo: attribution.suspectedActor || 'OPERATOR',
      };
    }
  }

  if (!rules.allowTraceOverflow && ctx.state.mission.trace.progress >= traceTolerance) {
    return { ok: false, reason: 'trace_tolerance_exceeded', attributedTo: attribution.suspectedActor || 'OPERATOR' };
  }

  if (rules.forcedDetection && !ctx.state.mission.detectedAtLeastOnce) {
    return { ok: false, reason: 'forced_detection_not_triggered', attributedTo: 'OPERATOR' };
  }

  if (rules.forcedDetection && !rules.allowFrameTarget) {
    if (attribution.suspectedActor === 'OPERATOR' && attribution.confidence >= 0.6) {
      return { ok: false, reason: 'operator_attribution_after_diversion', attributedTo: 'OPERATOR' };
    }
  }

  return { ok: true, attributedTo: attribution.suspectedActor ?? frameTarget ?? 'UNKNOWN' };
}

function updateCleanupProgress(ctx: TickContext): void {
  if (!isMissionMode(ctx) || ctx.state.mission.phase !== 'CLEANUP') {
    return;
  }

  const cleanup = isCleanupSatisfied(ctx);
  if (cleanup.ok) {
    ctx.state.mission.cleanupCompleted = true;
    emit(ctx, 'CLEANUP_COMPLETED', 'mission', { attributedTo: cleanup.attributedTo ?? 'UNKNOWN' });
    ctx.state.outcome = 'success';
    setMissionPhase(ctx, 'COMPLETE');
    return;
  }

  const deadline = ctx.state.mission.cleanupDeadlineTick;
  if (deadline !== null && ctx.state.tick >= deadline) {
    emit(ctx, 'CLEANUP_FAILED', 'mission', { reason: cleanup.reason ?? 'cleanup_incomplete', attributedTo: cleanup.attributedTo ?? 'OPERATOR' });
    ctx.state.outcome = 'failure';
    setMissionPhase(ctx, 'FAILED');
  }
}

function checkWinLose(ctx: TickContext): boolean {
  if (!ctx.state.player.alive) {
    if (!isMissionMode(ctx)) {
      ctx.state.outcome = 'failure';
      setMissionPhase(ctx, 'FAILED');
      return true;
    }
    const objectiveType = ctx.missionConfig?.contract.objectiveType ?? 'EXFIL';
    if (objectiveType === 'EXFIL' || objectiveType === 'ESCORT') {
      ctx.state.outcome = 'failure';
      setMissionPhase(ctx, 'FAILED');
      return true;
    }
  }

  if (!isMissionMode(ctx) && ctx.state.player.reachedExit) {
    ctx.state.outcome = 'success';
    return true;
  }

  if (ctx.state.outcome !== 'running') {
    return true;
  }

  return false;
}

function buildCommandsByTick(commands: CompiledCommand[]): Map<number, CompiledCommand[]> {
  const byTick = new Map<number, CompiledCommand[]>();

  for (const command of commands) {
    const arr = byTick.get(command.tick);
    if (arr) {
      arr.push(command);
    } else {
      byTick.set(command.tick, [command]);
    }
  }

  return byTick;
}

function initializeMissionState(ctx: TickContext): void {
  if (!isMissionMode(ctx)) {
    return;
  }
  const contract = ctx.missionConfig?.contract;
  ctx.state.mission.cleanupRequired = Boolean(
    contract?.missionRules.requireNoTrace ||
      contract?.missionRules.allowFrameTarget ||
      contract?.missionRules.forcedDetection,
  );
  if (contract?.missionRules.targetFrameIdentity) {
    ctx.state.mission.attributionTarget = contract.missionRules.targetFrameIdentity;
  }
  for (const nodeId of contract?.siteNodes ?? []) {
    touchMissionNode(ctx, nodeId, {
      nodeType: 'SYSTEM',
      accessState: 'VISIBLE',
      riskState: 'LOW',
    });
  }
  for (const fileId of contract?.fileTargets ?? []) {
    touchMissionNode(ctx, fileId, { nodeType: 'FILE', accessState: 'VISIBLE', riskState: 'LOW' });
  }
  for (const recordId of contract?.recordTargets ?? []) {
    touchMissionNode(ctx, recordId, { nodeType: 'RECORD', accessState: 'VISIBLE', riskState: 'LOW' });
  }
  for (const authId of contract?.authEndpoints ?? []) {
    touchMissionNode(ctx, authId, { nodeType: 'AUTH', accessState: 'VISIBLE', riskState: 'LOW' });
  }
}

export function runTickEngine(
  level: LevelDefinition,
  commands: CompiledCommand[],
  missionConfig?: MissionConfig,
): SimulationResult {
  const requestedTickLimit = missionConfig?.contract.missionRules.tickLimit ?? level.constraints.tickLimit;
  const tickLimit = Math.min(requestedTickLimit, GLOBAL_TICK_LIMIT);
  const state = createInitialSimulationState(level);
  const commandsByTick = buildCommandsByTick(commands);
  const events: EventRecord[] = [];
  const frames: SimulationResult['frames'] = [];

  const ctx: TickContext = {
    state,
    level,
    tickLimit,
    missionConfig,
    commandsByTick,
    cameraDetectionMemory: {},
    eventsThisTick: [],
    events,
    executedLines: [],
    nextEventId: 1,
    noisyScriptActionsThisTick: 0,
  };

  initializeMissionState(ctx);
  evaluateMissionOutcome(ctx);
  frames.push(buildFrame(ctx.state, [], []));

  while (ctx.state.outcome === 'running') {
    ctx.eventsThisTick = [];
    ctx.executedLines = [];
    ctx.noisyScriptActionsThisTick = 0;

    if (isMissionMode(ctx) && ctx.state.mission.phase === 'PLANNING') {
      setMissionPhase(ctx, 'OBJECTIVE');
    }

    if (ctx.state.tick >= ctx.tickLimit) {
      emit(ctx, 'RUN_TIMEOUT', 'system', { tickLimit: ctx.tickLimit });
      if (isMissionMode(ctx) && ctx.state.mission.phase === 'CLEANUP') {
        emit(ctx, 'CLEANUP_FAILED', 'mission', { reason: 'cleanup_timeout', attributedTo: 'OPERATOR' });
      }
      ctx.state.outcome = 'failure';
      setMissionPhase(ctx, 'FAILED');
      recalculateAttribution(ctx);
      evaluateMissionOutcome(ctx);

      const frame = buildFrame(ctx.state, ctx.eventsThisTick, ctx.executedLines);
      frames.push(frame);
      events.push(...ctx.eventsThisTick);
      break;
    }

    applyScheduledScriptActions(ctx);
    updateDeviceTimers(ctx);
    updateDroneMovement(ctx);
    const detected = updateCameraDetection(ctx);
    updateAlarmBus(ctx, detected);
    updateTrace(ctx, detected);
    updateTurrets(ctx, detected);
    updatePlayerMovement(ctx);
    updateObjectiveProgress(ctx);
    recalculateAttribution(ctx);
    updateCleanupProgress(ctx);
    evaluateMissionOutcome(ctx);

    const done = checkWinLose(ctx);
    ctx.state.tick += 1;

    if (!done && ctx.state.tick >= ctx.tickLimit) {
      emit(ctx, 'RUN_TIMEOUT', 'system', { tickLimit: ctx.tickLimit });
      ctx.state.outcome = 'failure';
      setMissionPhase(ctx, 'FAILED');
      recalculateAttribution(ctx);
      evaluateMissionOutcome(ctx);
    }

    const frame = buildFrame(ctx.state, ctx.eventsThisTick, ctx.executedLines);
    frames.push(frame);
    events.push(...ctx.eventsThisTick);

    if (ctx.state.outcome !== 'running') {
      const killedThisTick = ctx.eventsThisTick.some((event) => event.type === 'PLAYER_KILLED');
      if (killedThisTick) {
        ctx.state.tick += 1;
        frames.push(buildFrame(ctx.state, [], []));
      }
      break;
    }
  }

  const outcome = ctx.state.outcome === 'success' ? 'success' : 'failure';
  const failureSummary = outcome === 'failure' ? buildFailureSummary(events) : undefined;

  return {
    frames,
    events,
    outcome,
    missionOutcome: ctx.state.mission.outcome,
    finalTick: ctx.state.tick,
    tickLimit,
    failureSummary,
  };
}
