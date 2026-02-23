import { useMemo } from 'react';
import type { EventRecord } from '../../game/engine/eventTypes';

interface TimelinePanelProps {
  tick: number;
  tickLimit: number;
  events: EventRecord[];
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function TimelinePanel({ tick, tickLimit, events }: TimelinePanelProps): JSX.Element {
  const effectiveLimit = Math.max(1, tickLimit);
  const windows = [
    { id: 'maintenance', label: 'Maintenance', start: 0.2, end: 0.35 },
    { id: 'backup', label: 'Backup Sync', start: 0.5, end: 0.65 },
    { id: 'audit', label: 'Audit Sweep', start: 0.8, end: 0.95 },
  ];

  const markers = useMemo(() => {
    return events
      .filter((event) =>
        [
          'TRACE_THRESHOLD_REACHED',
          'ALARM_STATE_CHANGED',
          'OBJECTIVE_COMPLETED',
          'MISSION_PHASE_CHANGED',
          'CLEANUP_COMPLETED',
          'CLEANUP_FAILED',
        ].includes(event.type),
      )
      .slice(-16)
      .map((event) => ({
        id: event.id,
        tick: event.tick,
        left: clampPct((event.tick / effectiveLimit) * 100),
        label: event.message,
      }));
  }, [events, effectiveLimit]);

  const progressPct = clampPct((tick / effectiveLimit) * 100);

  return (
    <div className="panel panel-timeline">
      <div className="panel__title">Timeline</div>
      <div className="timeline-track">
        {windows.map((window) => (
          <div
            key={window.id}
            className="timeline-window"
            style={{
              left: `${window.start * 100}%`,
              width: `${(window.end - window.start) * 100}%`,
            }}
            title={`${window.label} window`}
          >
            {window.label}
          </div>
        ))}
        {markers.map((marker) => (
          <div key={marker.id} className="timeline-marker" style={{ left: `${marker.left}%` }} title={marker.label} />
        ))}
        <div className="timeline-cursor" style={{ left: `${progressPct}%` }} />
      </div>
      <div className="timeline-meta">
        <span>Tick {tick}/{effectiveLimit}</span>
        <span>{markers.length} markers</span>
      </div>
      <div className="timeline-list">
        {markers.slice().reverse().map((marker) => (
          <div key={`row-${marker.id}`} className="timeline-list-row">
            [{marker.tick}] {marker.label}
          </div>
        ))}
      </div>
    </div>
  );
}
