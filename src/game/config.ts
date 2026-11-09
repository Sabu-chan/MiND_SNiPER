import { DEFAULT_LANGUAGE } from '../constants';

/** 決着方式（SPEC 2.7） */
export type Tiebreak = 'suddenDeath' | 'draw';

/**
 * 調整値をまとめた設定（SPEC 4章）。ゲーム開始時の値をそのゲームに固定する。
 * ヒント数は回数点・遠さ点の配列長から求める（現状は5固定）。
 */
export interface GameConfig {
  /** 開始HP */
  startHp: number;
  /** 上限HP */
  maxHp: number;
  /** 回数点（1射目から順に） */
  shotPoints: number[];
  /** 遠さ点（遠い順） */
  distancePoints: number[];
  /** 誤射ダメージ */
  missDamage: number;
  /** 逃げ切り回復量 */
  escapeHeal: number;
  /** ジャンル偵察のダメージ（倍率はかけない。DECISIONS D-33） */
  genreScoutDamage: number;
  /** ラウンド数 */
  maxCycles: number;
  /** 延長戦のダメージ倍率 */
  overtimeMultiplier: number;
  /** サドンデスのダメージ倍率 */
  suddenDeathMultiplier: number;
  /** 決着方式 */
  tiebreak: Tiebreak;
  /** ランダム出題の引き直し回数（ターンあたり） */
  rerollLimit: number;
  /** 秘密情報ボタンの長押し時間（ミリ秒） */
  holdDurationMs: number;
  /** 無効にした辞書カテゴリの id。新しく追加されたカテゴリが既定で有効になるよう、無効のものを持つ。 */
  disabledCategoryIds: string[];
  /** 表示言語 */
  language: string;
}

/** 通常時のダメージ倍率（SPEC 2.5。CONFIG の対象外） */
export const NORMAL_MULTIPLIER = 1;

/** ヒント数。現状は5固定（SPEC 4章） */
export const FIXED_HINT_COUNT = 5;

export const DEFAULT_CONFIG: Readonly<GameConfig> = Object.freeze({
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
  language: DEFAULT_LANGUAGE,
});

/** 既定値の新しいコピー（配列も複製する） */
export function createDefaultConfig(): GameConfig {
  return cloneConfig(DEFAULT_CONFIG);
}

export function cloneConfig(config: Readonly<GameConfig>): GameConfig {
  return {
    ...config,
    shotPoints: [...config.shotPoints],
    distancePoints: [...config.distancePoints],
    disabledCategoryIds: [...config.disabledCategoryIds],
  };
}

/** 入力値の範囲（SPEC 4章。上限の書かれていない項目は DECISIONS D-09） */
export const CONFIG_LIMITS = {
  startHp: { min: 10, max: 999 },
  maxHp: { max: 999 }, // 下限は開始HP
  points: { min: 0, max: 999 },
  missDamage: { min: 0, max: 99 },
  escapeHeal: { min: 0, max: 99 },
  genreScoutDamage: { min: 0, max: 99 },
  maxCycles: { min: 1, max: 10 },
  multiplier: { min: 1, max: 5 },
  rerollLimit: { min: 0, max: 5 },
  holdDurationMs: { min: 500, max: 5000 },
} as const;

export const TIEBREAKS: readonly Tiebreak[] = ['suddenDeath', 'draw'];

export type ConfigField = keyof GameConfig;

export type ConfigIssueCode =
  | 'notInteger'
  | 'outOfRange'
  | 'wrongLength'
  | 'notDescending'
  | 'invalidValue'
  | 'unsupportedLanguage';

export interface ConfigIssue {
  field: ConfigField;
  code: ConfigIssueCode;
  /** 配列項目のどの要素か */
  index?: number;
}

export interface ValidateConfigOptions {
  /** 登録済みの言語コード。省略時は言語を検査しない。 */
  supportedLanguages?: readonly string[];
}

