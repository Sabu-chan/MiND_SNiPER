import { describe, expect, it } from 'vitest';
import { createApproveAction, createDrawTopicAction } from './actions';
import { createDefaultConfig, type GameConfig } from './config';
import { buildPool, validateDictionary, type DictionaryPool } from './dictionary';
import type { Player, PlayerId } from './players';
import { createGame, gameReducer, prepareForResume, type GameAction } from './reducer';
import { createSeededRng, createSequenceRng } from './rng';
import {
  canScoutGenre,
  canUndo,
  hasGenreScout,
  revealedGenre,
  currentSniperId,
  isHoldRequired,
  lastRecord,
  answerHistory,
  playerById,
  remainingDraws,
  remainingRerolls,
  revealedHints,
  secretHpHistory,
} from './selectors';
import type { GameState } from './state';

// ---------------------------------------------------------------------------
// テスト用の補助
// ---------------------------------------------------------------------------

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

const HINTS = ['ヒントA', 'ヒントB', 'ヒントC', 'ヒントD', 'ヒントE'];
/** ヒントの添字順がそのまま遠い順（遠さ点 10,8,6,4,2） */
const FAR_TO_NEAR = [0, 1, 2, 3, 4];
/** 出題順もヒントの添字順（1射目＝遠さ点10のヒント） */
const SHOT_ORDER = [0, 1, 2, 3, 4];

function newGame(n = 4, patch: Partial<GameConfig> = {}): GameState {
  return createGame(players(n), { ...createDefaultConfig(), ...patch });
}

/** 有効なアクションを順に適用する。状態が変わらなければ（無効なら）失敗させる */
function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, action) => {
    const next = gameReducer(s, action);
    if (next === s) throw new Error(`action was rejected: ${JSON.stringify(action)}`);
    return next;
  }, state);
}

/** 無効なアクションは状態を変えない（同じ参照を返す） */
function expectRejected(state: GameState, action: GameAction): void {
  expect(gameReducer(state, action)).toBe(state);
}

/** ターン開始から射撃開始まで進める（回答順は初期値のまま） */
function toShooting(state: GameState, shotOrder = SHOT_ORDER): GameState {
  let s = play(
    state,
    { type: 'beginRound' },
    { type: 'openHandoff' },
    {
      type: 'submitHints',
      topic: { source: 'free', text: '正解', genre: 'creature' },
      hints: HINTS,
    },
    { type: 'openHandoff' },
    { type: 'approveHints', farToNear: FAR_TO_NEAR, shotOrder },
  );
  if (s.scene.type === 'answerOrder') {
    s = play(s, { type: 'startShooting', answerOrder: [...(s.round?.sniperIds ?? [])] });
  }
  expect(s.scene.type).toBe('shooting');
  return s;
}

const shot = (result: 'hit' | 'miss' | 'pass', memo?: string): GameAction =>
  memo === undefined ? { type: 'recordShot', result } : { type: 'recordShot', result, memo };

/** 全員パスで逃げ切らせる */
function escapeRound(state: GameState): GameState {
  let s = state;
  while (s.round?.outcome === null) s = play(s, shot('pass'));
  return s;
}

/** ターンを終えて次へ（ターン結果画面を経由する） */
function finishRound(state: GameState): GameState {
  return play(state, { type: 'proceedToResult' }, { type: 'nextFromResult' });
}

function withHp(state: GameState, hp: Record<PlayerId, number>): GameState {
  return { ...state, hp: { ...state.hp, ...hp } };
}

const pool: DictionaryPool = (() => {
  const { value } = validateDictionary(
    {
      version: 1,
      lang: 'ja',
      name: 'テスト',
      categories: [
        { id: 'pref', label: '都道府県', genre: 'japan-place' },
        { id: 'animal', label: '動物', genre: 'creature' },
      ],
      entries: [
        { id: 'hokkaido', word: '北海道', reading: 'ほっかいどう', category: 'pref' },
        { id: 'aomori', word: '青森県', category: 'pref' },
        { id: 'panda', word: 'パンダ', category: 'animal' },
      ],
    },
    'test.json',
  );
  return buildPool(value ? [value] : [], 'ja', []);
})();

// ---------------------------------------------------------------------------

describe('createGame', () => {
  it('全員HP100で、第1ラウンド第1ターンの開始画面から始まる', () => {
    const s = newGame(4);
    expect(s.hp).toEqual({ p0: 100, p1: 100, p2: 100, p3: 100 });
    expect(s.scene).toEqual({ type: 'roundIntro' });
    expect(s.round).toMatchObject({
      label: { phase: 'main', cycle: 1, roundInCycle: 1 },
      targetId: 'p0',
      spotterId: 'p1',
      sniperIds: ['p2', 'p3'],
      multiplier: 1,
    });
  });

  it('CONFIG を複製してゲームに固定する（あとで元を変えても影響しない）', () => {
    const config = createDefaultConfig();
    const s = createGame(players(3), config);
    config.shotPoints[0] = 1;
    config.startHp = 50;
    expect(s.config.shotPoints[0]).toBe(50);
    expect(s.config.startHp).toBe(100);
  });

  it('人数・名前・CONFIG が不正なら作らない', () => {
    expect(() => createGame(players(2), createDefaultConfig())).toThrow(/invalid player count/);
    expect(() => createGame(players(7), createDefaultConfig())).toThrow(/invalid player count/);
    expect(() =>
      createGame(
        [
          { id: 'a', name: 'X' },
          { id: 'b', name: 'X' },
          { id: 'c', name: 'Y' },
        ],
        createDefaultConfig(),
      ),
    ).toThrow(/invalid player names/);
    expect(() => createGame(players(3), { ...createDefaultConfig(), maxCycles: 0 })).toThrow(
      /invalid config/,
    );
  });
});

