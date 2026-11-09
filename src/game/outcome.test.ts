import { describe, expect, it } from 'vitest';
import {
  computeStandings,
  isCycleLimitReached,
  judgeCycleLimit,
  judgeElimination,
  judgeSuddenDeathCycle,
  judgeSuddenDeathElimination,
  leadersOf,
} from './outcome';

const ids = ['a', 'b', 'c', 'd'];

describe('leadersOf', () => {
  it('HPが最も多い人（同点なら全員）を元の順で返す', () => {
    expect(leadersOf(ids, { a: 50, b: 90, c: 90, d: 10 })).toEqual(['b', 'c']);
    expect(leadersOf(['a'], { a: 0 })).toEqual(['a']);
    expect(leadersOf([], {})).toEqual([]);
  });
});

describe('isCycleLimitReached（SPEC 2.1：判定はラウンドの終わり）', () => {
  it('人数×ラウンド数のターンが終わった時点で達する', () => {
    expect(isCycleLimitReached(11, 4, 3)).toBe(false);
    expect(isCycleLimitReached(12, 4, 3)).toBe(true);
  });
});

describe('judgeCycleLimit（ラウンド数・脱落者なし）', () => {
  it('1位が単独ならその人の勝ち', () => {
    expect(judgeCycleLimit(ids, { a: 50, b: 90, c: 80, d: 10 }, 'suddenDeath')).toEqual({
      resolution: { kind: 'winner', winnerId: 'b' },
      exitedIds: ['a', 'c', 'd'],
    });
  });

  it('サドンデス方式で1位が同点なら延長戦（誰も外れない）', () => {
    expect(judgeCycleLimit(ids, { a: 90, b: 90, c: 80, d: 10 }, 'suddenDeath')).toEqual({
      resolution: { kind: 'overtime' },
      exitedIds: [],
    });
  });

  it('引き分け方式で1位が同点なら同点者全員の引き分け', () => {
    expect(judgeCycleLimit(ids, { a: 90, b: 90, c: 80, d: 10 }, 'draw')).toEqual({
      resolution: { kind: 'draw', winnerIds: ['a', 'b'] },
      exitedIds: ['c', 'd'],
    });
  });
});

describe('judgeElimination（本戦・延長戦で脱落者が出た）', () => {
  it('脱落者以外で残りHPが最も多い人の勝ち', () => {
    expect(judgeElimination(ids, 'd', { a: 50, b: 90, c: 80, d: 0 }, 'suddenDeath')).toEqual({
      resolution: { kind: 'winner', winnerId: 'b' },
      exitedIds: ['a', 'c', 'd'],
    });
  });

  it('1位が同点ならサドンデス。参加者は同点者のみ、観測手は脱落者', () => {
    expect(judgeElimination(ids, 'd', { a: 90, b: 50, c: 90, d: 0 }, 'suddenDeath')).toEqual({
      resolution: { kind: 'suddenDeath', participantIds: ['a', 'c'], spotterId: 'd' },
      exitedIds: ['b', 'd'],
    });
  });

  it('引き分け方式なら1位の同点者全員の引き分け', () => {
    expect(judgeElimination(ids, 'd', { a: 90, b: 50, c: 90, d: 0 }, 'draw')).toEqual({
      resolution: { kind: 'draw', winnerIds: ['a', 'c'] },
      exitedIds: ['b', 'd'],
    });
  });

  it('脱落者のHPは比較に入らない（他の全員が0より多い前提でも）', () => {
    const result = judgeElimination(['a', 'b', 'c'], 'a', { a: 0, b: 1, c: 2 }, 'suddenDeath');
    expect(result.resolution).toEqual({ kind: 'winner', winnerId: 'c' });
  });
});

describe('judgeSuddenDeathElimination（サドンデス中にHP0）', () => {
  it('同点者が2人なら、もう一方の勝ち', () => {
    expect(judgeSuddenDeathElimination(['a', 'c'], 'c', { a: 30, c: 0 })).toEqual({
      resolution: { kind: 'winner', winnerId: 'a' },
      exitedIds: ['c'],
    });
  });

  it('残りの参加者のうちHPが最も多い人の勝ち', () => {
    expect(judgeSuddenDeathElimination(['a', 'b', 'c'], 'b', { a: 30, b: 0, c: 70 })).toEqual({
      resolution: { kind: 'winner', winnerId: 'c' },
      exitedIds: ['a', 'b'],
    });
  });

  it('残りの1位が同点なら、その同点者で再びサドンデス。観測手は今回HP0になった人', () => {
    expect(
      judgeSuddenDeathElimination(['a', 'b', 'c', 'd'], 'b', { a: 70, b: 0, c: 70, d: 20 }),
    ).toEqual({
      resolution: { kind: 'suddenDeath', participantIds: ['a', 'c'], spotterId: 'b' },
      exitedIds: ['b', 'd'],
    });
  });
});

describe('judgeSuddenDeathCycle（HP0の人が出ないまま全員が1回ずつ標的を務めた）', () => {
  it('その時点のHPで比較し、最多の人の勝ち', () => {
    expect(judgeSuddenDeathCycle(['a', 'c'], 'd', { a: 80, c: 100 })).toEqual({
      resolution: { kind: 'winner', winnerId: 'c' },
      exitedIds: ['a'],
    });
  });

  it('同点なら同点者だけでサドンデスを繰り返す。観測手は同じ人', () => {
    expect(judgeSuddenDeathCycle(['a', 'b', 'c'], 'd', { a: 80, b: 100, c: 100 })).toEqual({
      resolution: { kind: 'suddenDeath', participantIds: ['b', 'c'], spotterId: 'd' },
      exitedIds: ['a'],
    });
  });
});

describe('computeStandings（DECISIONS D-13）', () => {
  it('後まで勝ち残った人ほど上位。同じ判定で外れた人はそのときのHP順、同点は同順位', () => {
    const standings = computeStandings(
      ['a'],
      [
        { playerIds: ['b', 'd', 'e'], hp: { b: 40, d: 0, e: 40 } }, // 本戦の脱落時に外れた
        { playerIds: ['c'], hp: { c: 0 } }, // サドンデスで外れた
      ],
    );
    expect(standings).toEqual([
      { playerId: 'a', rank: 1 },
      { playerId: 'c', rank: 2 },
      { playerId: 'b', rank: 3 },
      { playerId: 'e', rank: 3 },
      { playerId: 'd', rank: 5 },
    ]);
  });

  it('引き分けは同点者全員が1位', () => {
    expect(computeStandings(['a', 'b'], [{ playerIds: ['c'], hp: { c: 10 } }])).toEqual([
      { playerId: 'a', rank: 1 },
      { playerId: 'b', rank: 1 },
      { playerId: 'c', rank: 3 },
    ]);
  });
});
