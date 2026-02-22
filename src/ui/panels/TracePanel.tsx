import type { TraceSource } from '../../game/models/types';

interface TracePanelProps {
  progress: number;
  ratePerTick: number;
  lockedOn: boolean;
  sources: TraceSource[];
}

export function TracePanel({ progress, ratePerTick, lockedOn, sources }: TracePanelProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="panel panel-trace">
      <div className="panel__title">Trace</div>
      <div className="trace-meter">
        <div className="trace-meter__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="trace-meta">
        <span>{pct.toFixed(1)}%</span>
        <span>{ratePerTick >= 0 ? `+${ratePerTick.toFixed(1)}` : ratePerTick.toFixed(1)} / tick</span>
        <span>{lockedOn ? 'Locked On' : 'Diffuse'}</span>
      </div>
      <div className="trace-sources">
        {sources.map((source) => (
          <div key={source.id}>
            {source.label}: {source.delta >= 0 ? '+' : ''}
            {source.delta.toFixed(1)}
          </div>
        ))}
      </div>
    </div>
  );
}
