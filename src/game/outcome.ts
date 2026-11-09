import type { Tiebreak } from './config';
import type { PlayerId } from './players';
import { must } from './util';

export type HpMap = Readonly<Record<PlayerId, number>>;

/**
 * 終了判定の結論。
 * - winner：単独の勝者で決着
 * - draw：引き分け方式で、1位の同点者全員の引き分け
 * - overtime：延長戦へ
 * - suddenDeath：参加者（1位の同点者）と観測手でサドンデスへ
 */
export type Resolution =
  | { kind: 'winner'; winnerId: PlayerId }
  | { kind: 'draw'; winnerIds: PlayerId[] }
  | { kind: 'overtime' }
  | { kind: 'suddenDeath'; participantIds: PlayerId[]; spotterId: PlayerId };

export interface Judgement {
  resolution: Resolution;
  /** この判定で勝ち残りから外れた人（順位付けに使う。DECISIONS D-13） */
  exitedIds: PlayerId[];
}

/** ids のうち HP が最も多い人（同点なら全員）。順序は ids のまま。 */
export function leadersOf(ids: readonly PlayerId[], hp: HpMap): PlayerId[] {
  if (ids.length === 0) return [];
  const max = Math.max(...ids.map((id) => hpOf(hp, id)));
  return ids.filter((id) => hpOf(hp, id) === max);
}

/** 本戦のラウンド数に達したか（判定はラウンドの終わりに行う。SPEC 2.1） */
export function isCycleLimitReached(
  roundsCompleted: number,
  playerCount: number,
  maxCycles: number,
): boolean {
  return roundsCompleted >= playerCount * maxCycles;
}

/**
 * ラウンド数に達したときの判定（SPEC 2.7）。脱落者はいない前提。
 * 1位が単独ならその人の勝ち。同点ならサドンデス方式は延長戦、引き分け方式は引き分け。
 */
export function judgeCycleLimit(
  playerIds: readonly PlayerId[],
  hp: HpMap,
  tiebreak: Tiebreak,
): Judgement {
  const leaders = leadersOf(playerIds, hp);
  if (leaders.length === 1) return winner(playerIds, must(leaders[0], 'leader'));
  if (tiebreak === 'draw') return draw(playerIds, leaders);
  return { resolution: { kind: 'overtime' }, exitedIds: [] };
}

/**
 * 本戦・延長戦で脱落者が出たときの判定（SPEC 2.7）。
 * 脱落者以外で残りHPが最も多い人の勝ち。同点ならサドンデス（観測手は脱落者）または引き分け。
 */
export function judgeElimination(
  playerIds: readonly PlayerId[],
  eliminatedId: PlayerId,
  hp: HpMap,
  tiebreak: Tiebreak,
): Judgement {
  const remaining = playerIds.filter((id) => id !== eliminatedId);
  const leaders = leadersOf(remaining, hp);
  if (leaders.length === 1) return winner(playerIds, must(leaders[0], 'leader'));
  if (tiebreak === 'draw') return draw(playerIds, leaders);
  return suddenDeath(playerIds, leaders, eliminatedId);
}

/**
 * サドンデス中に参加者のHPが0になったときの判定（SPEC 2.7）。
 * 残りの参加者のうちHPが最も多い人の勝ち。同点ならその同点者で再びサドンデス（観測手は今回HP0になった人）。
 * 参加者が2人なら、もう一方の勝ちで決着する。
 */
export function judgeSuddenDeathElimination(
  participantIds: readonly PlayerId[],
  eliminatedId: PlayerId,
  hp: HpMap,
): Judgement {
  const remaining = participantIds.filter((id) => id !== eliminatedId);
  const leaders = leadersOf(remaining, hp);
  if (leaders.length === 1) return winner(participantIds, must(leaders[0], 'leader'));
  return suddenDeath(participantIds, leaders, eliminatedId);
}

/**
 * サドンデスで、HP0の人が出ないまま参加者全員が1回ずつ標的を務めたときの判定（SPEC 2.7）。
 * その時点のHPで比較し最多の人の勝ち。同点なら同点者だけでサドンデスを繰り返す（観測手は同じ人）。
 */
export function judgeSuddenDeathCycle(
  participantIds: readonly PlayerId[],
  spotterId: PlayerId,
  hp: HpMap,
): Judgement {
  const leaders = leadersOf(participantIds, hp);
  if (leaders.length === 1) return winner(participantIds, must(leaders[0], 'leader'));
  return suddenDeath(participantIds, leaders, spotterId);
}

function winner(candidates: readonly PlayerId[], winnerId: PlayerId): Judgement {
  return {
    resolution: { kind: 'winner', winnerId },
    exitedIds: candidates.filter((id) => id !== winnerId),
  };
}

function draw(candidates: readonly PlayerId[], leaders: readonly PlayerId[]): Judgement {
  return {
    resolution: { kind: 'draw', winnerIds: [...leaders] },
    exitedIds: candidates.filter((id) => !leaders.includes(id)),
  };
}

function suddenDeath(
  candidates: readonly PlayerId[],
  leaders: readonly PlayerId[],
  spotterId: PlayerId,
): Judgement {
  return {
    resolution: { kind: 'suddenDeath', participantIds: [...leaders], spotterId },
    exitedIds: candidates.filter((id) => !leaders.includes(id)),
  };
}

/** 勝ち残りから外れた人と、そのときのHP */
export interface ContentionExit {
  playerIds: PlayerId[];
  hp: Record<PlayerId, number>;
}

export interface Standing {
  playerId: PlayerId;
  rank: number;
}

/**
 * 最終順位（DECISIONS D-13）。
 * 勝者（引き分けなら同点者全員）が1位。以降は、後まで勝ち残っていた人ほど上位とし、
 * 同じ判定で外れた人どうしはそのときのHPの多い順（同点は同順位）に並べる。
 */
export function computeStandings(
  winnerIds: readonly PlayerId[],
  exits: readonly ContentionExit[],
): Standing[] {
  const standings: Standing[] = winnerIds.map((playerId) => ({ playerId, rank: 1 }));
  let nextRank = winnerIds.length + 1;
  for (let i = exits.length - 1; i >= 0; i -= 1) {
    const exit = must(exits[i], 'exit');
    const sorted = [...exit.playerIds].sort((a, b) => hpOf(exit.hp, b) - hpOf(exit.hp, a));
    for (const playerId of sorted) {
      const better = sorted.filter((id) => hpOf(exit.hp, id) > hpOf(exit.hp, playerId)).length;
      standings.push({ playerId, rank: nextRank + better });
    }
    nextRank += sorted.length;
  }
  return standings;
}

function hpOf(hp: HpMap, id: PlayerId): number {
  return must(hp[id], `hp of ${id}`);
}
