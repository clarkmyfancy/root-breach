import type { EventRecord } from '../../game/engine/eventTypes';

interface EventLogPanelProps {
  events: EventRecord[];
  highlighted?: boolean;
}

function formatEvent(event: EventRecord): string {
  switch (event.type) {
    case 'CAMERA_DETECTED_PLAYER':
      return `${event.payload.cameraId} detected player`;
    case 'ALARM_STATE_CHANGED':
      return `Alarm ${event.payload.from} -> ${event.payload.to}`;
    case 'SCRIPT_LINE_EXECUTED':
      return `line ${event.payload.line} executed (${event.payload.kind})`;
    case 'DEVICE_DISABLED':
      return `Disabled ${event.payload.deviceId}`;
    case 'DEVICE_ENABLED':
      return `Enabled ${event.payload.deviceId}`;
    case 'TURRET_RETARGETED':
      return `${event.payload.turretId} retargeted to ${event.payload.targetId}`;
    case 'DOOR_OPENED':
      return `Door ${event.payload.doorId} opened`;
    case 'DOOR_CLOSED':
      return `Door ${event.payload.doorId} closed`;
    case 'ALARM_DELAY_APPLIED':
      return `Alarm delayed by ${event.payload.amount} ticks`;
    case 'DEVICE_TAGGED':
      return `${event.payload.deviceId} tagged ${event.payload.tag}`;
    case 'TRACE_SPOOFED':
      return `Trace signature spoofed: ${event.payload.label}`;
    case 'NODE_SCANNED':
      return `Node scan ${event.payload.nodeId}`;
    case 'DEVICE_SCANNED':
      return `Device scan ${event.payload.deviceId}`;
    case 'ROUTE_SCANNED':
      return 'Route topology scanned';
    case 'LOG_SURFACE_PROBED':
      return `Log surface probe ${event.payload.surface}`;
    case 'ACCESS_BYPASS_APPLIED':
      return `Door bypass ${event.payload.doorId}`;
    case 'ACCESS_SPOOF_APPLIED':
      return `Terminal spoof ${event.payload.terminalId} as ${event.payload.identity}`;
    case 'ACCESS_TOKEN_REPLAYED':
      return `Replay token on ${event.payload.authId}`;
    case 'FILE_COPIED':
      return `File copied ${event.payload.fileId}`;
    case 'FILE_DELETED':
      return `File deleted ${event.payload.fileId}`;
    case 'RECORD_ALTERED':
      return `Record altered ${event.payload.recordId}`;
    case 'DEVICE_SABOTAGED':
      return `Device sabotaged ${event.payload.deviceId}`;
    case 'ROUTE_RELAY_APPLIED':
      return `Relay routed through ${event.payload.nodeId}`;
    case 'ROUTE_AGENT_SELECTED':
      return `Agent route selected ${event.payload.route}`;
    case 'DECOY_BURST_APPLIED':
      return `Decoy burst ${event.payload.amount}`;
    case 'LOGS_SCRUBBED':
      return `Logs scrubbed ${event.payload.surface} (${event.payload.count})`;
    case 'LOGS_FORGED':
      return `Logs forged ${event.payload.surface}`;
    case 'LOGS_OVERWRITTEN':
      return `Logs overwritten ${event.payload.surface} (${event.payload.count})`;
    case 'EVIDENCE_FRAME_SET':
      return `Frame target set ${event.payload.target}`;
    case 'EVIDENCE_LOGGED':
      return `Evidence ${event.payload.surface} at ${event.payload.siteNodeId}`;
    case 'EVIDENCE_ATTRIBUTION_SHIFTED':
      return `Attribution shifted to ${event.payload.target}`;
    case 'TRACE_UPDATED':
      return `Trace ${event.payload.progress}% (${event.payload.delta}/tick)`;
    case 'TRACE_THRESHOLD_REACHED':
      return `Trace threshold ${event.payload.threshold}% reached`;
    case 'TRACE_MAXED':
      return 'Trace maxed out';
    case 'MISSION_PHASE_CHANGED':
      return `Mission phase ${event.payload.from} -> ${event.payload.to}`;
    case 'OBJECTIVE_PROGRESS':
      return `Objective progress ${event.payload.objectiveKey}`;
    case 'OBJECTIVE_COMPLETED':
      return 'Objective completed';
    case 'CLEANUP_COMPLETED':
      return 'Cleanup completed';
    case 'CLEANUP_FAILED':
      return `Cleanup failed (${event.payload.reason})`;
    case 'TURRET_TARGET_LOCK':
      return `Turret ${event.payload.turretId} locked ${event.payload.targetId}`;
    case 'TURRET_FIRED':
      return `Turret ${event.payload.turretId} fired at ${event.payload.targetId}`;
    case 'DRONE_DESTROYED':
      return `Drone ${event.payload.droneId} destroyed`;
    case 'PLAYER_BLOCKED_BY_DOOR':
      return `Player blocked by ${event.payload.doorId}`;
    case 'PLAYER_KILLED':
      return `Player killed by ${event.payload.turretId}`;
    case 'PLAYER_REACHED_EXIT':
      return 'Player reached exit';
    case 'RUN_TIMEOUT':
      return 'Run timed out';
    case 'LOG':
      return String(event.payload.message ?? '');
    default:
      return event.type;
  }
}

export function EventLogPanel({ events, highlighted = false }: EventLogPanelProps): JSX.Element {
  const rows = events.slice(-180).reverse();

  return (
    <div className={`panel panel-log ${highlighted ? 'tutorial-focus' : ''}`}>
      <div className="panel__title">Event Log</div>
      <div className="event-log">
        {rows.map((event) => (
          <div className="event-row" key={event.id}>
            <span className="event-tick">[{event.tick}]</span>
            <span>{formatEvent(event)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
