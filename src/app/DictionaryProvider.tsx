import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadDictionaries, type Dictionary, type FetchJson } from '../game/dictionary';
import { DictionaryContext, type DictionaryContextValue } from './dictionaries';

const fetchJson: FetchJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
};

const defaultLoad = () => loadDictionaries(fetchJson, `${import.meta.env.BASE_URL}dictionaries/`);

/** public/dictionaries/ の辞書を読み込む（SPEC 5.1）。不正な項目はコンソールに警告を出す。 */
export function DictionaryProvider({
  children,
  load = defaultLoad,
}: {
  children: ReactNode;
  /** 読み込み処理（テストで差し替える） */
  load?: () => Promise<{ value: Dictionary[]; warnings: string[] }>;
}) {
  const [value, setValue] = useState<DictionaryContextValue>({
    status: 'loading',
    dictionaries: [],
  });
  // 読み込みは起動時に1回だけ行う
  const loadRef = useRef(load);

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then(({ value: dictionaries, warnings }) => {
        for (const warning of warnings) console.warn(`[dictionary] ${warning}`);
        if (!cancelled) setValue({ status: 'ready', dictionaries });
      })
      .catch((error: unknown) => {
        console.warn('[dictionary] failed to load', error);
        if (!cancelled) setValue({ status: 'error', dictionaries: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}
