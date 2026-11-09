/**
 * 文字列の同一判定に使う正規化（DECISIONS D-06）。
 * Unicode NFKC で全角・半角などを揃えてから前後の空白を除く。
 * ひらがなとカタカナ、大文字と小文字は区別する。
 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').trim();
}

export function isBlank(text: string): boolean {
  return normalizeText(text) === '';
}
