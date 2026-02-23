import { useState } from 'react';
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
}

const apiReference = [
  'scan.node("N1")',
  'scan.device("CAM_2")',
  'scan.route()',
  'probe.logs("AUTH")',
  'access.door("D1").bypass()',
  'access.terminal("TERM1").spoof("maint")',
  'access.auth("AUTH_1").replayToken("tokenA")',
  'camera("CAM_ID").disable()',
  'camera("CAM_ID").disable(20)',
  'camera("CAM_ID").enable()',
  'alarm().delay(30)',
  'door("DOOR_ID").open()',
  'door("DOOR_ID").close()',
  'turret("TURRET_ID").retarget("TARGET_ID")',
  'file("VAULT_DOC").copy()',
  'file("AUDIT_LOG").delete()',
  'record("EMP_042").alter("status","terminated")',
  'device("PUMP_3").sabotage("overpressure")',
  'device("DEVICE_ID").tag("friendly")',
  'trace().spoof("MAINT_ROUTE")',
  'route().relay("NODE_A")',
  'route.agent("north_corridor")',
  'decoy().burst(3)',
  'logs("AUTH").scrub("AUTH_1")',
  'logs("NETFLOW").forge("competitor_sig")',
  'logs("DEVICE").overwrite("CAM_2")',
  'evidence().frame("SCAPEGOAT_ID")',
  'identity().assume("maintenance")',
  'narrative.ticket("WO-4412","coolant_audit")',
  'wait(5)',
  'log("message")',
];

export function TerminalPanel({
  source,
  errors,
  onChange,
  onCompile,
  onReplay,
  onResetScript,
  highlightInput = false,
  highlightCompile = false,
}: TerminalPanelProps): JSX.Element {
  const [showHelp, setShowHelp] = useState(false);

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

      {errors.length > 0 ? (
        <ul className="compile-errors">
          {errors.map((error, idx) => (
            <li key={`${error.line}-${idx}`}>Line {error.line}: {error.message}</li>
          ))}
        </ul>
      ) : (
        <div className="compile-ok">Compile status: ready</div>
      )}
    </div>
  );
}
