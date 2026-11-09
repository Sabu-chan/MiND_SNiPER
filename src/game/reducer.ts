import { cloneConfig, hintCountOf, validateConfig, type GameConfig } from './config';
import { applyDamage, applyHeal, hitDamage, missDamage, multiplierFor } from './damage';
import type { DrawnEntry } from './dictionary';
import { assignDistancePoints, hasHintIssues, validateHints } from './hints';
import {
  isCycleLimitReached,
  judgeCycleLimit,
  judgeElimination,
  judgeSuddenDeathCycle,
  judgeSuddenDeathElimination,
  computeStandings,
  type Judgement,
} from './outcome';
import { isValidPlayerCount, validatePlayerNames, type Player, type PlayerId } from './players';
import { rotationRoles, suddenDeathRoles, type Roles } from './rotation';
import {
  GAME_SCHEMA_VERSION,
  type GameState,
  type GameStateBody,
  type HandoffNext,
  type Rejection,
  type RoundLabel,
  type RoundState,
  type Scene,
  type ShotEvent,
  type Topic,
} from './state';
import { isBlank, normalizeText } from './text';
import { isIndexPermutation, isPermutationOf, must } from './util';

/** 出題方式と正解（SPEC 2.2） */
export type TopicInput = { source: 'free'; text: string } | { source: 'random' };

export type ShotResult = 'hit' | 'miss' | 'pass';

/**
 * ゲーム進行のアクション。乱数が必要なもの（抽選・シャッフル）は、
 * 結果をアクションに含めて渡す（actions.ts の作成関数を使う）。これでリデューサーは純粋関数のままになる。
 */
export type GameAction =
  /** ターン開始画面から標的への受け渡しへ */
  | { type: 'beginRound' }
  /** 受け渡し画面から次の場面を開く（秘密情報の場面は長押しで発動する。UI 側で制御） */
  | { type: 'openHandoff' }
  /** ランダム出題の抽選・引き直し */
  | { type: 'drawTopic'; entry: DrawnEntry }
  /** 標的が正解とヒントを確定する。差し戻し後は差し戻されたヒントだけを反映する */
  | { type: 'submitHints'; topic: TopicInput; hints: string[] }
  /** 観測手が差し戻す */
  | { type: 'rejectHints'; rejections: Rejection[] }
  /** 観測手が遠い順に並べて承認する。出題順のシャッフル結果も受け取る */
  | { type: 'approveHints'; farToNear: number[]; shotOrder: number[] }
  /** 回答順を登録して射撃開始 */
  | { type: 'startShooting'; answerOrder: PlayerId[] }
  /** 現在の狙撃手の結果を入力する */
  | { type: 'recordShot'; result: ShotResult; memo?: string }
  /** 直前の1操作を取り消す */
  | { type: 'undo' }
  /** 射撃画面からターン結果へ（ここで記録を確定し、取り消せなくなる） */
  | { type: 'proceedToResult' }
  /** ターン結果から次へ（次のターン・延長戦・サドンデス・終了） */
  | { type: 'nextFromResult' }
  /** 告知画面を閉じる */
  | { type: 'acknowledge' }
  /** サドンデスの標的順を登録する */
  | { type: 'setSuddenDeathOrder'; targetOrder: PlayerId[] };

/**
 * 新しいゲームを作る。CONFIG はこの時点の値を複製してゲームに固定する（SPEC 3.3, 4章）。
 * 入力は画面側で検証済みの前提で、不正なら例外にする。
 */
