import { useGameStore } from '../../store/useGameStore';

export function MainMenu(): JSX.Element {
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);

  return (
    <div className="main-menu">
      <div className="main-menu__card">
        <h1>Root Breach</h1>
        <p>Hack your way through the system. Fail, adapt, replay.</p>
        <button className="btn btn-primary" onClick={openLevelSelect}>
          Start Operation
        </button>
      </div>
    </div>
  );
}
