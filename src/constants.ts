/** 英字タイトルは全言語共通（SPEC 1章）。副題は locales の app.subtitle。 */
export const APP_TITLE = 'MiND SNiPER';

/** localStorage のキーに付けるアプリ固有の接頭辞（SPEC 5.2） */
export const STORAGE_PREFIX = 'mind-sniper:';

/** 既定の表示言語（SPEC 4章：初期値は日本語） */
export const DEFAULT_LANGUAGE = 'ja';

/** タイトルロゴ画像（全言語共通。日本語の副題入り。DECISIONS D-36） */
export const LOGO_IMAGE = { src: '/logo.webp', width: 1200, height: 329 } as const;

/** コピーライト表記（全言語共通。DECISIONS D-37） */
export const COPYRIGHT = '(c)Sierra27 Games';
