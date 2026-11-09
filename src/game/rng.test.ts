import { describe, expect, it } from 'vitest';
import { createSeededRng, createSequenceRng, pickOne, randomInt, shuffle } from './rng';

describe('rng', () => {
  it('同じシードからは同じ列が出る', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(Array.from({ length: 5 }, createSeededRng(43))).not.toEqual(seqA);
  });

  it('randomInt は 0 以上 max 未満を返し、1 に近い値でも範囲を超えない', () => {
    expect(randomInt(createSequenceRng([0]), 5)).toBe(0);
    expect(randomInt(createSequenceRng([0.999999999]), 5)).toBe(4);
    expect(() => randomInt(createSequenceRng([0]), 0)).toThrow(/invalid maxExclusive/);
  });

  it('pickOne は乱数に応じて要素を選ぶ', () => {
    expect(pickOne(['a', 'b', 'c'], createSequenceRng([0.5]))).toBe('b');
    expect(() => pickOne([], createSequenceRng([0]))).toThrow(/must not be empty/);
  });

  it('shuffle は元の配列を変えず、並べ替えを返す', () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, createSeededRng(1));
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual(items);
    expect(shuffle(items, createSeededRng(1))).toEqual(result);
  });

  it('shuffle は乱数 0 の列で決まった並びになる（Fisher–Yates）', () => {
    // i=4..1 でそれぞれ j=0 と入れ替える
    expect(shuffle([1, 2, 3, 4], createSequenceRng([0]))).toEqual([2, 3, 4, 1]);
  });
});
