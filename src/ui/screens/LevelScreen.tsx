import { useEffect, useMemo, useRef } from 'react';
import { levelById, levels } from '../../game/levels';
import { EventLogPanel } from '../panels/EventLogPanel';
import { FailureSummaryPanel } from '../panels/FailureSummaryPanel';
import { InspectorPanel } from '../panels/InspectorPanel';
import { MapPanel } from '../panels/MapPanel';
import { ReplayControls } from '../panels/ReplayControls';
import { TerminalPanel } from '../panels/TerminalPanel';
import { WalkthroughPanel } from '../panels/WalkthroughPanel';
import { useGameStore } from '../../store/useGameStore';

type WalkthroughTarget = 'map' | 'terminalInput' | 'compileButton' | 'eventLog';

const levelOneWalkthroughSteps: Array<{ title: string; body: string; target: WalkthroughTarget }> = [
  {
    title: 'Read The Map And Core Loop',
    body: 'Your agent auto-runs this route. The loop is: fail, inspect what happened, patch script, replay from tick 0.',
    target: 'map',
  },
  {
    title: 'Write Commands In Terminal',
    body: 'Type commands here to change the level state. For Level 1, start with: door("D1").open()',
    target: 'terminalInput',
  },
  {
    title: 'Compile Before Replay',
    body: 'Use Compile to validate syntax and devices. If there is an error, the line number appears below the terminal.',
    target: 'compileButton',
  },
  {
    title: 'Use Event Log To Debug',
    body: 'The event log shows state changes over time. Use timestamps to understand what happened and when.',
    target: 'eventLog',
  },
];

export function LevelScreen(): JSX.Element {
  const eventLogAnchorRef = useRef<HTMLDivElement | null>(null);
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
  const walkthroughActive = useGameStore((state) => state.walkthroughActive);
  const walkthroughStep = useGameStore((state) => state.walkthroughStep);

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
  const nextWalkthroughStep = useGameStore((state) => state.nextWalkthroughStep);
  const prevWalkthroughStep = useGameStore((state) => state.prevWalkthroughStep);
  const dismissWalkthrough = useGameStore((state) => state.dismissWalkthrough);

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
  const walkthroughStepData =
    walkthroughActive && level.id === 'level1' ? levelOneWalkthroughSteps[walkthroughStep] : null;
  const walkthroughPosition =
    walkthroughStepData?.target === 'map'
      ? 'map'
      : walkthroughStepData?.target === 'terminalInput'
        ? 'terminal'
        : walkthroughStepData?.target === 'compileButton'
          ? 'compile'
          : 'eventLog';

  const levelIndex = levels.findIndex((entry) => entry.id === level.id);
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;

  useEffect(() => {
    if (!walkthroughStepData || walkthroughStepData.target !== 'eventLog') {
      return;
    }
    const node = eventLogAnchorRef.current;
    if (!node) {
      return;
    }
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [walkthroughStepData]);

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
            frameEvents={currentFrame?.events ?? []}
            tick={tick}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={selectDevice}
            highlighted={walkthroughStepData?.target === 'map'}
          />

          <ReplayControls
            tick={tick}
            maxTick={replayResult?.tickLimit ?? 0}
            playing={replayPlaying}
            speed={replaySpeed}
            onTogglePlay={toggleReplayPlaying}
            onReset={resetReplay}
            onReplay={runReplay}
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

          <div ref={eventLogAnchorRef}>
            <EventLogPanel events={visibleEvents} highlighted={walkthroughStepData?.target === 'eventLog'} />
          </div>
        </div>

        <div className="right-top-pane">
          <TerminalPanel
            source={scriptText}
            errors={compileErrors}
            onChange={updateScript}
            onCompile={compileCurrentScript}
            onReplay={runReplay}
            onResetScript={resetScript}
            highlightInput={walkthroughStepData?.target === 'terminalInput'}
            highlightCompile={walkthroughStepData?.target === 'compileButton'}
          />
        </div>

        <div className={phase === 'failSummary' ? 'right-bottom-pane right-bottom-pane--fail' : 'right-bottom-pane'}>
          {phase === 'failSummary' ? (
            <FailureSummaryPanel summary={failureSummary} />
          ) : (
            <InspectorPanel device={selectedDevice} />
          )}
        </div>
      </div>

      {walkthroughStepData ? (
        <WalkthroughPanel
          step={walkthroughStep}
          totalSteps={levelOneWalkthroughSteps.length}
          title={walkthroughStepData.title}
          body={walkthroughStepData.body}
          canGoBack={walkthroughStep > 0}
          isLastStep={walkthroughStep >= levelOneWalkthroughSteps.length - 1}
          onBack={prevWalkthroughStep}
          onNext={nextWalkthroughStep}
          onSkip={dismissWalkthrough}
          position={walkthroughPosition}
        />
      ) : null}
    </div>
  );
}
