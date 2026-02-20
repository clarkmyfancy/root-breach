import { useGameStore } from './store/useGameStore';
import { LevelScreen } from './ui/screens/LevelScreen';
import { LevelSelectScreen } from './ui/screens/LevelSelectScreen';
import { MainMenu } from './ui/screens/MainMenu';

export default function App(): JSX.Element {
  const phase = useGameStore((state) => state.phase);

  if (phase === 'mainMenu') {
    return <MainMenu />;
  }

  if (phase === 'levelSelect') {
    return <LevelSelectScreen />;
  }

  return <LevelScreen />;
}
