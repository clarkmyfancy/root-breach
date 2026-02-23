import { useMemo, useState } from 'react';
import type { EventCategory } from '../../game/engine/eventTypes';
import type { EventRecord } from '../../game/engine/eventTypes';

interface EventLogPanelProps {
  events: EventRecord[];
  highlighted?: boolean;
}

type EventFilter = 'ALL' | EventCategory;

export function EventLogPanel({ events, highlighted = false }: EventLogPanelProps): JSX.Element {
  const [filter, setFilter] = useState<EventFilter>('ALL');

  const rows = useMemo(() => {
    const visible = filter === 'ALL' ? events : events.filter((event) => event.category === filter);
    return visible.slice(-180).reverse();
  }, [events, filter]);

  return (
    <div className={`panel panel-log ${highlighted ? 'tutorial-focus' : ''}`}>
      <div className="panel__title">Event Log</div>
      <div className="forensics-filters">
        <select value={filter} onChange={(event) => setFilter(event.target.value as EventFilter)}>
          <option value="ALL">All Events</option>
          <option value="COMMAND">COMMAND</option>
          <option value="AUTH">AUTH</option>
          <option value="DEVICE">DEVICE</option>
          <option value="FILE">FILE</option>
          <option value="PROCESS">PROCESS</option>
          <option value="NETFLOW">NETFLOW</option>
          <option value="ALARM">ALARM</option>
          <option value="TRACE">TRACE</option>
          <option value="OBJECTIVE">OBJECTIVE</option>
          <option value="CLEANUP">CLEANUP</option>
          <option value="ATTRIBUTION">ATTRIBUTION</option>
          <option value="FAILURE">FAILURE</option>
        </select>
      </div>
      <div className="event-log">
        {rows.map((event) => (
          <div className="event-row" key={event.id}>
            <span className="event-tick">[{event.tick}]</span>
            <span className="event-cat">{event.category}</span>
            <span>{event.message}</span>
            {event.target ? <span className="muted">@{event.target}</span> : null}
            {event.traceImpact !== 0 ? (
              <span className="muted">trace {event.traceImpact > 0 ? '+' : ''}{event.traceImpact.toFixed(2)}</span>
            ) : null}
            {event.evidenceImpact ? (
              <span className="muted">
                {event.evidenceImpact.action}:{event.evidenceImpact.surface} x{event.evidenceImpact.count}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