describe('出題から承認まで（SPEC 2.3, 3.5, 3.6）', () => {
  it('受け渡し画面を挟んで、標的→観測手と進む。秘密情報の場面だけ長押しにする', () => {
    let s = play(newGame(4), { type: 'beginRound' });
    expect(s.scene).toEqual({ type: 'handoff', playerId: 'p0', role: 'target', next: 'compose' });
    expect(isHoldRequired(s)).toBe(true);

    s = play(
      s,
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: ' 正解 ', genre: 'creature' },
        hints: HINTS,
      },
    );
    expect(s.scene).toEqual({ type: 'handoff', playerId: 'p1', role: 'spotter', next: 'review' });
    expect(s.round?.topic).toEqual({
      text: '正解',
      reading: null,
      source: 'free',
      entryKey: null,
      categoryLabel: null,
      genre: 'creature',
    });

    s = play(s, { type: 'openHandoff' });
    expect(s.scene).toEqual({ type: 'review' });
    s = play(s, { type: 'approveHints', farToNear: [4, 3, 2, 1, 0], shotOrder: [2, 0, 4, 1, 3] });
    expect(s.round?.distanceByHint).toEqual([2, 4, 6, 8, 10]);
    expect(s.scene).toEqual({ type: 'answerOrder' });
    expect(isHoldRequired(s)).toBe(false);
  });

  it('入力チェックに通らないヒント・空の正解は受け付けない', () => {
    const s = play(newGame(4), { type: 'beginRound' }, { type: 'openHandoff' });
    const submit = (text: string, hints: string[]): GameAction => ({
      type: 'submitHints',
      topic: { source: 'free', text, genre: 'creature' },
      hints,
    });
    expectRejected(s, submit('正解', ['a', 'b', 'c', 'd', '']));
    expectRejected(s, submit('正解', ['a', 'b', 'c', 'd', 'ａ']));
    expectRejected(s, submit('正解', ['a', 'b', 'c', 'd', '正解']));
    expectRejected(s, submit('正解', ['a', 'b', 'c', 'd']));
    expectRejected(s, submit('  ', ['a', 'b', 'c', 'd', 'e']));
  });

  it('差し戻されたヒントだけを書き換え、再び観測手の判定を受ける（回数制限なし）', () => {
    let s = play(
      newGame(4),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: '正解', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'openHandoff' },
      {
        type: 'rejectHints',
        rejections: [
          { hintIndex: 3, comment: ' 遠すぎる ' },
          { hintIndex: 1, comment: '' },
        ],
      },
    );
    expect(s.scene).toEqual({ type: 'handoff', playerId: 'p0', role: 'target', next: 'compose' });
    expect(s.round?.rejections).toEqual([
      { hintIndex: 1, comment: null },
      { hintIndex: 3, comment: '遠すぎる' },
    ]);

    // 差し戻していないヒントは送られてきても変えない。正解も変わらない
    s = play(
      s,
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: '別の正解', genre: 'creature' },
        hints: ['変更X', '新B', '変更Y', '新D', '変更Z'],
      },
    );
    expect(s.round?.hints).toEqual(['ヒントA', '新B', 'ヒントC', '新D', 'ヒントE']);
    expect(s.round?.topic?.text).toBe('正解');
    expect(s.round?.rejections).toBeNull();

    // 2回目の差し戻し
    s = play(
      s,
      { type: 'openHandoff' },
      { type: 'rejectHints', rejections: [{ hintIndex: 0, comment: null }] },
      { type: 'openHandoff' },
    );
    // 書き換え後に既存のヒントと重複すると受け付けない
    expectRejected(s, {
      type: 'submitHints',
      topic: { source: 'free', text: '正解', genre: 'creature' },
      hints: ['新B', '', '', '', ''],
    });
    s = play(s, {
      type: 'submitHints',
      topic: { source: 'free', text: '正解', genre: 'creature' },
      hints: ['新A', '', '', '', ''],
    });
    expect(s.round?.hints).toEqual(['新A', '新B', 'ヒントC', '新D', 'ヒントE']);
    expect(s.round?.rejectionCount).toBe(2);
  });

  it('差し戻しのあるうちは承認できず、空の差し戻しや範囲外の添字は受け付けない', () => {
    const s = play(
      newGame(4),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: '正解', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'openHandoff' },
    );
    expectRejected(s, { type: 'rejectHints', rejections: [] });
    expectRejected(s, { type: 'rejectHints', rejections: [{ hintIndex: 5, comment: null }] });
    expectRejected(s, {
      type: 'rejectHints',
      rejections: [
        { hintIndex: 1, comment: null },
        { hintIndex: 1, comment: null },
      ],
    });
    expectRejected(s, { type: 'approveHints', farToNear: [0, 1, 2, 3], shotOrder: SHOT_ORDER });
    expectRejected(s, { type: 'approveHints', farToNear: FAR_TO_NEAR, shotOrder: [0, 0, 1, 2, 3] });
  });

  it('承認で出題順をシャッフルする（作成関数が乱数を使う）', () => {
    const s = play(
      newGame(4),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: '正解', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'openHandoff' },
    );
    const action = createApproveAction(s, FAR_TO_NEAR, createSequenceRng([0]));
    expect(action).toEqual({
      type: 'approveHints',
      farToNear: FAR_TO_NEAR,
      shotOrder: [1, 2, 3, 4, 0],
    });
  });

  it('回答順は狙撃手の並べ替えのみ受け付ける。狙撃手が1人なら登録画面を省略する', () => {
    const four = play(
      newGame(4),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: '正解', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'openHandoff' },
      { type: 'approveHints', farToNear: FAR_TO_NEAR, shotOrder: SHOT_ORDER },
    );
    expectRejected(four, { type: 'startShooting', answerOrder: ['p2'] });
    expectRejected(four, { type: 'startShooting', answerOrder: ['p2', 'p0'] });
    const started = play(four, { type: 'startShooting', answerOrder: ['p3', 'p2'] });
    expect(currentSniperId(started)).toBe('p3');

    const three = toShooting(newGame(3));
    expect(three.round?.answerOrder).toEqual(['p2']);
  });
});

