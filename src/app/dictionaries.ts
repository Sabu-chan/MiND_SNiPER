import { createContext, useContext } from 'react';
import type { Dictionary } from '../game/dictionary';

export type DictionaryStatus = 'loading' | 'ready' | 'error';

export interface DictionaryContextValue {
  status: DictionaryStatus;
  dictionaries: Dictionary[];
}

export const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function useDictionaries(): DictionaryContextValue {
  const value = useContext(DictionaryContext);
  if (!value) throw new Error('useDictionaries must be used within DictionaryProvider');
  return value;
}
