import { contracts } from '../../game/contracts';
import { useGameStore } from '../../store/useGameStore';

export function LevelSelectScreen(): JSX.Element {
  const save = useGameStore((state) => state.save);
  const startContract = useGameStore((state) => state.startContract);
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
        {contracts.map((contract) => {
          const unlocked = save.campaign.unlockedContracts.includes(contract.id);
          const completed = save.campaign.completedContracts.includes(contract.id);

          return (
            <article key={contract.id} className={`level-card ${unlocked ? '' : 'level-card--locked'}`}>
              <h3>{contract.title}</h3>
              <p>{contract.summary}</p>
              <div className="level-card__meta">
                <span>{completed ? 'Completed' : unlocked ? 'Unlocked' : 'Locked'}</span>
              </div>
              <button className="btn btn-primary" disabled={!unlocked} onClick={() => startContract(contract.id)}>
                {completed ? 'Replay Contract' : 'Start Contract'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
