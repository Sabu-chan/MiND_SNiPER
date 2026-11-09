import { describe, expect, it } from 'vitest';
import { isValidPlayerCount, validatePlayerNames } from './players';

describe('validatePlayerNames（SPEC 3.3：空欄・重複は不可）', () => {
  it('問題がなければすべて null', () => {
    expect(validatePlayerNames(['あ', 'い', 'う'])).toEqual([null, null, null]);
  });

  it('空欄と、重複するすべての欄を指摘する（全角・半角や前後の空白の違いは同じ名前）', () => {
    expect(validatePlayerNames(['Ａ', ' ', 'A ', 'B', 'b'])).toEqual([
      'duplicate',
      'empty',
      'duplicate',
      null,
      null,
    ]);
  });
});

describe('isValidPlayerCount（3〜6人）', () => {
  it.each([
    [2, false],
    [3, true],
    [6, true],
    [7, false],
    [3.5, false],
  ])('%d 人 → %s', (count, expected) => {
    expect(isValidPlayerCount(count)).toBe(expected);
  });
});
