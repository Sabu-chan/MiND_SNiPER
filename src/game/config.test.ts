import { describe, expect, it } from 'vitest';
import {
  checkStrategyConstraint,
  createDefaultConfig,
  DEFAULT_CONFIG,
  hintCountOf,
  validateConfig,
  type GameConfig,
} from './config';

const withConfig = (patch: Partial<GameConfig>): GameConfig => ({
  ...createDefaultConfig(),
  ...patch,
});

describe('DEFAULT_CONFIG（SPEC 4章の初期値）', () => {
  it('仕様書の初期値どおり', () => {
    expect(DEFAULT_CONFIG).toEqual({
      startHp: 100,
      maxHp: 120,
      shotPoints: [50, 40, 30, 20, 10],
      distancePoints: [10, 8, 6, 4, 2],
      missDamage: 5,
      escapeHeal: 20,
      genreScoutDamage: 15,
      maxCycles: 2,
      overtimeMultiplier: 2,
      suddenDeathMultiplier: 1,
      tiebreak: 'suddenDeath',
      rerollLimit: 1,
      holdDurationMs: 1500,
      disabledCategoryIds: [],
      language: 'ja',
    });
    expect(hintCountOf(DEFAULT_CONFIG)).toBe(5);
  });

  it('範囲チェックを通り、戦法防止の制約も満たす', () => {
    expect(validateConfig(createDefaultConfig(), { supportedLanguages: ['ja'] })).toEqual([]);
    expect(checkStrategyConstraint(createDefaultConfig())).toEqual({
      ok: true,
      minShotStep: 10,
      distanceSpread: 8,
    });
  });

  it('createDefaultConfig は配列も複製する', () => {
    const a = createDefaultConfig();
    a.shotPoints[0] = 99;
    expect(DEFAULT_CONFIG.shotPoints[0]).toBe(50);
  });
});

describe('validateConfig', () => {
  it.each([
    ['startHp', { startHp: 9 }],
    ['startHp', { startHp: 1000 }],
    ['missDamage', { missDamage: 100 }],
    ['escapeHeal', { escapeHeal: -1 }],
    ['maxCycles', { maxCycles: 0 }],
    ['maxCycles', { maxCycles: 11 }],
    ['overtimeMultiplier', { overtimeMultiplier: 6 }],
    ['suddenDeathMultiplier', { suddenDeathMultiplier: 0 }],
    ['rerollLimit', { rerollLimit: 6 }],
    ['holdDurationMs', { holdDurationMs: 499 }],
    ['holdDurationMs', { holdDurationMs: 5001 }],
  ] as const)('%s が範囲外なら outOfRange', (field, patch) => {
    // startHp を上げすぎると上限HP（初期値120）も開始HP未満になるため、含まれることだけを確かめる
    expect(validateConfig(withConfig(patch))).toContainEqual({ field, code: 'outOfRange' });
  });

  it('境界値は通す', () => {
    expect(
      validateConfig(
        withConfig({
          startHp: 10,
          maxHp: 10,
          missDamage: 0,
          escapeHeal: 99,
          maxCycles: 10,
          overtimeMultiplier: 5,
          suddenDeathMultiplier: 1,
          rerollLimit: 0,
          holdDurationMs: 500,
        }),
      ),
    ).toEqual([]);
    expect(validateConfig(withConfig({ startHp: 999, maxHp: 999, holdDurationMs: 5000 }))).toEqual(
      [],
    );
  });

  it('上限HPは開始HP以上（上限は999。DECISIONS D-09）', () => {
    expect(validateConfig(withConfig({ startHp: 100, maxHp: 99 }))).toEqual([
      { field: 'maxHp', code: 'outOfRange' },
    ]);
    expect(validateConfig(withConfig({ maxHp: 1000 }))).toEqual([
      { field: 'maxHp', code: 'outOfRange' },
    ]);
  });

  it('整数でない値は notInteger', () => {
    expect(validateConfig(withConfig({ startHp: 100.5 }))).toEqual([
      { field: 'startHp', code: 'notInteger' },
    ]);
    expect(validateConfig(withConfig({ missDamage: Number.NaN }))).toEqual([
      { field: 'missDamage', code: 'notInteger' },
    ]);
  });

  it('回数点・遠さ点は非負の整数5つで狭義の降順', () => {
    expect(validateConfig(withConfig({ shotPoints: [50, 40, 30, 20] }))).toEqual([
      { field: 'shotPoints', code: 'wrongLength' },
    ]);
    expect(validateConfig(withConfig({ shotPoints: [50, 40, 40, 20, 10] }))).toEqual([
      { field: 'shotPoints', code: 'notDescending', index: 2 },
    ]);
    expect(validateConfig(withConfig({ distancePoints: [10, 8, 6, 4, -1] }))).toEqual([
      { field: 'distancePoints', code: 'outOfRange', index: 4 },
    ]);
    expect(validateConfig(withConfig({ distancePoints: [10, 8, 6, 4, 0] }))).toEqual([]);
    expect(validateConfig(withConfig({ shotPoints: [1000, 40, 30, 20, 10] }))).toEqual([
      { field: 'shotPoints', code: 'outOfRange', index: 0 },
    ]);
  });

  it('決着方式・言語・カテゴリ', () => {
    expect(validateConfig(withConfig({ tiebreak: 'x' as never }))).toEqual([
      { field: 'tiebreak', code: 'invalidValue' },
    ]);
    expect(validateConfig(withConfig({ language: 'en' }), { supportedLanguages: ['ja'] })).toEqual([
      { field: 'language', code: 'unsupportedLanguage' },
    ]);
    expect(validateConfig(withConfig({ language: 'en' }))).toEqual([]);
    expect(validateConfig(withConfig({ disabledCategoryIds: [1 as never] }))).toEqual([
      { field: 'disabledCategoryIds', code: 'invalidValue' },
    ]);
  });
});

describe('checkStrategyConstraint（SPEC 4章の設計上の制約）', () => {
  it('回数点の隣り合う差が遠さ点の最大差以下なら満たさない', () => {
    const result = checkStrategyConstraint(
      withConfig({ shotPoints: [50, 45, 30, 20, 10], distancePoints: [10, 8, 6, 4, 2] }),
    );
    expect(result).toEqual({ ok: false, minShotStep: 5, distanceSpread: 8 });
  });

  it('差がちょうど等しい場合も満たさない（「より大きく」）', () => {
    expect(
      checkStrategyConstraint(
        withConfig({ shotPoints: [40, 32, 24, 16, 8], distancePoints: [10, 8, 6, 4, 2] }),
      ).ok,
    ).toBe(false);
  });
});
