import { useState } from 'react';
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

const apiReference = [
  'camera("CAM_ID").disable()',
  'camera("CAM_ID").disable(20)',
  'camera("CAM_ID").enable()',
  'alarm().delay(30)',
  'door("DOOR_ID").open()',
  'door("DOOR_ID").close()',
  'turret("TURRET_ID").retarget("TARGET_ID")',
  'device("DEVICE_ID").tag("friendly")',
  'wait(5)',
  'log("message")',
];

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
  const [showHelp, setShowHelp] = useState(false);
  const activeSet = new Set(activeLines);
  const renderedLines = source.split(/\r?\n/);

  return (
    <div className="panel panel-terminal">
      <div className="terminal-header">
        <div className="terminal-title-wrap">
          <button
            className="btn help-button"
            onClick={() => setShowHelp((value) => !value)}
            aria-label="Show command help"
          >
            ?
          </button>
          <div className="panel__title terminal-title">Terminal</div>
        </div>
      </div>

      {showHelp ? (
        <div className="terminal-help-inline">
          <div className="help-popover-title">Available Commands</div>
          <ul>
            {apiReference.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
