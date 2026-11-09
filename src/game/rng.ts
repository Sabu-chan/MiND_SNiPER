import { must } from './util';

/**
 * 乱数源。[0, 1) の数を返す関数。
 * 本番では Math.random、テストではシード付きの乱数に差し替える（SPEC 6章）。
 */
export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

/** シード付きの乱数（mulberry32）。同じシードからは同じ列が出る。 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 決まった値の列を順に返す乱数（テスト用）。列を使い切ったら先頭に戻る。 */
export function createSequenceRng(values: readonly number[]): Rng {
  if (values.length === 0) throw new Error('createSequenceRng: values must not be empty');
  let i = 0;
  return () => {
    const v = must(values[i % values.length], 'sequence value');
    i += 1;
    return v;
  };
}

/** 0 以上 maxExclusive 未満の整数 */
export function randomInt(rng: Rng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`randomInt: invalid maxExclusive ${maxExclusive}`);
  }
  return Math.min(Math.floor(rng() * maxExclusive), maxExclusive - 1);
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickOne: items must not be empty');
  return must(items[randomInt(rng, items.length)], 'picked item');
}

/** Fisher–Yates で並べ替えた新しい配列を返す（元の配列は変えない） */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}
