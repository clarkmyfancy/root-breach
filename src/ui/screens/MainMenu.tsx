import { useGameStore } from '../../store/useGameStore';

export function MainMenu(): JSX.Element {
  const openLevelSelect = useGameStore((state) => state.openLevelSelect);

  return (
    <div className="main-menu">
      <div className="main-menu__card">
        <h1>BreachLoop</h1>
        <p>Die, inspect, patch script, replay from tick 0.</p>
        <button className="btn btn-primary" onClick={openLevelSelect}>
          Start Operation
        </button>
      </div>
    </div>
  );
}
