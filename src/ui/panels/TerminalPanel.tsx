import { useMemo, useState, type KeyboardEvent } from 'react';
import type { CompileError } from '../../game/compiler/scriptTypes';

interface TerminalPanelProps {
  source: string;
  errors: CompileError[];
  onChange: (source: string) => void;
  onCompile: () => void;
  onReplay: () => void;
  onResetScript: () => void;
  highlightInput?: boolean;
  highlightCompile?: boolean;
  variant?: 'default' | 'turretAim';
  onExitTerminal?: () => void;
}

const apiReference = [
  'camera("CAM_ID").disable()',
  'camera("CAM_ID").disable(20)',
  'camera("CAM_ID").enable()',
  'alarm().delay(30)',
  'door("DOOR_ID").open()',
  'door("DOOR_ID").close()',
  'turret("TURRET_ID").retarget("TARGET_ID")',
  'setAim(x, y)',
  'device("DEVICE_ID").tag("friendly")',
  'wait(5)',
  'log("message")',
];

function renderCompileStatus(errors: CompileError[]): JSX.Element {
  if (errors.length > 0) {
    return (
      <ul className="compile-errors">
        {errors.map((error, idx) => (
          <li key={`${error.line}-${idx}`}>
            Line {error.line}: {error.message}
          </li>
        ))}
      </ul>
    );
  }

  return <div className="compile-ok">Compile status: ready</div>;
}

export function TerminalPanel({
  source,
  errors,
  onChange,
  onCompile,
  onReplay,
  onResetScript,
  highlightInput = false,
  highlightCompile = false,
  variant = 'default',
  onExitTerminal,
}: TerminalPanelProps): JSX.Element {
  const [showHelp, setShowHelp] = useState(false);

  const lineCount = useMemo(() => Math.max(18, source.split(/\r?\n/).length), [source]);
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, idx) => idx + 1), [lineCount]);

  const handleTurretEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'c') {
      event.preventDefault();
      onReplay();
      return;
    }

    if (key === 'r') {
      event.preventDefault();
      onResetScript();
    }
  };

  if (variant === 'turretAim') {
    return (
      <div className="panel panel-terminal panel-terminal-turret">
        <div className="turret-terminal-topbar">
          <div className="panel__title terminal-title">Terminal</div>
          {onExitTerminal ? (
            <button className="btn" onClick={onExitTerminal}>
              Back To Map
            </button>
          ) : null}
        </div>

        <div className="turret-terminal-layout">
          <div className="turret-terminal-editor-wrap">
            <div className="turret-terminal-gutter" aria-hidden>
              {lineNumbers.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            <textarea
              className={`terminal-input turret-terminal-input ${highlightInput ? 'tutorial-focus' : ''}`}
              value={source}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleTurretEditorKeyDown}
              spellCheck={false}
            />
          </div>

          <aside className="turret-terminal-sidebar">
            <div className="turret-terminal-sidebar-title">TURRET_AIM</div>
            <div className="turret-terminal-divider" />
            <div className="turret-terminal-block-title">Variables:</div>
            <div className="turret-terminal-block">
              <div>intruderPosX</div>
              <div>intruderPosY</div>
              <div className="turret-terminal-gap" />
              <div>numGuards</div>
              <div>guardPosX[]</div>
              <div>guardPosY[]</div>
            </div>

            <div className="turret-terminal-block-title">Output:</div>
            <div className="turret-terminal-block">setAim(x, y)</div>

            <div className="turret-terminal-block-title">Note:</div>
            <div className="turret-terminal-block turret-terminal-block-note">
              <div>
                <code>setAim(intruderPosX, intruderPosY)</code> tracks the intruder.
              </div>
              <div>
                <code>while (condition) {'{ ... }'}</code> is supported.
              </div>
              <div>
                Loops auto-advance if no explicit <code>wait(n)</code>.
              </div>
              <div>
                Math works in expressions: <code>+ - * /</code>, <code>sqrt(...)</code>, and <code>guardPosX[numGuards-1]</code>.
              </div>
              <div>
                <code>// comment</code> skips a line.
              </div>
            </div>

            <div className="turret-terminal-divider turret-terminal-divider-bottom" />
            <div className="turret-terminal-hints">
              <div>Ctrl+C: COMPILE/RUN</div>
              <div>Ctrl+R: RESET</div>
            </div>

            <div className="terminal-actions terminal-actions-turret">
              <button className={`btn terminal-compile-btn ${highlightCompile ? 'tutorial-focus' : ''}`} onClick={onCompile}>
                Compile
              </button>
              <button className="btn btn-primary" onClick={onReplay}>
                Run
              </button>
              <button className="btn" onClick={onResetScript}>
                Reset
              </button>
            </div>
          </aside>
        </div>

        {renderCompileStatus(errors)}
      </div>
    );
  }

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
        className={`terminal-input ${highlightInput ? 'tutorial-focus' : ''}`}
        value={source}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />

      <div className="terminal-actions">
        <button className={`btn terminal-compile-btn ${highlightCompile ? 'tutorial-focus' : ''}`} onClick={onCompile}>
          Compile
        </button>
        <button className="btn btn-primary" onClick={onReplay}>
          Simulate + Replay
        </button>
        <button className="btn" onClick={onResetScript}>
          Reset Script
        </button>
      </div>

      {renderCompileStatus(errors)}
    </div>
  );
}
