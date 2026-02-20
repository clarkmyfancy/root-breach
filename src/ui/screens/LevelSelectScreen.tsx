import { levels } from '../../game/levels';
import { useGameStore } from '../../store/useGameStore';

export function LevelSelectScreen(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const startLevel = useGameStore((state) => state.startLevel);
  const goToMainMenu = useGameStore((state) => state.goToMainMenu);

  return (
    <div className="level-select">
      <header className="level-select__header">
        <h2>Mission Board</h2>
        <div className="level-select__meta">
          <button className="btn" onClick={goToMainMenu}>
            Main Menu
          </button>
        </div>
      </header>

      <div className="level-grid">
        {levels.map((level, index) => {
          const unlocked = index <= save.unlockedLevelIndex;
          const completed = Boolean(save.completedLevels[level.id]);

          return (
            <article key={level.id} className={`level-card ${unlocked ? '' : 'level-card--locked'}`}>
              <h3>{level.name}</h3>
              <p>{level.brief}</p>
              <div className="level-card__meta">
                <span>{completed ? 'Completed' : unlocked ? 'Unlocked' : 'Locked'}</span>
              </div>
              <button className="btn btn-primary" disabled={!unlocked} onClick={() => startLevel(level.id)}>
                {completed ? 'Replay Level' : 'Start Level'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
