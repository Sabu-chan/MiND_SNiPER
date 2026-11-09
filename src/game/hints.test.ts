import { describe, expect, it } from 'vitest';
import { assignDistancePoints, hasHintIssues, shuffleShotOrder, validateHints } from './hints';
import { createSeededRng } from './rng';
import { normalizeText } from './text';

describe('validateHints（SPEC 2.3、DECISIONS D-06）', () => {
  it('問題がなければすべて null', () => {
    const issues = validateHints(['雪', '牛乳', '函館', '熊', 'ラベンダー'], '北海道');
    expect(issues).toEqual([null, null, null, null, null]);
    expect(hasHintIssues(issues)).toBe(false);
  });

  it('空欄（空白だけを含む）は不可', () => {
    expect(validateHints(['', '　', ' a ', 'b', 'c'], 'x')).toEqual([
      'empty',
      'empty',
      null,
      null,
      null,
    ]);
  });

  it('ヒント同士の重複は不可。全角と半角・前後の空白の違いは同じとみなす', () => {
    expect(validateHints(['ＡＢＣ', 'abc', ' ABC ', 'ｶﾀｶﾅ', 'カタカナ'], 'x')).toEqual([
      'duplicate',
      null,
      'duplicate',
      'duplicate',
      'duplicate',
    ]);
  });

  it('ひらがなとカタカナ、大文字と小文字は区別する', () => {
    expect(validateHints(['りんご', 'リンゴ', 'Apple', 'apple', '林檎'], 'x')).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('お題と同一の文字列は不可', () => {
    expect(validateHints(['北海道 ', 'a', 'b', 'c', 'd'], '北海道')).toEqual([
      'sameAsTopic',
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('normalizeText', () => {
  it('NFKC 正規化して前後の空白を除く', () => {
    expect(normalizeText('　ＭｉＮＤ　')).toBe('MiND');
  });
});

describe('assignDistancePoints（SPEC 2.3-6）', () => {
  it('遠い順に並べた順序に 10・8・6・4・2 を割り振る', () => {
    // ヒント3が最も遠く、ヒント0が最も近い
    expect(assignDistancePoints([3, 1, 4, 2, 0], [10, 8, 6, 4, 2])).toEqual([2, 8, 4, 10, 6]);
  });

  it('並べ替えになっていない順序は扱わない', () => {
    expect(() => assignDistancePoints([0, 0, 1, 2, 3], [10, 8, 6, 4, 2])).toThrow(/permutation/);
    expect(() => assignDistancePoints([0, 1, 2, 3], [10, 8, 6, 4, 2])).toThrow(/permutation/);
  });
});

describe('shuffleShotOrder（SPEC 2.3-7）', () => {
  it('ヒントの添字の並べ替えを返し、同じ乱数なら同じ結果', () => {
    const order = shuffleShotOrder(5, createSeededRng(7));
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(shuffleShotOrder(5, createSeededRng(7))).toEqual(order);
  });
});
