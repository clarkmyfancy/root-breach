import type { ReplaySpeed } from '../../store/useGameStore';

interface ReplayControlsProps {
  tick: number;
  maxTick: number;
  playing: boolean;
  speed: ReplaySpeed;
  onTogglePlay: () => void;
  onReset: () => void;
  onSetSpeed: (speed: ReplaySpeed) => void;
}

export function ReplayControls({
  tick,
  maxTick,
  playing,
  speed,
  onTogglePlay,
  onReset,
  onSetSpeed,
}: ReplayControlsProps): JSX.Element {
  return (
    <div className="replay-controls">
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
  );
}