/** 範囲チェック。問題がなければ空配列。範囲外の値は保存しない（SPEC 3.12）。 */
export function validateConfig(
  config: GameConfig,
  options: ValidateConfigOptions = {},
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const L = CONFIG_LIMITS;

  checkInteger(issues, 'startHp', config.startHp, L.startHp.min, L.startHp.max);
  checkInteger(
    issues,
    'maxHp',
    config.maxHp,
    Number.isInteger(config.startHp) ? config.startHp : L.startHp.min,
    L.maxHp.max,
  );
  checkPoints(issues, 'shotPoints', config.shotPoints);
  checkPoints(issues, 'distancePoints', config.distancePoints);
  checkInteger(issues, 'missDamage', config.missDamage, L.missDamage.min, L.missDamage.max);
  checkInteger(issues, 'escapeHeal', config.escapeHeal, L.escapeHeal.min, L.escapeHeal.max);
  checkInteger(
    issues,
    'genreScoutDamage',
    config.genreScoutDamage,
    L.genreScoutDamage.min,
    L.genreScoutDamage.max,
  );
  checkInteger(issues, 'maxCycles', config.maxCycles, L.maxCycles.min, L.maxCycles.max);
  checkInteger(
    issues,
    'overtimeMultiplier',
    config.overtimeMultiplier,
    L.multiplier.min,
    L.multiplier.max,
  );
  checkInteger(
    issues,
    'suddenDeathMultiplier',
    config.suddenDeathMultiplier,
    L.multiplier.min,
    L.multiplier.max,
  );
  if (!TIEBREAKS.includes(config.tiebreak))
    issues.push({ field: 'tiebreak', code: 'invalidValue' });
  checkInteger(issues, 'rerollLimit', config.rerollLimit, L.rerollLimit.min, L.rerollLimit.max);
  checkInteger(
    issues,
    'holdDurationMs',
    config.holdDurationMs,
    L.holdDurationMs.min,
    L.holdDurationMs.max,
  );
  if (
    !Array.isArray(config.disabledCategoryIds) ||
    config.disabledCategoryIds.some((id) => typeof id !== 'string')
  ) {
    issues.push({ field: 'disabledCategoryIds', code: 'invalidValue' });
  }
  if (typeof config.language !== 'string' || config.language === '') {
    issues.push({ field: 'language', code: 'invalidValue' });
  } else if (options.supportedLanguages && !options.supportedLanguages.includes(config.language)) {
    issues.push({ field: 'language', code: 'unsupportedLanguage' });
  }
  return issues;
}

function checkInteger(
  issues: ConfigIssue[],
  field: ConfigField,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isInteger(value)) issues.push({ field, code: 'notInteger' });
  else if (value < min || value > max) issues.push({ field, code: 'outOfRange' });
}

function checkPoints(issues: ConfigIssue[], field: ConfigField, values: readonly number[]): void {
  if (!Array.isArray(values) || values.length !== FIXED_HINT_COUNT) {
    issues.push({ field, code: 'wrongLength' });
    return;
  }
  values.forEach((value, index) => {
    if (!Number.isInteger(value)) issues.push({ field, code: 'notInteger', index });
    else if (value < CONFIG_LIMITS.points.min || value > CONFIG_LIMITS.points.max) {
      issues.push({ field, code: 'outOfRange', index });
    }
  });
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1] as number;
    const cur = values[i] as number;
    if (!(cur < prev)) issues.push({ field, code: 'notDescending', index: i });
  }
}

export interface StrategyCheck {
  /** 条件を満たすか */
  ok: boolean;
  /** 回数点の隣り合う差の最小値 */
  minShotStep: number;
  /** 遠さ点の最大差（最大値−最小値） */
  distanceSpread: number;
}

/**
 * 設計上の制約（SPEC 4章）：回数点の隣り合う差は、遠さ点の最大差より大きくする。
 * 破ると「わざとパスして遠いヒントを待つ」戦法が得になる。満たさなくても保存はできる（警告のみ）。
 */
export function checkStrategyConstraint(config: GameConfig): StrategyCheck {
  let minShotStep = Number.POSITIVE_INFINITY;
  for (let i = 1; i < config.shotPoints.length; i += 1) {
    const step = (config.shotPoints[i - 1] as number) - (config.shotPoints[i] as number);
    minShotStep = Math.min(minShotStep, step);
  }
  const distanceSpread =
    config.distancePoints.length === 0
      ? 0
      : Math.max(...config.distancePoints) - Math.min(...config.distancePoints);
  return { ok: minShotStep > distanceSpread, minShotStep, distanceSpread };
}

/** そのゲームのヒント数（射の数） */
export function hintCountOf(config: GameConfig): number {
  return config.shotPoints.length;
}
