import type { Resource } from 'i18next';
import ja from '../locales/ja.json';

export const DEFAULT_LANGUAGE = 'ja';

/**
 * src/locales/ 配下の <lang>.json を自動で登録する。
 * 言語を足すときは JSON ファイルを1つ追加するだけでよい（各ファイルの meta.languageName が言語切替え欄の表示名になる）。
 */
const localeModules = import.meta.glob<{ default: typeof ja }>('../locales/*.json', {
  eager: true,
});

export const resources: Resource = Object.fromEntries(
  Object.entries(localeModules).map(([path, mod]) => [
    langCodeFromPath(path),
    { translation: mod.default },
  ]),
);

export interface LanguageOption {
  code: string;
  name: string;
}

export const LANGUAGES: readonly LanguageOption[] = Object.entries(localeModules)
  .map(([path, mod]) => ({ code: langCodeFromPath(path), name: mod.default.meta.languageName }))
  .sort((a, b) =>
    a.code === DEFAULT_LANGUAGE
      ? -1
      : b.code === DEFAULT_LANGUAGE
        ? 1
        : a.code.localeCompare(b.code),
  );

export function isSupportedLanguage(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}

function langCodeFromPath(path: string): string {
  const match = /([^/]+)\.json$/.exec(path);
  if (!match?.[1]) throw new Error(`Invalid locale path: ${path}`);
  return match[1];
}