export function createGame(players: readonly Player[], config: GameConfig): GameState {
  if (!isValidPlayerCount(players.length)) {
    throw new Error(`createGame: invalid player count ${players.length}`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error('createGame: player ids must be unique');
  }
  if (validatePlayerNames(players.map((p) => p.name)).some((issue) => issue !== null)) {
    throw new Error('createGame: invalid player names');
  }
  const issues = validateConfig(config);
  if (issues.length > 0) throw new Error(`createGame: invalid config ${JSON.stringify(issues)}`);

  const fixed = cloneConfig(config);
  const body: GameStateBody = {
    schemaVersion: GAME_SCHEMA_VERSION,
    config: fixed,
    players: players.map((p) => ({ id: p.id, name: p.name.trim() })),
    hp: Object.fromEntries(players.map((p) => [p.id, fixed.startHp])),
    phase: 'main',
    rotationIndex: 0,
    overtimeRounds: 0,
    suddenDeathRounds: 0,
    suddenDeath: null,
    round: null,
    records: [],
    usedEntryKeys: [],
    usedWords: [],
    exits: [],
    result: null,
    scene: { type: 'roundIntro' },
  };
  return { ...startRound(body), undo: null };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'recordShot':
      return recordShot(state, action.result, action.memo);
    case 'undo':
      return state.undo !== null && state.scene.type === 'shooting'
        ? { ...state.undo, undo: null }
        : state;
    default: {
      const next = reduceBody(stripUndo(state), action);
      // 不正なアクション（場面違い・入力不正）は無視して状態を変えない
      return next === null ? state : { ...next, undo: null };
    }
  }
}

type BodyAction = Exclude<GameAction, { type: 'recordShot' } | { type: 'undo' }>;

function reduceBody(s: GameStateBody, action: BodyAction): GameStateBody | null {
  const r = s.round;
  const hintCount = hintCountOf(s.config);

  switch (action.type) {
    case 'beginRound':
      if (s.scene.type !== 'roundIntro' || !r) return null;
      return { ...s, scene: handoff(r.targetId, 'target', 'compose') };

    case 'openHandoff':
      if (s.scene.type !== 'handoff') return null;
      return { ...s, scene: sceneOf(s.scene.next) };

    case 'drawTopic': {
      // 確定前の出題中のみ。抽選は1回目＋引き直し上限回数まで（SPEC 2.2）
      if (s.scene.type !== 'compose' || !r || r.topic !== null) return null;
      if (r.drawCount > s.config.rerollLimit) return null;
      const { entry } = action;
      const word = normalizeText(entry.word);
      if (s.usedEntryKeys.includes(entry.key) || s.usedWords.includes(word)) return null;
      return {
        ...s,
        // 引き直しで捨てた単語もこのゲームでは再び出さない（DECISIONS D-03）
        usedEntryKeys: [...s.usedEntryKeys, entry.key],
        usedWords: [...s.usedWords, word],
        round: { ...r, drawnEntry: entry, drawCount: r.drawCount + 1 },
      };
    }

    case 'submitHints': {
      if (s.scene.type !== 'compose' || !r || action.hints.length !== hintCount) return null;
      const toSpotter = handoff(r.spotterId, 'spotter', 'review');

      if (r.rejections !== null) {
        // 差し戻し後：差し戻されたヒントだけを書き換える（SPEC 2.3-4, 3.5-5）
        const topic = must(r.topic, 'topic after rejection');
        const rejected = new Set(r.rejections.map((x) => x.hintIndex));
        const hints = r.hints.map((h, i) =>
          rejected.has(i) ? must(action.hints[i], 'revised hint').trim() : h,
        );
        if (hasHintIssues(validateHints(hints, topic.text))) return null;
        return { ...s, round: { ...r, hints, rejections: null }, scene: toSpotter };
      }

      let topic: Topic;
      let usedWords = s.usedWords;
      if (action.topic.source === 'free') {
        const text = action.topic.text.trim();
        if (isBlank(text)) return null;
        topic = { text, reading: null, source: 'free', entryKey: null, categoryLabel: null };
        const word = normalizeText(text);
        if (!usedWords.includes(word)) usedWords = [...usedWords, word];
      } else {
        const entry = r.drawnEntry;
        if (!entry) return null;
        topic = {
          text: entry.word,
          reading: entry.reading,
          source: 'random',
          entryKey: entry.key,
          categoryLabel: entry.categoryLabel,
        };
      }
      const hints = action.hints.map((h) => h.trim());
      if (hasHintIssues(validateHints(hints, topic.text))) return null;
      return { ...s, usedWords, round: { ...r, topic, hints }, scene: toSpotter };
    }

    case 'rejectHints': {
      if (s.scene.type !== 'review' || !r || !r.topic || r.rejections !== null) return null;
      const indices = action.rejections.map((x) => x.hintIndex);
      if (
        indices.length === 0 ||
        new Set(indices).size !== indices.length ||
        indices.some((i) => !Number.isInteger(i) || i < 0 || i >= hintCount)
      ) {
        return null;
      }
      const rejections = action.rejections
        .map((x) => ({ hintIndex: x.hintIndex, comment: x.comment?.trim() || null }))
        .sort((a, b) => a.hintIndex - b.hintIndex);
      return {
        ...s,
        round: { ...r, rejections, rejectionCount: r.rejectionCount + 1 },
        scene: handoff(r.targetId, 'target', 'compose'),
      };
    }

    case 'approveHints': {
      if (s.scene.type !== 'review' || !r || !r.topic || r.rejections !== null) return null;
      if (
        !isIndexPermutation(action.farToNear, hintCount) ||
        !isIndexPermutation(action.shotOrder, hintCount)
      ) {
        return null;
      }
      const approved: RoundState = {
        ...r,
        distanceByHint: assignDistancePoints(action.farToNear, s.config.distancePoints),
        shotOrder: [...action.shotOrder],
      };
      if (r.sniperIds.length > 1) {
        return { ...s, round: approved, scene: { type: 'answerOrder' } };
      }
      // 狙撃手が1人なら回答順の登録画面を省略する（SPEC 3.6-4）
      return {
        ...s,
        round: { ...approved, answerOrder: [...r.sniperIds] },
        scene: { type: 'shooting' },
      };
    }

    case 'startShooting':
      if (
        s.scene.type !== 'answerOrder' ||
        !r ||
        !isPermutationOf(action.answerOrder, r.sniperIds)
      ) {
        return null;
      }
      return {
        ...s,
        round: { ...r, answerOrder: [...action.answerOrder] },
        scene: { type: 'shooting' },
      };

    case 'proceedToResult':
      if (s.scene.type !== 'shooting' || !r?.outcome || r.outcome.kind === 'sniperEliminated') {
        return null;
      }
      return { ...finalizeRound(s), scene: { type: 'roundResult' } };

    case 'nextFromResult':
      if (s.scene.type !== 'roundResult') return null;
      return afterRound(s);

    case 'acknowledge':
      switch (s.scene.type) {
        case 'eliminated': {
          const eliminatedId = s.scene.playerId;
          const judgement =
            s.phase === 'suddenDeath'
              ? judgeSuddenDeathElimination(
                  must(s.suddenDeath, 'sudden death').participantIds,
                  eliminatedId,
                  s.hp,
                )
              : judgeElimination(seatOrder(s), eliminatedId, s.hp, s.config.tiebreak);
          return applyJudgement(s, judgement);
        }
        case 'overtimeAnnouncement':
          return startRound(s);
        case 'suddenDeathAnnouncement':
          return { ...s, scene: { type: 'suddenDeathOrder' } };
        default:
          return null;
      }

    case 'setSuddenDeathOrder': {
      const sd = s.suddenDeath;
      if (s.scene.type !== 'suddenDeathOrder' || !sd) return null;
      if (!isPermutationOf(action.targetOrder, sd.participantIds)) return null;
      return startRound({
        ...s,
        suddenDeath: { ...sd, targetOrder: [...action.targetOrder], turn: 0 },
      });
    }
  }
}

