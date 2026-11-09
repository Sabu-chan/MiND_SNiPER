import type { ReactNode } from 'react';
import type { GameConfig } from '../game/config';
import type { Dictionary } from '../game/dictionary';
import type { GameState } from '../game/state';
import { DictionaryProvider } from './DictionaryProvider';
import { GameSessionProvider } from './GameSessionProvider';
import { SettingsProvider } from './SettingsProvider';

export interface AppProvidersProps {
  children: ReactNode;
  /** 以下はテスト用の差し替え */
  initialConfig?: GameConfig;
  initialGame?: GameState | null;
  initialPlayerNames?: string[];
  loadDictionaries?: () => Promise<{ value: Dictionary[]; warnings: string[] }>;
}

export function AppProviders({
  children,
  initialConfig,
  initialGame,
  initialPlayerNames,
  loadDictionaries,
}: AppProvidersProps) {
  return (
    <SettingsProvider {...(initialConfig ? { initialConfig } : {})}>
      <DictionaryProvider {...(loadDictionaries ? { load: loadDictionaries } : {})}>
        <GameSessionProvider
          {...(initialGame !== undefined ? { initialGame } : {})}
          {...(initialPlayerNames ? { initialPlayerNames } : {})}
        >
          {children}
        </GameSessionProvider>
      </DictionaryProvider>
    </SettingsProvider>
  );
}
