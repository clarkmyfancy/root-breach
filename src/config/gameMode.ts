export type GameplayMode = 'development' | 'production';

function readOverride(): GameplayMode | null {
  const value = (import.meta.env as Record<string, string | undefined>).VITE_ROOT_BREACH_MODE;
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'development' || normalized === 'dev') {
    return 'development';
  }
  if (normalized === 'production' || normalized === 'prod') {
    return 'production';
  }
  return null;
}

const override = readOverride();

export const gameplayMode: GameplayMode = override ?? (import.meta.env.DEV ? 'development' : 'production');
export const isDevGameplayMode = gameplayMode === 'development';