describe('ランダム出題（SPEC 2.2、DECISIONS D-03）', () => {
  function composing(patch: Partial<GameConfig> = {}): GameState {
    return play(newGame(4, patch), { type: 'beginRound' }, { type: 'openHandoff' });
  }

  it('抽選結果を表示し、確定すると正解にカテゴリと読みが付く', () => {
    let s = composing();
    const action = createDrawTopicAction(s, pool, createSequenceRng([0, 0]));
    expect(action).not.toBeNull();
    s = play(s, action as GameAction);
    expect(s.round?.drawnEntry?.word).toBe('北海道');
    s = play(s, { type: 'submitHints', topic: { source: 'random' }, hints: HINTS });
    expect(s.round?.topic).toEqual({
      text: '北海道',
      reading: 'ほっかいどう',
      source: 'random',
      entryKey: 'test.json#hokkaido',
      categoryLabel: '都道府県',
      genre: 'japan-place',
    });
  });

  it('引き直しは上限回数まで。残り回数を数える', () => {
    let s = composing({ rerollLimit: 1 });
    expect(remainingRerolls(s)).toBe(1);
    expect(remainingDraws(s)).toBe(2);
    s = play(s, createDrawTopicAction(s, pool, createSeededRng(1)) as GameAction);
    expect(remainingRerolls(s)).toBe(1);
    s = play(s, createDrawTopicAction(s, pool, createSeededRng(2)) as GameAction);
    expect(remainingRerolls(s)).toBe(0);
    expect(createDrawTopicAction(s, pool, createSeededRng(3))).toBeNull();
    expectRejected(s, {
      type: 'drawTopic',
      entry: {
        key: 'test.json#panda',
        word: 'パンダ',
        reading: null,
        categoryId: 'animal',
        categoryLabel: '動物',
        genre: 'creature',
      },
    });
  });

  it('引き直し0回なら1回だけ抽選できる', () => {
    let s = composing({ rerollLimit: 0 });
    s = play(s, createDrawTopicAction(s, pool, createSeededRng(1)) as GameAction);
    expect(createDrawTopicAction(s, pool, createSeededRng(2))).toBeNull();
  });

  it('同じゲームで出た単語（引き直しで捨てたものを含む）は再び出ない', () => {
    let s = composing({ rerollLimit: 5 });
    const seen = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      const action = createDrawTopicAction(s, pool, createSeededRng(i));
      s = play(s, action as GameAction);
      seen.add(s.round?.drawnEntry?.word ?? '');
    }
    expect(seen).toEqual(new Set(['北海道', '青森県', 'パンダ']));
    // 辞書を使い切った
    expect(createDrawTopicAction(s, pool, createSeededRng(9))).toBeNull();
  });

  it('任意出題の正解と表記が一致する単語は抽選から外す', () => {
    let s = composing();
    s = play(s, {
      type: 'submitHints',
      topic: { source: 'free', text: 'パンダ', genre: 'creature' },
      hints: HINTS,
    });
    expect(s.usedWords).toContain('パンダ');
    // 次のターンで、パンダは出ない
    s = toShootingFromReview(s);
    s = finishRound(escapeRound(s));
    s = play(s, { type: 'beginRound' }, { type: 'openHandoff' });
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(createDrawTopicAction(s, pool, createSeededRng(seed))).not.toMatchObject({
        entry: { word: 'パンダ' },
      });
    }
  });

  it('正解を確定したあとは抽選できない。抽選していなければランダム出題で確定できない', () => {
    const s = composing();
    expectRejected(s, { type: 'submitHints', topic: { source: 'random' }, hints: HINTS });
  });

  function toShootingFromReview(state: GameState): GameState {
    return play(
      state,
      { type: 'openHandoff' },
      { type: 'approveHints', farToNear: FAR_TO_NEAR, shotOrder: SHOT_ORDER },
      { type: 'startShooting', answerOrder: ['p2', 'p3'] },
    );
  }
});

