import { useMemo, useState, type ReactNode } from 'react';
import { createDefaultConfig, type GameConfig } from '../game/config';
import { SettingsContext } from './settings';

/** CONFIG を保持する。保存と編集画面は段階4で実装する。 */
export function SettingsProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: GameConfig;
}) {
  const [config, setConfig] = useState<GameConfig>(() => initialConfig ?? createDefaultConfig());
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