/** 射撃の入力（SPEC 2.4, 2.5, 3.7） */
function recordShot(state: GameState, result: ShotResult, memo: string | undefined): GameState {
  const s = stripUndo(state);
  const r = s.round;
  if (
    s.scene.type !== 'shooting' ||
    !r ||
    r.outcome !== null ||
    !r.answerOrder ||
    !r.shotOrder ||
    !r.distanceByHint
  ) {
    return state;
  }
  const sniperId = must(r.answerOrder[r.answererIndex], 'current sniper');
  const shot = r.shot;

  switch (result) {
    case 'hit': {
      const hintIndex = must(r.shotOrder[shot], 'hint of the shot');
      const damage = hitDamage(
        s.config,
        shot,
        must(r.distanceByHint[hintIndex], 'distance points'),
        r.multiplier,
      );
      const before = hpOf(s, r.targetId);
      const after = applyDamage(before, damage);
      const event: ShotEvent = {
        kind: 'hit',
        shot,
        sniperId,
        hintIndex,
        damage,
        applied: before - after,
      };
      const next: GameStateBody = {
        ...s,
        hp: { ...s.hp, [r.targetId]: after },
        round: {
          ...r,
          events: [...r.events, event],
          outcome: { kind: 'hit', sniperId, shot },
        },
      };
      // 脱落が発生した操作は取り消せない（SPEC 3.7）
      if (after === 0) return { ...eliminate(next, r.targetId), undo: null };
      return { ...next, undo: s };
    }
    case 'miss': {
      const damage = missDamage(s.config, r.multiplier);
      const before = hpOf(s, sniperId);
      const after = applyDamage(before, damage);
      const event: ShotEvent = {
        kind: 'miss',
        shot,
        sniperId,
        memo: memo?.trim() || null,
        damage,
        applied: before - after,
      };
      const next: GameStateBody = {
        ...s,
        hp: { ...s.hp, [sniperId]: after },
        round: { ...r, events: [...r.events, event] },
      };
      if (after === 0) {
        const ended: GameStateBody = {
          ...next,
          round: {
            ...must(next.round, 'round'),
            outcome: { kind: 'sniperEliminated', sniperId, shot },
          },
        };
        return { ...eliminate(ended, sniperId), undo: null };
      }
      return { ...advance(next), undo: s };
    }
    case 'pass': {
      const event: ShotEvent = { kind: 'pass', shot, sniperId };
      return { ...advance({ ...s, round: { ...r, events: [...r.events, event] } }), undo: s };
    }
  }
}

