import type { NodeRuntimeState } from '../../game/models/types';

interface SystemStackPanelProps {
  nodes: Record<string, NodeRuntimeState>;
}

export function SystemStackPanel({ nodes }: SystemStackPanelProps): JSX.Element {
  const ordered = Object.values(nodes).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="panel panel-system-stack">
      <div className="panel__title">System Stack</div>
      <div className="system-stack-table">
        <div className="system-stack-row system-stack-row--head">
          <span>Node</span>
          <span>Type</span>
          <span>Access</span>
          <span>Risk</span>
          <span>Last Tick</span>
          <span>Surfaces</span>
        </div>
        {ordered.map((node) => (
          <div className="system-stack-row" key={node.id}>
            <span>{node.id}</span>
            <span>{node.nodeType}</span>
            <span>{node.accessState}</span>
            <span>{node.riskState}</span>
            <span>{node.lastTouchedTick >= 0 ? node.lastTouchedTick : '-'}</span>
            <span>{node.evidenceSurfacesTouched.length ? node.evidenceSurfacesTouched.join(',') : '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
