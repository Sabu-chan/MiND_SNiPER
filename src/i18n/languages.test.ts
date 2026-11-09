import { describe, expect, it } from 'vitest';
import { i18n } from '.';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGES } from './languages';

describe('languages', () => {
  it('src/locales の ja.json を自動で登録し、既定の言語を先頭にする', () => {
    expect(LANGUAGES[0]).toEqual({ code: DEFAULT_LANGUAGE, name: '日本語' });
    expect(isSupportedLanguage('ja')).toBe(true);
    expect(isSupportedLanguage('xx')).toBe(false);
  });

  it('翻訳キーを引ける', () => {
    expect(i18n.t('app.subtitle')).toBe('連想スナイピングゲーム');
  });
});
