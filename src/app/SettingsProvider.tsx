import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createDefaultConfig, type GameConfig } from '../game/config';
import { i18n } from '../i18n';
import { LANGUAGES } from '../i18n/languages';
import { SettingsContext } from './settings';
import { loadConfig, saveConfig } from './storage';

/** CONFIG を保持し、変更したら保存する。表示言語もここで切り替える（SPEC 3.12, 5.2） */
export function SettingsProvider({
  children,
  storage,
  initialConfig,
}: {
  children: ReactNode;
  /** 保存先。null なら保存しない */
  storage: Storage | null;
  /** テスト用：保存データより優先する初期値 */
  initialConfig?: GameConfig;
}) {
  const [initial] = useState(() => {
    if (initialConfig) return { config: initialConfig, discarded: false };
    const loaded = loadConfig(
      storage,
      LANGUAGES.map((l) => l.code),
    );
    return {
      config: loaded.status === 'ok' ? loaded.value : createDefaultConfig(),
      discarded: loaded.status === 'discarded',
    };
  });
  const [config, setConfigState] = useState<GameConfig>(initial.config);
  const [configDiscarded, setConfigDiscarded] = useState(initial.discarded);

  useEffect(() => {
    if (i18n.language !== config.language) void i18n.changeLanguage(config.language);
    document.documentElement.lang = config.language;
  }, [config.language]);

  const setConfig = useCallback(
    (next: GameConfig) => {
      setConfigState(next);
      saveConfig(storage, next);
    },
    [storage],
  );
  const dismissConfigDiscarded = useCallback(() => setConfigDiscarded(false), []);

  const value = useMemo(
    () => ({ config, setConfig, configDiscarded, dismissConfigDiscarded }),
    [config, setConfig, configDiscarded, dismissConfigDiscarded],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
