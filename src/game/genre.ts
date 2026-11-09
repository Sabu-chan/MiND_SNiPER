/**
 * 正解のジャンル（ジャンル偵察で公開する分類。DECISIONS D-33）。
 * 辞書のカテゴリ（細かい分類）とは別に、粒度をそろえた一覧を持つ。表示名は locales の genres.<id>。
 * 足すときは末尾に追加し、id は変えない（保存データと辞書が参照する）。
 */
export const GENRE_IDS = [
  'japan-place',
  'world-place',
  'landmark',
  'landform',
  'historical-person',
  'celebrity',
  'creature',
  'plant',
  'food',
  'vehicle',
  'tool',
  'clothing',
  'play-music',
  'facility',
  'nature',
  'tradition',
] as const;

export type GenreId = (typeof GENRE_IDS)[number];

export function isGenreId(value: unknown): value is GenreId {
  return typeof value === 'string' && (GENRE_IDS as readonly string[]).includes(value);
}
