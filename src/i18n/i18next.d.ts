import 'i18next';
import type ja from '../locales/ja.json';

// 翻訳キーを型で検査する（ja.json を基準とする）
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ja };
    returnNull: false;
  }
}
