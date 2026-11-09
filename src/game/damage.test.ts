import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './config';
import { applyDamage, applyHeal, hitDamage, missDamage, multiplierFor } from './damage';

const config = createDefaultConfig();

describe('multiplierFor（SPEC 2.5）', () => {
  it('通常・サドンデスは1倍、延長戦は2倍', () => {
    expect(multiplierFor('main', config)).toBe(1);
    expect(multiplierFor('overtime', config)).toBe(2);
    expect(multiplierFor('suddenDeath', config)).toBe(1);
  });

  it('延長戦・サドンデスの倍率は CONFIG に従う', () => {
    const c = { ...config, overtimeMultiplier: 3, suddenDeathMultiplier: 4 };
    expect(multiplierFor('overtime', c)).toBe(3);
    expect(multiplierFor('suddenDeath', c)).toBe(4);
  });
});

describe('hitDamage：（回数点＋遠さ点）× 倍率', () => {
  it('通常時の最大は60（1射目で最も遠いヒント）', () => {
    expect(hitDamage(config, 0, 10, 1)).toBe(60);
  });

  it('通常時の最小は12（5射目で最も近いヒント）', () => {
    expect(hitDamage(config, 4, 2, 1)).toBe(12);
  });

  it('回数点は1〜5射目で 50・40・30・20・10', () => {
    expect([0, 1, 2, 3, 4].map((shot) => hitDamage(config, shot, 0, 1))).toEqual([
      50, 40, 30, 20, 10,
    ]);
  });

  it('延長戦は2倍', () => {
    expect(hitDamage(config, 0, 10, 2)).toBe(120);
    expect(hitDamage(config, 2, 6, 2)).toBe(72);
  });

  it('存在しない射番号は扱わない', () => {
    expect(() => hitDamage(config, 5, 0, 1)).toThrow(/shot points for shot 5/);
  });
});

describe('missDamage：誤射ダメージ × 倍率', () => {
  it('通常5、延長戦10', () => {
    expect(missDamage(config, 1)).toBe(5);
    expect(missDamage(config, 2)).toBe(10);
  });
});

describe('applyDamage / applyHeal', () => {
  it('HPの下限は0（マイナスにしない）', () => {
    expect(applyDamage(100, 60)).toBe(40);
    expect(applyDamage(30, 60)).toBe(0);
    expect(applyDamage(5, 5)).toBe(0);
  });

  it('逃げ切りは20回復し、上限120で頭打ち。倍率はかけない', () => {
    expect(applyHeal(80, config)).toBe(100);
    expect(applyHeal(110, config)).toBe(120);
    expect(applyHeal(120, config)).toBe(120);
  });
});