/** 次の狙撃手・次の射へ進める。5射目まで命中が出なければ逃げ切り（SPEC 2.4, 2.5） */
function advance(s: GameStateBody): GameStateBody {
  const r = must(s.round, 'round');
  const order = must(r.answerOrder, 'answer order');
  if (r.answererIndex + 1 < order.length) {
    return { ...s, round: { ...r, answererIndex: r.answererIndex + 1 } };
  }
  if (r.shot + 1 < hintCountOf(s.config)) {
    return { ...s, round: { ...r, shot: r.shot + 1, answererIndex: 0 } };
  }
  const before = hpOf(s, r.targetId);
  const after = applyHeal(before, s.config);
  return {
    ...s,
    hp: { ...s.hp, [r.targetId]: after },
    round: { ...r, outcome: { kind: 'escaped', healApplied: after - before } },
  };
}

function eliminate(s: GameStateBody, playerId: PlayerId): GameStateBody {
  return { ...finalizeRound(s), scene: { type: 'eliminated', playerId } };
}

/** 現在のターンを記録に確定する */
function finalizeRound(s: GameStateBody): GameStateBody {
  const r = must(s.round, 'round');
  return { ...s, records: [...s.records, { ...r, hpAfter: { ...s.hp } }] };
}

/** ターン結果のあと：次のターン・ラウンド数の判定・サドンデスの1巡の判定（SPEC 2.7） */
function afterRound(s: GameStateBody): GameStateBody {
  if (s.phase === 'suddenDeath') {
    const sd = must(s.suddenDeath, 'sudden death');
    const next: GameStateBody = { ...s, suddenDeath: { ...sd, turn: sd.turn + 1 } };
    if (sd.turn + 1 < sd.participantIds.length) return startRound(next);
    return applyJudgement(next, judgeSuddenDeathCycle(sd.participantIds, sd.spotterId, s.hp));
  }
  const next: GameStateBody = { ...s, rotationIndex: s.rotationIndex + 1 };
  // 延長戦突入の判定はラウンド数の最終ターンが終わった時点（SPEC 7章）
  if (
    s.phase === 'main' &&
    isCycleLimitReached(next.rotationIndex, s.players.length, s.config.maxCycles)
  ) {
    return applyJudgement(next, judgeCycleLimit(seatOrder(s), s.hp, s.config.tiebreak));
  }
  return startRound(next);
}

function applyJudgement(s: GameStateBody, judgement: Judgement): GameStateBody {
  const exits =
    judgement.exitedIds.length > 0
      ? [
          ...s.exits,
          {
            playerIds: [...judgement.exitedIds],
            hp: Object.fromEntries(judgement.exitedIds.map((id) => [id, hpOf(s, id)])),
          },
        ]
      : s.exits;
  const base: GameStateBody = { ...s, exits, round: null };
  const { resolution } = judgement;
  switch (resolution.kind) {
    case 'winner':
      return finish(base, [resolution.winnerId], false);
    case 'draw':
      return finish(base, resolution.winnerIds, true);
    case 'overtime':
      return { ...base, phase: 'overtime', scene: { type: 'overtimeAnnouncement' } };
    case 'suddenDeath':
      return {
        ...base,
        phase: 'suddenDeath',
        suddenDeath: {
          participantIds: resolution.participantIds,
          spotterId: resolution.spotterId,
          targetOrder: null,
          turn: 0,
        },
        scene: { type: 'suddenDeathAnnouncement' },
      };
  }
}