describe('射撃とダメージ（SPEC 2.4, 2.5）', () => {
  it('1射目に最も遠いヒントで命中すると、標的に60ダメージ。ターン終了', () => {
    let s = toShooting(newGame(4));
    expect(revealedHints(s)).toEqual(['ヒントA']);
    s = play(s, shot('hit'));
    expect(s.hp.p0).toBe(40);
    expect(s.round?.outcome).toEqual({ kind: 'hit', sniperId: 'p2', shot: 0 });
    expect(s.round?.events).toEqual([
      { kind: 'hit', shot: 0, sniperId: 'p2', hintIndex: 0, damage: 60, applied: 60 },
    ]);
    // ターンが終わったら入力できない
    expectRejected(s, shot('pass'));
    expect(currentSniperId(s)).toBeNull();
  });

  it('命中したヒントの遠さ点は、その射で公開したヒントの点（DECISIONS D-01）', () => {
    // 出題順：1射目＝ヒント4（遠さ点2）、2射目＝ヒント1（遠さ点8）
    let s = toShooting(newGame(4), [4, 1, 0, 2, 3]);
    s = play(s, shot('pass'), shot('pass'));
    expect(revealedHints(s)).toEqual(['ヒントE', 'ヒントB']);
    s = play(s, shot('pass'), shot('hit'));
    // 回数点40＋遠さ点8
    expect(s.hp.p0).toBe(52);
    expect(s.round?.outcome).toEqual({ kind: 'hit', sniperId: 'p3', shot: 1 });
  });

  it('誤射はその狙撃手に5ダメージ。メモを回答履歴に残し、次の狙撃手へ', () => {
    let s = toShooting(newGame(4));
    s = play(s, shot('miss', ' パンダ '));
    expect(s.hp.p2).toBe(95);
    expect(currentSniperId(s)).toBe('p3');
    s = play(s, shot('miss'));
    expect(answerHistory(s)).toEqual({
      p2: [{ shot: 0, kind: 'miss', memo: 'パンダ' }],
      p3: [{ shot: 0, kind: 'miss', memo: null }],
    });
    // 全員の入力が終わったら次の射
    expect(s.round?.shot).toBe(1);
    expect(currentSniperId(s)).toBe('p2');
  });

  it('パスも射番号つきで回答履歴に残す（DECISIONS D-31）', () => {
    let s = toShooting(newGame(4));
    s = play(s, shot('pass'), shot('miss', 'ゾウ'), shot('pass'), shot('pass'));
    expect(answerHistory(s)).toEqual({
      p2: [
        { shot: 0, kind: 'pass', memo: null },
        { shot: 1, kind: 'pass', memo: null },
      ],
      p3: [
        { shot: 0, kind: 'miss', memo: 'ゾウ' },
        { shot: 1, kind: 'pass', memo: null },
      ],
    });
  });

  it('パスにダメージはない。5射終了まで命中がなければ逃げ切りで20回復（上限120）', () => {
    let s = toShooting(withHp(newGame(4), { p0: 110 }));
    s = escapeRound(s);
    expect(s.round?.events.filter((e) => e.kind === 'pass')).toHaveLength(10);
    expect(s.round?.outcome).toEqual({ kind: 'escaped', healApplied: 10 });
    expect(s.hp).toEqual({ p0: 120, p1: 100, p2: 100, p3: 100 });
  });

  it('ターン結果を経て次のターンへ。輪番が進む', () => {
    let s = finishRound(play(toShooting(newGame(4)), shot('hit')));
    expect(s.scene).toEqual({ type: 'roundIntro' });
    expect(s.round).toMatchObject({
      label: { phase: 'main', cycle: 1, roundInCycle: 2 },
      targetId: 'p1',
      spotterId: 'p2',
      sniperIds: ['p3', 'p0'],
    });
    expect(s.records).toHaveLength(1);
    expect(s.records[0]?.hpAfter).toEqual({ p0: 40, p1: 100, p2: 100, p3: 100 });

    // 2ラウンド目
    for (let i = 0; i < 3; i += 1) s = finishRound(escapeRound(toShooting(s)));
    expect(s.round?.label).toEqual({ phase: 'main', cycle: 2, roundInCycle: 1 });
    expect(s.round?.targetId).toBe('p0');
  });

  it('ターン結果画面は直前の記録を表示する（命中で終わったターン）', () => {
    const s = play(play(toShooting(newGame(4)), shot('hit')), { type: 'proceedToResult' });
    expect(s.scene).toEqual({ type: 'roundResult' });
    expect(s.records.at(-1)?.outcome).toEqual({ kind: 'hit', sniperId: 'p2', shot: 0 });
  });
});

