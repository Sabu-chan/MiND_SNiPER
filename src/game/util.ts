/** 不変条件として必ず存在する値を取り出す。存在しなければプログラムの誤りなので例外にする。 */
export function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(`Invariant violated: ${message}`);
  return value;
}

/** values が 0..length-1 の並べ替えになっているか */
export function isIndexPermutation(values: readonly number[], length: number): boolean {
  if (values.length !== length) return false;
  const seen = new Set<number>();
  for (const v of values) {
    if (!Number.isInteger(v) || v < 0 || v >= length || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/** values が items と同じ要素の並べ替えになっているか（要素は一意である前提） */
export function isPermutationOf<T>(values: readonly T[], items: readonly T[]): boolean {
  if (values.length !== items.length) return false;
  const set = new Set(items);
  const seen = new Set<T>();
  for (const v of values) {
    if (!set.has(v) || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}
