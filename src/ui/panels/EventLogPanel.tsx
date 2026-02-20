import type { EventRecord } from '../../game/engine/eventTypes';

interface EventLogPanelProps {
  events: EventRecord[];
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

export function EventLogPanel({ events }: EventLogPanelProps): JSX.Element {
  const rows = events.slice(-180).reverse();

  return (
    <div className="panel panel-log">
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
