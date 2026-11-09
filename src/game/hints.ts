import { shuffle, type Rng } from './rng';
import { normalizeText } from './text';
import { isIndexPermutation, must } from './util';

export type HintIssue = 'empty' | 'sameAsTopic' | 'duplicate';

/**
 * ヒントの入力チェック（SPEC 2.3）：空欄不可、ヒント同士の重複不可、正解と同一の文字列不可。
 * 同一判定は正規化後の完全一致（DECISIONS D-06）。
 * 各ヒントの問題を返す（問題がなければ null）。重複は該当するすべての欄に付ける。
 */
export function validateHints(hints: readonly string[], topic: string): (HintIssue | null)[] {
  const normalizedTopic = normalizeText(topic);
  const normalized = hints.map(normalizeText);
  const counts = new Map<string, number>();
  for (const h of normalized) if (h !== '') counts.set(h, (counts.get(h) ?? 0) + 1);
  return normalized.map((h) => {
    if (h === '') return 'empty';
    if (normalizedTopic !== '' && h === normalizedTopic) return 'sameAsTopic';
    if ((counts.get(h) ?? 0) > 1) return 'duplicate';
    return null;
  });
}

export function hasHintIssues(issues: readonly (HintIssue | null)[]): boolean {
  return issues.some((issue) => issue !== null);
}

/**
 * 観測手が遠い順に並べた順序に遠さ点を割り振る（SPEC 2.3-6）。
 * @param farToNear ヒントの添字を遠い順に並べたもの
 * @returns ヒントの添字ごとの遠さ点
 */
export function assignDistancePoints(
  farToNear: readonly number[],
  distancePoints: readonly number[],
): number[] {
  if (!isIndexPermutation(farToNear, distancePoints.length)) {
    throw new Error('assignDistancePoints: order must be a permutation of hint indices');
  }
  const byHint = new Array<number>(distancePoints.length).fill(0);
  farToNear.forEach((hintIndex, rank) => {
    byHint[hintIndex] = must(distancePoints[rank], 'distance points');
  });
  return byHint;
}

/** 出題順をランダムに決める（SPEC 2.3-7）。ヒントの添字を公開順に並べたものを返す。 */
export function shuffleShotOrder(hintCount: number, rng: Rng): number[] {
  return shuffle(
    Array.from({ length: hintCount }, (_, i) => i),
    rng,
  );
}
