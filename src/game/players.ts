import { normalizeText } from './text';

/** プレイヤーは名前でなく内部IDで管理する（SPEC 6章） */
export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

/** プレイ人数（SPEC 1章） */
export const PLAYER_COUNT = { min: 3, max: 6 } as const;

export type NameIssue = 'empty' | 'duplicate';

/**
 * プレイヤー名の入力チェック（SPEC 3.3：空欄・重複は不可）。
 * 各入力欄の問題を返す（問題がなければ null）。重複は該当するすべての欄に付ける。
 */
export function validatePlayerNames(names: readonly string[]): (NameIssue | null)[] {
  const normalized = names.map(normalizeText);
  const counts = new Map<string, number>();
  for (const n of normalized) if (n !== '') counts.set(n, (counts.get(n) ?? 0) + 1);
  return normalized.map((n) => {
    if (n === '') return 'empty';
    if ((counts.get(n) ?? 0) > 1) return 'duplicate';
    return null;
  });
}

export function isValidPlayerCount(count: number): boolean {
  return Number.isInteger(count) && count >= PLAYER_COUNT.min && count <= PLAYER_COUNT.max;
}
