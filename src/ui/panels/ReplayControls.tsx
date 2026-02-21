import type { ReplaySpeed } from '../../store/useGameStore';

interface ReplayControlsProps {
  tick: number;
  maxTick: number;
  playing: boolean;
  speed: ReplaySpeed;
  onTogglePlay: () => void;
  onReset: () => void;
  onReplay: () => void;
  onSetSpeed: (speed: ReplaySpeed) => void;
}

export function ReplayControls({
  tick,
  maxTick,
  playing,
  speed,
  onTogglePlay,
  onReset,
  onReplay,
  onSetSpeed,
}: ReplayControlsProps): JSX.Element {
  return (
    <div className="replay-controls">
      <div className="replay-controls-left">
        <span>
          Tick {tick}/{maxTick}
        </span>
        <button className="btn" onClick={onTogglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn" onClick={onReset}>
          Reset
        </button>
        <div className="speed-group">
          {[1, 2, 4].map((option) => (
            <button
              key={option}
              className={`btn ${speed === option ? 'btn-primary' : ''}`}
              onClick={() => onSetSpeed(option as ReplaySpeed)}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>
      <button className="btn replay-action-btn" onClick={onReplay}>
        <svg
          className="replay-icon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M12 5a7 7 0 0 1 6.31 4H16v2h6V5h-2v2.1A9 9 0 1 0 21 13h-2a7 7 0 1 1-7-8Z"
            fill="currentColor"
          />
        </svg>
        Replay
      </button>
    </div>
  );
}