function finish(s: GameStateBody, winnerIds: PlayerId[], draw: boolean): GameStateBody {
  return {
    ...s,
    result: { winnerIds, draw, standings: computeStandings(winnerIds, s.exits) },
    scene: { type: 'finished' },
  };
}

/** 局面に応じた役割でターンを始める */
function startRound(s: GameStateBody): GameStateBody {
  const seat = seatOrder(s);
  let roles: Roles;
  let label: RoundLabel;
  let { overtimeRounds, suddenDeathRounds } = s;

  switch (s.phase) {
    case 'main': {
      roles = rotationRoles(seat, s.rotationIndex);
      label = {
        phase: 'main',
        cycle: Math.floor(s.rotationIndex / seat.length) + 1,
        roundInCycle: (s.rotationIndex % seat.length) + 1,
      };
      break;
    }
    case 'overtime': {
      roles = rotationRoles(seat, s.rotationIndex);
      overtimeRounds += 1;
      label = { phase: 'overtime', round: overtimeRounds };
      break;
    }
    case 'suddenDeath': {
      const sd = must(s.suddenDeath, 'sudden death');
      roles = suddenDeathRoles(
        seat,
        must(sd.targetOrder, 'sudden death target order'),
        sd.turn,
        sd.spotterId,
      );
      suddenDeathRounds += 1;
      label = { phase: 'suddenDeath', round: suddenDeathRounds };
      break;
    }
  }

  const round: RoundState = {
    phase: s.phase,
    label,
    targetId: roles.targetId,
    spotterId: roles.spotterId,
    sniperIds: roles.sniperIds,
    multiplier: multiplierFor(s.phase, s.config),
    drawnEntry: null,
    drawCount: 0,
    topic: null,
    hints: [],
    rejections: null,
    rejectionCount: 0,
    distanceByHint: null,
    shotOrder: null,
    answerOrder: null,
    shot: 0,
    answererIndex: 0,
    events: [],
    outcome: null,
  };
  return { ...s, overtimeRounds, suddenDeathRounds, round, scene: { type: 'roundIntro' } };
}

function handoff(playerId: PlayerId, role: 'target' | 'spotter', next: HandoffNext): Scene {
  return { type: 'handoff', playerId, role, next };
}

function sceneOf(next: HandoffNext): Scene {
  switch (next) {
    case 'compose':
      return { type: 'compose' };
    case 'review':
      return { type: 'review' };
    case 'answerOrder':
      return { type: 'answerOrder' };
    case 'shooting':
      return { type: 'shooting' };
    case 'suddenDeathOrder':
      return { type: 'suddenDeathOrder' };
  }
}

function seatOrder(s: GameStateBody): PlayerId[] {
  return s.players.map((p) => p.id);
}

function hpOf(s: GameStateBody, id: PlayerId): number {
  return must(s.hp[id], `hp of ${id}`);
}

function stripUndo(state: GameState): GameStateBody {
  const { undo, ...body } = state;
  void undo;
  return body;
}

/**
 * 続きから再開するときの場面（SPEC 3.2）。
 * 秘密情報を含む場面や、特定の役割が操作する場面には直接戻らず、その場面の受け渡し画面から再開する。
 */
export function prepareForResume(state: GameState): GameState {
  const r = state.round;
  switch (state.scene.type) {
    case 'compose':
      return r ? { ...state, scene: handoff(r.targetId, 'target', 'compose') } : state;
    case 'review':
    case 'answerOrder':
    case 'shooting':
      return r ? { ...state, scene: handoff(r.spotterId, 'spotter', state.scene.type) } : state;
    case 'suddenDeathOrder':
      return state.suddenDeath
        ? {
            ...state,
            scene: handoff(state.suddenDeath.spotterId, 'spotter', 'suddenDeathOrder'),
          }
        : state;
    default:
      return state;
  }
}
