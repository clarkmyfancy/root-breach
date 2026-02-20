import type { Device } from '../../game/models/types';

interface InspectorPanelProps {
  device: Device | null;
}

function serializeDevice(device: Device): string[] {
  const rows: string[] = [
    `id: ${device.id}`,
    `type: ${device.type}`,
    `x: ${device.x}`,
    `y: ${device.y}`,
    `enabled: ${device.enabled}`,
  ];

  switch (device.type) {
    case 'camera':
      rows.push(`facing: ${device.facing}`);
      rows.push(`range: ${device.range}`);
      rows.push(`disabledUntilTick: ${device.disabledUntilTick ?? '-'}`);
      break;
    case 'door':
      rows.push(`isOpen: ${device.isOpen}`);
      rows.push(`closesOnAlarmRed: ${Boolean(device.closesOnAlarmRed)}`);
      break;
    case 'turret':
      rows.push(`range: ${device.range}`);
      rows.push(`lockDelay: ${device.lockDelay}`);
      rows.push(`alarmTrigger: ${device.alarmTrigger}`);
      rows.push(`desiredTarget: ${device.desiredTargetId ?? '-'}`);
      rows.push(`currentTarget: ${device.currentTargetId ?? '-'}`);
      rows.push(`lockTicks: ${device.lockTicks}`);
      break;
    case 'drone':
      rows.push(`alive: ${device.alive}`);
      rows.push(`pathIndex: ${device.pathIndex}`);
      rows.push(`stepInterval: ${device.stepInterval}`);
      break;
    case 'alarm':
      rows.push(`state: ${device.state}`);
      rows.push(`redAtTick: ${device.redAtTick ?? '-'}`);
      rows.push(`manualDelayBuffer: ${device.manualDelayBuffer}`);
      break;
    default:
      break;
  }

  return rows;
}

export function InspectorPanel({ device }: InspectorPanelProps): JSX.Element {
  return (
    <div className="panel panel-inspector">
      <div className="panel__title">Inspector</div>
      {device ? (
        <div className="inspector-list">
          {serializeDevice(device).map((row) => (
            <div key={row}>{row}</div>
          ))}
        </div>
      ) : (
        <div className="muted">Click a device in the map to inspect.</div>
      )}
    </div>
  );
}