describe('元に戻す（SPEC 3.7、DECISIONS D-02）', () => {
  it('直前の1操作だけを取り消せる', () => {
    let s = toShooting(newGame(4));
    s = play(s, shot('miss'), shot('pass'));
    expect(canUndo(s)).toBe(true);
    s = play(s, { type: 'undo' });
    expect(currentSniperId(s)).toBe('p3');
    expect(s.round?.events).toHaveLength(1);
    // 続けて遡ることはできない
    expect(canUndo(s)).toBe(false);
    expectRejected(s, { type: 'undo' });
    expect(s.hp.p2).toBe(95);
  });

  it('誤射を取り消すとHPも戻る', () => {
    let s = play(toShooting(newGame(4)), shot('miss'));
    s = play(s, { type: 'undo' });
    expect(s.hp.p2).toBe(100);
    expect(currentSniperId(s)).toBe('p2');
  });

  it('脱落を伴わない命中でターンが終わった直後は取り消せる', () => {
    let s = play(toShooting(newGame(4)), shot('pass'), shot('hit'));
    expect(canUndo(s)).toBe(true);
    s = play(s, { type: 'undo' });
    expect(s.round?.outcome).toBeNull();
    expect(s.hp.p0).toBe(100);
    expect(currentSniperId(s)).toBe('p3');
  });

  it('逃げ切りで終わった直後も取り消せる', () => {
    let s = escapeRound(toShooting(withHp(newGame(4), { p0: 90 })));
    s = play(s, { type: 'undo' });
    expect(s.round?.outcome).toBeNull();
    expect(s.hp.p0).toBe(90);
  });

  it('ターン結果画面に進んだら確定する', () => {
    const s = play(toShooting(newGame(4)), shot('hit'), { type: 'proceedToResult' });
    expect(canUndo(s)).toBe(false);
    expectRejected(s, { type: 'undo' });
  });

  it('脱落が発生した操作は取り消せない', () => {
    const s = play(toShooting(withHp(newGame(4), { p2: 5 })), shot('miss'));
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p2' });
    expect(canUndo(s)).toBe(false);
    expectRejected(s, { type: 'undo' });
  });
});

describe('脱落と終了判定（SPEC 2.7, 3.9）', () => {
  it('誤射でHPが0になった瞬間、射の途中でもゲーム終了を告げる', () => {
    let s = toShooting(withHp(newGame(4), { p2: 5, p0: 80, p1: 90, p3: 70 }));
    s = play(s, shot('miss'));
    expect(s.hp.p2).toBe(0);
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p2' });
    expect(s.records.at(-1)?.outcome).toEqual({
      kind: 'sniperEliminated',
      sniperId: 'p2',
      shot: 0,
    });
    // 残りの狙撃手は回答しない
    expectRejected(s, shot('pass'));

    s = play(s, { type: 'acknowledge' });
    expect(s.scene).toEqual({ type: 'finished' });
    expect(s.result).toEqual({
      winnerIds: ['p1'],
      draw: false,
      standings: [
        { playerId: 'p1', rank: 1 },
        { playerId: 'p0', rank: 2 },
        { playerId: 'p3', rank: 3 },
        { playerId: 'p2', rank: 4 },
      ],
    });
  });

  it('命中で標的のHPが0になっても脱落', () => {
    let s = toShooting(withHp(newGame(4), { p0: 60, p1: 50 }));
    s = play(s, shot('hit'));
    expect(s.hp.p0).toBe(0);
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p0' });
    expect(s.round).not.toBeNull();
    s = play(s, { type: 'acknowledge' });
    // p2 と p3 が 100 で同点 → サドンデス
    expect(s.scene).toEqual({ type: 'suddenDeathAnnouncement' });
  });

  it('ラウンド数で1位が単独ならその人の勝ち', () => {
    let s = newGame(3, { maxCycles: 1 });
    s = finishRound(play(toShooting(s), shot('hit'))); // p0: 40
    s = finishRound(escapeRound(toShooting(s))); // p1: 120
    s = play(toShooting(s), shot('hit')); // p2: 40
    s = finishRound(s);
    expect(s.scene).toEqual({ type: 'finished' });
    expect(s.result?.winnerIds).toEqual(['p1']);
    expect(s.result?.standings).toEqual([
      { playerId: 'p1', rank: 1 },
      { playerId: 'p0', rank: 2 },
      { playerId: 'p2', rank: 2 },
    ]);
  });

  it('引き分け方式で1位が同点なら同点者全員の引き分け', () => {
    let s = newGame(3, { maxCycles: 1, tiebreak: 'draw' });
    for (let i = 0; i < 3; i += 1) s = finishRound(escapeRound(toShooting(s)));
    expect(s.scene).toEqual({ type: 'finished' });
    expect(s.result).toMatchObject({ winnerIds: ['p0', 'p1', 'p2'], draw: true });
  });

  it('引き分け方式では脱落時に同点でもサドンデスにしない', () => {
    let s = toShooting(withHp(newGame(4, { tiebreak: 'draw' }), { p2: 5 }));
    s = play(s, shot('miss'), { type: 'acknowledge' });
    expect(s.result).toMatchObject({ winnerIds: ['p0', 'p1', 'p3'], draw: true });
  });

  it('ラウンド数の最終ターンの途中で脱落が出たら、そちらが優先', () => {
    let s = newGame(3, { maxCycles: 1 });
    s = finishRound(escapeRound(toShooting(s)));
    s = finishRound(escapeRound(toShooting(s)));
    s = play(toShooting(withHp(s, { p0: 60 })), shot('hit')); // 最終ターン：標的 p2、狙撃手 p1
    expect(s.round?.targetId).toBe('p2');
    // p2 は 120 → 60。脱落者なしでラウンド数 → p1（120）の単独1位
    s = finishRound(s);
    expect(s.result?.winnerIds).toEqual(['p1']);

    let t = newGame(3, { maxCycles: 1 });
    t = finishRound(escapeRound(toShooting(t)));
    t = finishRound(escapeRound(toShooting(t)));
    t = toShooting(withHp(t, { p1: 5 }));
    t = play(t, shot('miss'));
    expect(t.scene).toEqual({ type: 'eliminated', playerId: 'p1' });
  });
});

