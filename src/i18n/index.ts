import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, resources } from './languages';

/**
 * i18next を初期化する。画面の文言はすべて src/locales/<lang>.json に置く。
 * 表示言語の保存と復元は CONFIG（段階4）で扱う。
 */
export function initI18n(language: string = DEFAULT_LANGUAGE): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false }, // React がエスケープする
      returnNull: false,
      initAsync: false,
    });
  } else if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
  return i18n;
}

export { i18n };
