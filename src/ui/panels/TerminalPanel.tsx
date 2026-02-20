import type { CompileError } from '../../game/compiler/scriptTypes';
import type { EffectiveConstraints } from '../../game/models/types';

interface TerminalPanelProps {
  source: string;
  errors: CompileError[];
  activeLines: number[];
  constraints: EffectiveConstraints;
  onChange: (source: string) => void;
  onCompile: () => void;
  onReplay: () => void;
  onResetScript: () => void;
}

export function TerminalPanel({
  source,
  errors,
  activeLines,
  constraints,
  onChange,
  onCompile,
  onReplay,
  onResetScript,
}: TerminalPanelProps): JSX.Element {
  const activeSet = new Set(activeLines);
  const renderedLines = source.split(/\r?\n/);

  return (
    <div className="panel panel-terminal">
      <div className="panel__title">Terminal</div>

      <textarea
        className="terminal-input"
        value={source}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />

      <div className="terminal-actions">
        <button className="btn" onClick={onCompile}>
          Compile
        </button>
        <button className="btn btn-primary" onClick={onReplay}>
          Simulate + Replay
        </button>
        <button className="btn" onClick={onResetScript}>
          Reset Script
        </button>
      </div>

      <div className="constraints">
        <span>maxLines: {constraints.maxLines}</span>
        <span>maxCommands: {constraints.maxCommands}</span>
        <span>maxDelay: {constraints.maxDelayTicks}</span>
      </div>

      {errors.length > 0 ? (
        <ul className="compile-errors">
          {errors.map((error, idx) => (
            <li key={`${error.line}-${idx}`}>Line {error.line}: {error.message}</li>
          ))}
        </ul>
      ) : (
        <div className="compile-ok">Compile status: ready</div>
      )}

      <div className="active-lines">
        <div className="panel__subtitle">Replay line highlight</div>
        <pre>
          {renderedLines.map((line, index) => {
            const lineNo = index + 1;
            const className = activeSet.has(lineNo) ? 'line-active' : '';
            return (
              <div key={lineNo} className={className}>
                {String(lineNo).padStart(2, '0')} | {line || ' '}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
