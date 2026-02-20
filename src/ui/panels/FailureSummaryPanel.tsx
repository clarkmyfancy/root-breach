import type { FailureSummary } from '../../game/engine/eventTypes';

interface FailureSummaryPanelProps {
  summary: FailureSummary | null;
}

export function FailureSummaryPanel({ summary }: FailureSummaryPanelProps): JSX.Element {
  if (!summary) {
    return (
      <div className="panel panel-failure">
        <div className="panel__title">Failure Summary</div>
        <div className="muted">No failure summary available yet.</div>
      </div>
    );
  }

  return (
    <div className="panel panel-failure">
      <div className="panel__title">Failure Summary</div>
      <p>
        <strong>Primary cause:</strong> {summary.primaryCause}
      </p>
      <div>
        <strong>Cause chain:</strong>
        <ul>
          {summary.causeChain.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
