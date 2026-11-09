import type { Player, PlayerId } from './players';
import { SECRET_SCENES, type GameState, type ShotEvent } from './state';
import { must } from './util';

/** 画面から読む値。秘密情報（HP・ダメージ量・遠さ点）を返すものは名前に明記する。 */

export function playerById(state: GameState, id: PlayerId): Player {
  return must(
    state.players.find((p) => p.id === id),
    `player ${id}`,
  );
}

/** 受け渡し画面のボタンを長押しにするか（秘密情報を開くとき。SPEC 3.1） */
export function isHoldRequired(state: GameState): boolean {
  return state.scene.type === 'handoff' && SECRET_SCENES.includes(state.scene.next);
}

/**
 * このターンであと何回抽選できるか（1回目＋引き直し上限回数。SPEC 2.2）。
 * 正解を確定したあとは 0。
 */
export function remainingDraws(state: GameState): number {
  const r = state.round;
  if (!r || r.topic !== null) return 0;
  return Math.max(0, state.config.rerollLimit + 1 - r.drawCount);
}

/** 残りの引き直し回数（表示用）。まだ1回も抽選していなければ引き直し上限回数 */
export function remainingRerolls(state: GameState): number {
  const r = state.round;
  if (!r || r.drawCount === 0) return state.config.rerollLimit;
  return remainingDraws(state);
}

/** 今回答する狙撃手。射撃中でなければ null */
export function currentSniperId(state: GameState): PlayerId | null {
  const r = state.round;
  if (state.scene.type !== 'shooting' || !r?.answerOrder || r.outcome) return null;
  return r.answerOrder[r.answererIndex] ?? null;
}

/** 公開済みのヒント（公開順）。最後の要素が最新 */
export function revealedHints(state: GameState): string[] {
  const r = state.round;
  if (!r?.shotOrder) return [];
  return r.shotOrder.slice(0, r.shot + 1).map((i) => must(r.hints[i], `hint ${i}`));
}

/** 狙撃手の回答の記録（命中はターンが終わるので含めない） */
export interface AnswerLogEntry {
  shot: number;
  kind: 'miss' | 'pass';
  /** 誤射の回答メモ（パスは null） */
  memo: string | null;
}

/**
 * このターンの狙撃手ごとの回答履歴（SPEC 2.4, 3.7 の誤射履歴に、パスも加えたもの。DECISIONS D-31）。
 * ダメージ量は含めない。
 */
export function answerHistory(state: GameState): Record<PlayerId, AnswerLogEntry[]> {
  const r = state.round;
  const history: Record<PlayerId, AnswerLogEntry[]> = {};
  if (!r) return history;
  for (const id of r.sniperIds) history[id] = [];
  for (const e of r.events) {
    if (e.kind === 'miss') history[e.sniperId]?.push({ shot: e.shot, kind: 'miss', memo: e.memo });
    else if (e.kind === 'pass')
      history[e.sniperId]?.push({ shot: e.shot, kind: 'pass', memo: null });
  }
  return history;
}

/** 「元に戻す」が使えるか（SPEC 3.7, DECISIONS D-02） */
export function canUndo(state: GameState): boolean {
  return state.undo !== null && state.scene.type === 'shooting';
}

/** 直前のターンの記録（ターン結果画面用） */
export function lastRecord(state: GameState) {
  return state.records.at(-1) ?? null;
}

export interface HpPoint {
  /** null は開始時点。それ以外は記録の添字 */
  recordIndex: number | null;
  hp: Record<PlayerId, number>;
}

/** 【秘密情報】HP推移（結果発表のグラフ用。DECISIONS D-08） */
export function secretHpHistory(state: GameState): HpPoint[] {
  const start = Object.fromEntries(state.players.map((p) => [p.id, state.config.startHp]));
  return [
    { recordIndex: null, hp: start },
    ...state.records.map((r, i) => ({ recordIndex: i, hp: { ...r.hpAfter } })),
  ];
}

export function isMissEvent(e: ShotEvent): e is Extract<ShotEvent, { kind: 'miss' }> {
  return e.kind === 'miss';
}