describe('延長戦（SPEC 2.7）', () => {
  function toOvertime(): GameState {
    let s = newGame(3, { maxCycles: 1 });
    for (let i = 0; i < 3; i += 1) s = finishRound(escapeRound(toShooting(s)));
    return s;
  }

  it('ラウンド数で脱落者がおらず1位が同点なら延長戦。誰が同点かは告知しない', () => {
    const s = toOvertime();
    expect(s.hp).toEqual({ p0: 120, p1: 120, p2: 120 });
    expect(s.scene).toEqual({ type: 'overtimeAnnouncement' });
    expect(s.phase).toBe('overtime');
    expect(s.round).toBeNull();
  });

  it('全員参加のまま輪番を続け、ダメージは2倍', () => {
    let s = play(toOvertime(), { type: 'acknowledge' });
    expect(s.round).toMatchObject({
      label: { phase: 'overtime', round: 1 },
      targetId: 'p0',
      spotterId: 'p1',
      multiplier: 2,
    });
    s = toShooting(s);
    s = play(s, shot('miss')); // 誤射 5×2
    expect(s.hp.p2).toBe(110);
    s = play(s, shot('hit')); // 2射目：(40+8)×2
    expect(s.hp.p0).toBe(24);
    s = finishRound(s);
    expect(s.round?.label).toEqual({ phase: 'overtime', round: 2 });
    expect(s.round?.targetId).toBe('p1');
  });

  it('延長戦にラウンド数はなく、誰かが脱落するまで続く', () => {
    let s = play(toOvertime(), { type: 'acknowledge' });
    for (let i = 0; i < 7; i += 1) s = finishRound(escapeRound(toShooting(s)));
    expect(s.scene).toEqual({ type: 'roundIntro' });
    expect(s.round?.label).toEqual({ phase: 'overtime', round: 8 });
  });

  it('延長戦で脱落者が出て1位が同点ならサドンデス', () => {
    let s = play(toOvertime(), { type: 'acknowledge' });
    s = play(toShooting(s), shot('hit')); // p0: 120 − 120 = 0
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p0' });
    s = play(s, { type: 'acknowledge' });
    expect(s.scene).toEqual({ type: 'suddenDeathAnnouncement' });
    expect(s.suddenDeath).toEqual({
      participantIds: ['p1', 'p2'],
      spotterId: 'p0',
      targetOrder: null,
      turn: 0,
    });
  });
});

describe('サドンデス（SPEC 2.7, 3.9）', () => {
  /** 4人：p2 が誤射で脱落、p0 と p1 が 80 で同点、p3 は 50 */
  function toSuddenDeath(): GameState {
    let s = toShooting(withHp(newGame(4), { p0: 80, p1: 80, p2: 5, p3: 50 }));
    s = play(s, shot('miss'), { type: 'acknowledge' });
    return s;
  }

  it('参加者（同点者）と観測手（脱落者）を告知し、標的順の登録へ', () => {
    let s = toSuddenDeath();
    expect(s.scene).toEqual({ type: 'suddenDeathAnnouncement' });
    expect(s.suddenDeath).toMatchObject({ participantIds: ['p0', 'p1'], spotterId: 'p2' });
    s = play(s, { type: 'acknowledge' });
    expect(s.scene).toEqual({ type: 'suddenDeathOrder' });
    expectRejected(s, { type: 'setSuddenDeathOrder', targetOrder: ['p0', 'p3'] });
    expectRejected(s, { type: 'setSuddenDeathOrder', targetOrder: ['p0'] });
  });

  it('登録した順に標的を務め、観測手は脱落者。倍率は1倍', () => {
    let s = play(
      toSuddenDeath(),
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p1', 'p0'] },
    );
    expect(s.round).toMatchObject({
      label: { phase: 'suddenDeath', round: 1 },
      targetId: 'p1',
      spotterId: 'p2',
      sniperIds: ['p0'],
      multiplier: 1,
    });
    s = finishRound(play(toShooting(s), shot('hit'))); // p1: 80 − 60 = 20
    expect(s.round).toMatchObject({ targetId: 'p0', sniperIds: ['p1'] });
  });

  it('参加者全員が標的を務めてもHP0が出なければ、その時点のHPで比較する', () => {
    let s = play(
      toSuddenDeath(),
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p1', 'p0'] },
    );
    s = finishRound(play(toShooting(s), shot('hit'))); // p1: 20
    s = finishRound(escapeRound(toShooting(s))); // p0: 100
    expect(s.scene).toEqual({ type: 'finished' });
    expect(s.result).toEqual({
      winnerIds: ['p0'],
      draw: false,
      standings: [
        { playerId: 'p0', rank: 1 },
        { playerId: 'p1', rank: 2 },
        { playerId: 'p3', rank: 3 },
        { playerId: 'p2', rank: 4 },
      ],
    });
  });

  it('それでも同点なら同点者だけで繰り返す（観測手は同じ人、HPは引き継ぐ）', () => {
    let s = play(
      toSuddenDeath(),
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p0', 'p1'] },
    );
    s = finishRound(escapeRound(toShooting(s))); // p0: 100
    s = finishRound(escapeRound(toShooting(s))); // p1: 100
    expect(s.scene).toEqual({ type: 'suddenDeathAnnouncement' });
    expect(s.suddenDeath).toEqual({
      participantIds: ['p0', 'p1'],
      spotterId: 'p2',
      targetOrder: null,
      turn: 0,
    });
    s = play(
      s,
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p1', 'p0'] },
    );
    expect(s.round?.label).toEqual({ phase: 'suddenDeath', round: 3 });
    expect(s.hp).toMatchObject({ p0: 100, p1: 100 });
  });

  it('同点者が2人なら、どちらかのHPが0になった瞬間にもう一方の勝ち', () => {
    let s = play(
      toSuddenDeath(),
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p1', 'p0'] },
    );
    s = play(toShooting(withHp(s, { p1: 60 })), shot('hit'));
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p1' });
    s = play(s, { type: 'acknowledge' });
    expect(s.result?.winnerIds).toEqual(['p0']);
  });

  it('3人のサドンデスで1人がHP0になり、残りが同点なら再びサドンデス（観測手は今回HP0の人）', () => {
    // 5人：p4 が誤射で脱落、p0・p1・p2 が 80 で同点
    let s = toShooting(withHp(newGame(5), { p0: 80, p1: 80, p2: 80, p3: 80, p4: 5 }));
    // 第1ターン：標的 p0、観測手 p1、狙撃手 p2, p3, p4
    s = play(s, shot('pass'), shot('pass'));
    s = withHp(s, { p3: 10 }); // p3 を同点から外す
    s = play(s, shot('miss'), { type: 'acknowledge' });
    expect(s.suddenDeath).toMatchObject({ participantIds: ['p0', 'p1', 'p2'], spotterId: 'p4' });

    s = play(
      s,
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p2', 'p0', 'p1'] },
    );
    expect(s.round).toMatchObject({ targetId: 'p2', spotterId: 'p4', sniperIds: ['p0', 'p1'] });
    s = play(toShooting(withHp(s, { p2: 60 })), shot('hit'));
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p2' });
    s = play(s, { type: 'acknowledge' });
    expect(s.suddenDeath).toEqual({
      participantIds: ['p0', 'p1'],
      spotterId: 'p2',
      targetOrder: null,
      turn: 0,
    });
  });
});

