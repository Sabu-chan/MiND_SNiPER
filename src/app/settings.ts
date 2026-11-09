import { createContext, useContext } from 'react';
import type { GameConfig } from '../game/config';

export interface SettingsContextValue {
  /** 現在の CONFIG（次に始めるゲームに使う） */
  config: GameConfig;
  /** 範囲チェック済みの CONFIG を保存する */
  setConfig: (config: GameConfig) => void;
  /** 保存されていた CONFIG が読めず破棄したとき true */
  configDiscarded: boolean;
  dismissConfigDiscarded: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used within SettingsProvider');
  return value;
}
