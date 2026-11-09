import { hintCountOf } from './config';
import { drawEntry, type DictionaryPool, type DrawExclusions } from './dictionary';
import { shuffleShotOrder } from './hints';
import type { GameAction } from './reducer';
import type { Rng } from './rng';
import { remainingDraws } from './selectors';
import type { GameState } from './state';

/**
 * 乱数を使うアクションの作成関数。乱数の結果をアクションに含めることで、リデューサーを純粋に保つ。
 */

/** 抽選から外す単語（DECISIONS D-03） */
export function exclusionsOf(state: GameState): DrawExclusions {
  return { keys: new Set(state.usedEntryKeys), words: new Set(state.usedWords) };
}

/**
 * ランダム出題の抽選・引き直し（SPEC 2.2）。
 * 抽選できない（回数を使い切った・出せる単語がない）ときは null。
 */
export function createDrawTopicAction(
  state: GameState,
  pool: DictionaryPool,
  rng: Rng,
): GameAction | null {
  if (remainingDraws(state) <= 0) return null;
  const entry = drawEntry(pool, exclusionsOf(state), rng);
  return entry ? { type: 'drawTopic', entry } : null;
}

/** 承認。出題順のシャッフルもここで行う（SPEC 2.3-7, 3.6-5） */
export function createApproveAction(state: GameState, farToNear: number[], rng: Rng): GameAction {
  return {
    type: 'approveHints',
    farToNear,
    shotOrder: shuffleShotOrder(hintCountOf(state.config), rng),
  };
}
