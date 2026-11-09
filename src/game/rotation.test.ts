import { describe, expect, it } from 'vitest';
import { orderBySeatAfter, rotationRoles, suddenDeathRoles } from './rotation';

const seat = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('rotationRoles（SPEC 2.1）', () => {
  it('第rラウンドの標的は席順[r mod n]、観測手は席順[(r+1) mod n]', () => {
    const s = seat(4);
    expect(rotationRoles(s, 0)).toEqual({
      targetId: 'p0',
      spotterId: 'p1',
      sniperIds: ['p2', 'p3'],
    });
    expect(rotationRoles(s, 3)).toEqual({
      targetId: 'p3',
      spotterId: 'p0',
      sniperIds: ['p1', 'p2'],
    });
    // 2周目は1周目と同じ
    expect(rotationRoles(s, 5)).toEqual(rotationRoles(s, 1));
  });

  it('nラウンドで全員が1回ずつ標的・観測手を務める', () => {
    for (const n of [3, 4, 5, 6]) {
      const s = seat(n);
      const roles = Array.from({ length: n }, (_, r) => rotationRoles(s, r));
      expect(new Set(roles.map((x) => x.targetId)).size).toBe(n);
      expect(new Set(roles.map((x) => x.spotterId)).size).toBe(n);
    }
  });

  it('観測手は常に1人で、3人なら狙撃手は1人、6人なら4人', () => {
    expect(rotationRoles(seat(3), 0).sniperIds).toEqual(['p2']);
    expect(rotationRoles(seat(6), 0).sniperIds).toHaveLength(4);
  });

  it('狙撃手は席順で観測手の次の人から並ぶ（回答順の初期値。SPEC 2.4）', () => {
    // r=4, n=6：標的 p4、観測手 p5 → 狙撃手は p0, p1, p2, p3
    expect(rotationRoles(seat(6), 4).sniperIds).toEqual(['p0', 'p1', 'p2', 'p3']);
    // r=5：標的 p5、観測手 p0 → p1..p4
    expect(rotationRoles(seat(6), 5).sniperIds).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('3人未満は扱わない', () => {
    expect(() => rotationRoles(seat(2), 0)).toThrow(/at least 3 players/);
  });
});

describe('orderBySeatAfter', () => {
  it('席順で指定した人の次から一周する順に並べる', () => {
    expect(orderBySeatAfter(seat(5), 'p3', ['p0', 'p2', 'p4', 'p1'])).toEqual([
      'p4',
      'p0',
      'p1',
      'p2',
    ]);
  });
});

describe('suddenDeathRoles（SPEC 2.7）', () => {
  it('標的は登録した順、観測手は固定、標的以外の参加者が狙撃手', () => {
    const s = seat(5);
    const order = ['p3', 'p0', 'p2'];
    expect(suddenDeathRoles(s, order, 0, 'p1')).toEqual({
      targetId: 'p3',
      spotterId: 'p1',
      sniperIds: ['p2', 'p0'],
    });
    expect(suddenDeathRoles(s, order, 2, 'p1')).toEqual({
      targetId: 'p2',
      spotterId: 'p1',
      sniperIds: ['p3', 'p0'],
    });
  });

  it('参加者2人なら狙撃手は1人', () => {
    expect(suddenDeathRoles(seat(4), ['p2', 'p0'], 1, 'p3').sniperIds).toEqual(['p2']);
  });
});
