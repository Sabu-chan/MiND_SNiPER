import { NORMAL_MULTIPLIER, type GameConfig } from './config';
import { must } from './util';

/** ゲームの局面 */
export type Phase = 'main' | 'overtime' | 'suddenDeath';

/** 局面ごとのダメージ倍率（SPEC 2.5：通常1倍、延長戦・サドンデスは CONFIG） */
export function multiplierFor(phase: Phase, config: GameConfig): number {
  switch (phase) {
    case 'main':
      return NORMAL_MULTIPLIER;
    case 'overtime':
      return config.overtimeMultiplier;
    case 'suddenDeath':
      return config.suddenDeathMultiplier;
  }
}

/**
 * 命中ダメージ：（回数点＋命中したヒントの遠さ点）× 倍率（SPEC 2.5）。
 * @param shot 射番号（0始まり）
 * @param distancePoints その射で公開したヒントの遠さ点（DECISIONS D-01）
 */
export function hitDamage(
  config: GameConfig,
  shot: number,
  distancePoints: number,
  multiplier: number,
): number {
  const shotPoints = must(config.shotPoints[shot], `shot points for shot ${shot}`);
  return (shotPoints + distancePoints) * multiplier;
}

/** 誤射ダメージ：誤射ダメージ × 倍率 */
export function missDamage(config: GameConfig, multiplier: number): number {
  return config.missDamage * multiplier;
}

/** HP を減らす。下限は0（SPEC 2.5） */
export function applyDamage(hp: number, damage: number): number {
  return Math.max(0, hp - damage);
}

/** 逃げ切りの回復。倍率はかけず、上限HPで頭打ち（SPEC 2.5） */
export function applyHeal(hp: number, config: GameConfig): number {
  return Math.min(config.maxHp, hp + config.escapeHeal);
}
