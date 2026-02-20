import { useEffect, useMemo } from 'react';
import { getEffectiveConstraints } from '../../game/compiler/compile';
import { levelById, levels } from '../../game/levels';
import { EventLogPanel } from '../panels/EventLogPanel';
import { FailureSummaryPanel } from '../panels/FailureSummaryPanel';
import { InspectorPanel } from '../panels/InspectorPanel';
import { MapPanel } from '../panels/MapPanel';
import { ReplayControls } from '../panels/ReplayControls';
import { TerminalPanel } from '../panels/TerminalPanel';
import { useGameStore } from '../../store/useGameStore';

export function LevelScreen(): JSX.Element {
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const replayResult = useGameStore((state) => state.replayResult);
  const frameIndex = useGameStore((state) => state.frameIndex);
  const replayPlaying = useGameStore((state) => state.replayPlaying);
  const replaySpeed = useGameStore((state) => state.replaySpeed);
  const selectedDeviceId = useGameStore((state) => state.selectedDeviceId);
  const failureSummary = useGameStore((state) => state.failureSummary);
  const scriptText = useGameStore((state) => state.scriptText);
  const compileErrors = useGameStore((state) => state.compileErrors);

  const goToMainMenu = useGameStore((state) => state.goToMainMenu);
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);
  const openHack = useGameStore((state) => state.openHack);
  const updateScript = useGameStore((state) => state.updateScript);
  const compileCurrentScript = useGameStore((state) => state.compileCurrentScript);
  const runReplay = useGameStore((state) => state.runReplay);
  const resetScript = useGameStore((state) => state.resetScript);
  const toggleReplayPlaying = useGameStore((state) => state.toggleReplayPlaying);
  const resetReplay = useGameStore((state) => state.resetReplay);
  const setReplaySpeed = useGameStore((state) => state.setReplaySpeed);
  const startLevel = useGameStore((state) => state.startLevel);
  const selectDevice = useGameStore((state) => state.selectDevice);

  useEffect(() => {
    if (!replayPlaying) {
      return;
    }

    const id = window.setInterval(() => {
      useGameStore.getState().advanceReplay();
    }, 100);

    return () => window.clearInterval(id);
  }, [replayPlaying, replaySpeed]);

  const level = currentLevelId ? levelById[currentLevelId] : null;
  const currentFrame = replayResult?.frames[Math.min(frameIndex, Math.max(0, (replayResult?.frames.length ?? 1) - 1))] ?? null;
  const tick = currentFrame?.tick ?? 0;

  const visibleEvents = useMemo(() => {
    if (!replayResult || !currentFrame) {
      return [];
    }
    return replayResult.events.filter((event) => event.tick <= currentFrame.tick);
  }, [replayResult, currentFrame]);

  if (!currentLevelId || !level) {
    return (
      <div className="level-screen-empty">
        <p>No level selected.</p>
        <button className="btn btn-primary" onClick={openLevelSelect}>
          Open Level Select
        </button>
      </div>
    );
  }

  const selectedDevice = selectedDeviceId && currentFrame ? currentFrame.snapshot.devices[selectedDeviceId] ?? null : null;

  const constraints = getEffectiveConstraints(level);
  const activeLines = currentFrame?.executedLines ?? [];

  const levelIndex = levels.findIndex((entry) => entry.id === level.id);
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;

  return (
    <div className="level-screen">
      <header className="level-header">
        <div>
          <h2>{level.name}</h2>
          <div className="muted">Phase: {phase}</div>
        </div>

        <div className="level-header__actions">
          <button className="btn" onClick={openLevelSelect}>
            Mission Board
          </button>
          <button className="btn" onClick={goToMainMenu}>
            Main Menu
          </button>
        </div>
      </header>

      <div className="level-grid-layout">
        <div className="left-pane">
          <MapPanel
            level={level}
            snapshot={currentFrame?.snapshot ?? null}
            tick={tick}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={selectDevice}
          />

          <ReplayControls
            tick={tick}
            maxTick={replayResult?.tickLimit ?? 0}
            playing={replayPlaying}
            speed={replaySpeed}
            onTogglePlay={toggleReplayPlaying}
            onReset={resetReplay}
            onSetSpeed={setReplaySpeed}
          />

          {phase === 'levelComplete' ? (
            <div className="phase-card">
              <h3>Level Complete</h3>
              <div className="phase-card__actions">
                {nextLevel ? (
                  <button className="btn btn-primary" onClick={() => startLevel(nextLevel.id)}>
                    Next Level
                  </button>
                ) : null}
                <button className="btn" onClick={openLevelSelect}>
                  Back to Board
                </button>
                <button className="btn" onClick={openHack}>
                  Keep Tweaking Script
                </button>
              </div>
            </div>
          ) : null}

          <EventLogPanel events={visibleEvents} />
        </div>

        <div className="right-top-pane">
          <TerminalPanel
            source={scriptText}
            errors={compileErrors}
            activeLines={activeLines}
            constraints={constraints}
            onChange={updateScript}
            onCompile={compileCurrentScript}
            onReplay={runReplay}
            onResetScript={resetScript}
          />
        </div>

        <div className={phase === 'failSummary' ? 'right-bottom-pane right-bottom-pane--fail' : 'right-bottom-pane'}>
          {phase === 'failSummary' ? (
            <>
              <FailureSummaryPanel summary={failureSummary} />
              <div className="phase-card__actions">
                <button className="btn btn-primary" onClick={openHack}>
                  Open Terminal
                </button>
                <button className="btn" onClick={() => startLevel(level.id)}>
                  Observe Again
                </button>
              </div>
            </>
          ) : (
            <InspectorPanel device={selectedDevice} />
          )}
        </div>
      </div>
    </div>
  );
}