describe('続きから再開（SPEC 3.2）', () => {
  it('秘密情報を含む場面には直接戻らず、その場面の受け渡し画面から再開する', () => {
    const composing = play(newGame(4), { type: 'beginRound' }, { type: 'openHandoff' });
    expect(prepareForResume(composing).scene).toEqual({
      type: 'handoff',
      playerId: 'p0',
      role: 'target',
      next: 'compose',
    });

    const reviewing = play(
      composing,
      {
        type: 'submitHints',
        topic: { source: 'free', text: '正解', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'openHandoff' },
    );
    expect(prepareForResume(reviewing).scene).toEqual({
      type: 'handoff',
      playerId: 'p1',
      role: 'spotter',
      next: 'review',
    });

    const shooting = toShooting(newGame(4));
    const resumed = prepareForResume(shooting);
    expect(resumed.scene).toEqual({
      type: 'handoff',
      playerId: 'p1',
      role: 'spotter',
      next: 'shooting',
    });
    expect(isHoldRequired(resumed)).toBe(false);
    expect(play(resumed, { type: 'openHandoff' }).scene).toEqual({ type: 'shooting' });
  });

  it('全員に見せる場面はそのまま', () => {
    const intro = newGame(4);
    expect(prepareForResume(intro)).toBe(intro);
  });
});

describe('結果発表用の記録', () => {
  it('HP推移は開始時点と各ターン終了時点（DECISIONS D-08）', () => {
    let s = newGame(3, { maxCycles: 1 });
    // 狙撃手は p2 の1人：1射目に誤射、2射目にパス、3射目に命中（(30+6)×1）
    s = finishRound(play(toShooting(s), shot('miss'), shot('pass'), shot('hit')));
    expect(secretHpHistory(s)).toEqual([
      { recordIndex: null, hp: { p0: 100, p1: 100, p2: 100 } },
      { recordIndex: 0, hp: { p0: 64, p1: 100, p2: 95 } },
    ]);
  });

  it('ターン結果画面用に直前の記録と名前を引ける', () => {
    const s = play(play(toShooting(newGame(4)), shot('hit')), { type: 'proceedToResult' });
    expect(lastRecord(s)?.topic?.text).toBe('正解');
    expect(playerById(s, 'p2').name).toBe('P2');
    expect(lastRecord(newGame(4))).toBeNull();
    expect(() => playerById(s, 'nobody')).toThrow(/player nobody/);
  });

  it('記録は JSON に保存して戻しても同じ（localStorage に保存できる）', () => {
    const s = play(toShooting(newGame(4)), shot('miss', 'メモ'));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('場面違いのアクション', () => {
  it('今の場面で受け付けないアクションは状態を変えない', () => {
    const s = newGame(4);
    const invalid: GameAction[] = [
      { type: 'openHandoff' },
      {
        type: 'submitHints',
        topic: { source: 'free', text: 'x', genre: 'creature' },
        hints: HINTS,
      },
      { type: 'rejectHints', rejections: [{ hintIndex: 0, comment: null }] },
      { type: 'approveHints', farToNear: FAR_TO_NEAR, shotOrder: SHOT_ORDER },
      { type: 'startShooting', answerOrder: ['p2', 'p3'] },
      shot('hit'),
      { type: 'undo' },
      { type: 'proceedToResult' },
      { type: 'nextFromResult' },
      { type: 'acknowledge' },
      { type: 'setSuddenDeathOrder', targetOrder: ['p0'] },
    ];
    for (const action of invalid) expectRejected(s, action);
  });
});

describe('ジャンル偵察（DECISIONS D-33）', () => {
  const scout: GameAction = { type: 'scoutGenre' };

  it('今の狙撃手に15ダメージ。ジャンルを公開し、そのまま回答を続ける', () => {
    let s = toShooting(newGame(4));
    expect(canScoutGenre(s)).toBe(true);
    expect(revealedGenre(s)).toBeNull();
    s = play(s, scout);
    expect(s.hp.p2).toBe(85);
    expect(revealedGenre(s)).toBe('creature');
    expect(hasGenreScout(s, 'p2')).toBe(false);
    expect(currentSniperId(s)).toBe('p2');
    expect(s.round?.events).toEqual([
      { kind: 'scout', shot: 0, sniperId: 'p2', damage: 15, applied: 15 },
    ]);
    // 偵察のあとに命中しても、命中ダメージは通常どおり（1射目＋距離点10）
    s = play(s, shot('hit'));
    expect(s.hp.p0).toBe(40);
  });

  it('偵察のあとはパスもできる', () => {
    const s = play(toShooting(newGame(4)), scout, shot('pass'));
    expect(currentSniperId(s)).toBe('p3');
    expect(answerHistory(s).p2).toEqual([{ shot: 0, kind: 'pass', memo: null }]);
  });

  it('同じターンでジャンルが公開済みなら、ほかの狙撃手は使えない', () => {
    const s = play(toShooting(newGame(4)), scout, shot('pass'));
    expect(currentSniperId(s)).toBe('p3');
    expect(hasGenreScout(s, 'p3')).toBe(true);
    expect(canScoutGenre(s)).toBe(false);
    expectRejected(s, scout);
  });

  it('1人1ゲームに1回。次のターンでも使えない', () => {
    // 3人：第1ターンの狙撃手 p2 が使う → 第4ターン（第2ラウンド）でも p2 は狙撃手
    let s = play(toShooting(newGame(3)), scout);
    s = finishRound(play(s, shot('hit')));
    for (let i = 0; i < 2; i += 1) s = finishRound(escapeRound(toShooting(s)));
    s = toShooting(s);
    expect(s.round?.label).toEqual({ phase: 'main', cycle: 2, roundInCycle: 1 });
    expect(currentSniperId(s)).toBe('p2');
    expect(canScoutGenre(s)).toBe(false);
    expectRejected(s, scout);
  });

  it('取り消せない。それより前の操作も「元に戻す」の対象から外れる', () => {
    let s = play(toShooting(newGame(4)), shot('pass'));
    expect(canUndo(s)).toBe(true);
    s = play(s, scout);
    expect(canUndo(s)).toBe(false);
    expectRejected(s, { type: 'undo' });
    // 偵察のあとの操作は取り消せる（偵察は残る）
    s = play(s, shot('miss'));
    s = play(s, { type: 'undo' });
    expect(revealedGenre(s)).toBe('creature');
    expect(s.hp.p3).toBe(85);
  });

  it('延長戦でもダメージに倍率をかけない（命中・誤射は2倍）', () => {
    let s = newGame(3, { maxCycles: 1 });
    for (let i = 0; i < 3; i += 1) s = finishRound(escapeRound(toShooting(s)));
    s = toShooting(play(s, { type: 'acknowledge' }));
    expect(s.round?.multiplier).toBe(2);
    s = play(s, scout);
    expect(s.hp.p2).toBe(105);
    s = play(s, shot('miss'));
    expect(s.hp.p2).toBe(95);
  });

  it('HPが0になったら誤射と同じく脱落（取り消せない）', () => {
    const s = play(toShooting(withHp(newGame(4), { p2: 10 })), scout);
    expect(s.hp.p2).toBe(0);
    expect(s.scene).toEqual({ type: 'eliminated', playerId: 'p2' });
    expect(s.records.at(-1)?.outcome).toEqual({
      kind: 'sniperEliminated',
      sniperId: 'p2',
      shot: 0,
    });
    expect(s.records.at(-1)?.events.at(-1)).toEqual({
      kind: 'scout',
      shot: 0,
      sniperId: 'p2',
      damage: 15,
      applied: 10,
    });
    expect(canUndo(s)).toBe(false);
  });

  it('ダメージは CONFIG で変えられる', () => {
    const s = play(toShooting(newGame(4, { genreScoutDamage: 30 })), scout);
    expect(s.hp.p2).toBe(70);
  });

  it('射撃中以外・ターン終了後は使えない', () => {
    expectRejected(newGame(4), scout);
    expectRejected(play(toShooting(newGame(4)), shot('hit')), scout);
  });

  it('任意出題ではジャンルが必須。ランダム出題は辞書のジャンルを使う', () => {
    const composing = play(newGame(4), { type: 'beginRound' }, { type: 'openHandoff' });
    expectRejected(composing, {
      type: 'submitHints',
      topic: { source: 'free', text: '富士山', genre: 'mountain' as never },
      hints: HINTS,
    });
    let s = play(
      composing,
      createDrawTopicAction(composing, pool, createSequenceRng([0, 0])) as GameAction,
    );
    s = play(s, { type: 'submitHints', topic: { source: 'random' }, hints: HINTS });
    expect(s.round?.topic?.genre).toBe('japan-place');
  });
});
