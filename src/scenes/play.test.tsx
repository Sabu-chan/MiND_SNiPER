import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig, type GameConfig } from '../game/config';
import { validateDictionary } from '../game/dictionary';
import { createGame, gameReducer, type GameAction } from '../game/reducer';
import type { GameState } from '../game/state';
import { expectNoSecrets, holdButton, renderRoute } from '../test/renderRoute';

/**
 * 秘匿の検査のため、画面の数字（射番号・周回など）と重ならない特徴的な値にする。
 * 長押しは実時間で待つので短くする。
 */
const CONFIG: GameConfig = {
  ...createDefaultConfig(),
  startHp: 777,
  maxHp: 888,
  shotPoints: [500, 400, 300, 200, 100],
  distancePoints: [91, 73, 55, 37, 19],
  missDamage: 13,
  escapeHeal: 29,
  holdDurationMs: 500,
};

const PLAYERS = [
  { id: 'a', name: 'アオイ' },
  { id: 'b', name: 'ベン' },
  { id: 'c', name: 'チカ' },
];

const HINTS = ['山', '静岡', '日本一', '世界遺産', '富士宮'];

function newGame(players = PLAYERS, config = CONFIG): GameState {
  return createGame(players, config);
}

function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => {
    const next = gameReducer(s, a);
    if (next === s) throw new Error(`rejected: ${JSON.stringify(a)}`);
    return next;
  }, state);
}

/** 射撃中まで進めた状態（3人：標的 a、観測手 b、狙撃手 c） */
function shootingState(): GameState {
  return play(
    newGame(),
    { type: 'beginRound' },
    { type: 'openHandoff' },
    { type: 'submitHints', topic: { source: 'free', text: '富士山' }, hints: HINTS },
    { type: 'openHandoff' },
    { type: 'approveHints', farToNear: [0, 1, 2, 3, 4], shotOrder: [0, 1, 2, 3, 4] },
  );
}

function renderGame(game: GameState, options: Parameters<typeof renderRoute>[1] = {}) {
  let current: GameState | null = game;
  const result = renderRoute('/play', {
    initialGame: game,
    initialPlayerNames: game.players.map((p) => p.name),
    onGame: (g) => {
      current = g;
    },
    ...options,
  });
  return {
    ...result,
    current: () => {
      if (!current) throw new Error('no game');
      return current;
    },
  };
}

describe('1ラウンドを画面で通して遊ぶ（SPEC 3.4〜3.8）', () => {
  it('受け渡し画面を挟み、秘密情報を出さずにラウンドを終えられる', async () => {
    const user = userEvent.setup();
    const { current } = renderGame(newGame());

    // ラウンド開始：役割を全員に表示
    expect(
      screen.getByRole('heading', { name: /第1ラウンド（全3ラウンド） 第1ゲーム/ }),
    ).toBeVisible();
    const roles = screen.getByRole('main');
    expect(within(roles).getByText('アオイ')).toBeVisible();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '標的に端末を渡す' }));

    // 受け渡し画面：名前と役割だけ。普通のタップでは開かない
    expect(screen.getByText('アオイさん（標的）に端末を渡してください')).toBeVisible();
    const open = screen.getByRole('button', { name: '長押しで開く' });
    await user.click(open);
    expect(screen.queryByRole('heading', { name: 'お題とヒントを決める' })).toBeNull();
    await holdButton(open, CONFIG.holdDurationMs);

    // 出題：入力チェック
    expect(screen.getByRole('heading', { name: 'お題とヒントを決める' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '確定して観測手に渡す' }));
    expect(screen.getByText('お題を入力してください')).toBeVisible();
    await user.type(screen.getByPlaceholderText('物の名前（例：富士山）'), '富士山');
    for (const [i, hint] of HINTS.entries()) {
      await user.type(screen.getByRole('textbox', { name: `ヒント${i + 1}` }), hint);
    }
    await user.clear(screen.getByRole('textbox', { name: 'ヒント5' }));
    await user.type(screen.getByRole('textbox', { name: 'ヒント5' }), '山');
    await user.click(screen.getByRole('button', { name: '確定して観測手に渡す' }));
    expect(screen.getAllByText('他のヒントと同じです')).toHaveLength(2);
    await user.clear(screen.getByRole('textbox', { name: 'ヒント5' }));
    await user.type(screen.getByRole('textbox', { name: 'ヒント5' }), '富士宮');
    await user.click(screen.getByRole('button', { name: '確定して観測手に渡す' }));

    // 観測手へ：お題は表示しない
    expect(screen.getByText('ベンさん（観測手）に端末を渡してください')).toBeVisible();
    expect(screen.queryByText('富士山')).toBeNull();
    expectNoSecrets(current());
    await holdButton(screen.getByRole('button', { name: '長押しで開く' }), CONFIG.holdDurationMs);

    // 承認：遠さ点を並べ替え中に表示する。「静岡」を差し戻す
    expect(screen.getByText('富士山')).toBeVisible();
    expect(screen.getByText('91点')).toBeVisible();
    const shizuoka = screen.getByText('静岡').closest('li') as HTMLElement;
    await user.click(within(shizuoka).getByRole('checkbox', { name: '差し戻し' }));
    await user.type(within(shizuoka).getByRole('textbox'), '近すぎる');
    expect(screen.queryByRole('button', { name: 'この順で承認' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '差し戻す' }));

    // 標的が差し戻されたヒントだけを書き直す
    expect(screen.getByText('アオイさん（標的）に端末を渡してください')).toBeVisible();
    await holdButton(screen.getByRole('button', { name: '長押しで開く' }), CONFIG.holdDurationMs);
    expect(screen.getByText('観測手のコメント：近すぎる')).toBeVisible();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    await user.clear(screen.getByRole('textbox', { name: 'ヒント2' }));
    await user.type(screen.getByRole('textbox', { name: 'ヒント2' }), '雪');
    await user.click(screen.getByRole('button', { name: '確定して観測手に渡す' }));
    await holdButton(screen.getByRole('button', { name: '長押しで開く' }), CONFIG.holdDurationMs);

    // 「日本一」を一番遠くに並べ替えて承認
    await user.click(screen.getByRole('button', { name: '日本一を上へ' }));
    await user.click(screen.getByRole('button', { name: '日本一を上へ' }));
    await user.click(screen.getByRole('button', { name: 'この順で承認' }));
    expect(current().round?.distanceByHint?.[2]).toBe(91);

    // 狙撃手が1人なので回答順の登録は省略され、射撃へ
    expect(screen.getByText('1/5')).toBeVisible();
    expect(screen.getByText('チカさん')).toBeVisible();
    expectNoSecrets(current());

    // 誤射（メモ付き）→ 元に戻す → 誤射 → パス → 命中
    await user.click(screen.getByRole('button', { name: '誤射' }));
    await user.type(screen.getByPlaceholderText('回答した言葉'), '富士');
    await user.click(screen.getByRole('button', { name: '誤射を記録' }));
    expect(screen.getByText('1射目「富士」')).toBeVisible();
    expect(screen.getByText('2/5')).toBeVisible();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(screen.getByText('1/5')).toBeVisible();
    expect(screen.queryByText('1射目「富士」')).toBeNull();
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '誤射' }));
    await user.click(screen.getByRole('button', { name: '誤射を記録' }));
    expect(screen.getByText('1射目')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'パス' }));
    expect(screen.getByText('3/5')).toBeVisible();
    expect(
      screen.getAllByRole('listitem').filter((li) => li.className.includes('revealed-hint')),
    ).toHaveLength(3);
    expectNoSecrets(current());

    // 命中は確認ダイアログを挟む
    await user.click(screen.getByRole('button', { name: '命中' }));
    const dialog = screen.getByRole('dialog', { name: '命中で確定しますか？' });
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: '命中' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '命中' }));
    expect(screen.getByText('チカさんが3射目で撃ち抜きました。')).toBeVisible();
    expectNoSecrets(current());

    // ラウンド結果：お題と命中（狙撃手名と射番号）まで。数値は出さない
    await user.click(screen.getByRole('button', { name: 'ゲーム結果へ' }));
    expect(screen.getByText('富士山')).toBeVisible();
    expect(screen.getByText('チカさんが3射目で撃ち抜きました。')).toBeVisible();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '次へ' }));

    // 次のラウンド：標的 ベン
    expect(screen.getByRole('heading', { name: /第2ゲーム/ })).toBeVisible();
    expect(current().round?.targetId).toBe('b');
  }, 20_000);

  it('お題を確認ボタンは長押しの間だけお題を表示する', async () => {
    renderGame(shootingState());
    const peek = screen.getByRole('button', { name: 'お題を確認（長押し）' });
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.pointerDown(peek);
    await act(() => new Promise((r) => setTimeout(r, CONFIG.holdDurationMs + 50)));
    expect(peek).toHaveTextContent('富士山');
    fireEvent.pointerUp(peek);
    expect(peek).toHaveTextContent('お題を確認（長押し）');
  });

  it('4人以上なら回答順を登録してから射撃する', async () => {
    const user = userEvent.setup();
    const four = [...PLAYERS, { id: 'd', name: 'ダン' }];
    const game = play(
      newGame(four),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      { type: 'submitHints', topic: { source: 'free', text: '富士山' }, hints: HINTS },
      { type: 'openHandoff' },
    );
    renderGame(game);
    await user.click(screen.getByRole('button', { name: 'この順で承認' }));
    expect(screen.getByRole('heading', { name: '回答順を決める' })).toBeVisible();
    // 初期の並びは観測手（ベン）の次の人から：チカ、ダン
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toContain('チカ');
    await user.click(screen.getByRole('button', { name: 'ダンを上へ' }));
    await user.click(screen.getByRole('button', { name: '射撃開始' }));
    expect(screen.getByText('ダンさん')).toBeVisible();
  });
});

describe('ランダム出題（SPEC 3.5）', () => {
  const dictionary = validateDictionary(
    {
      version: 1,
      lang: 'ja',
      name: 'テスト',
      categories: [{ id: 'm', label: '山' }],
      entries: [
        { id: 'fuji', word: '富士山', reading: 'ふじさん', category: 'm' },
        { id: 'aso', word: '阿蘇山', reading: 'あそさん', category: 'm' },
      ],
    },
    't.json',
  ).value;
  const load = () => Promise.resolve({ value: dictionary ? [dictionary] : [], warnings: [] });

  it('抽選結果とカテゴリを表示し、残り回数つきで引き直せる', async () => {
    const user = userEvent.setup();
    renderGame(play(newGame(), { type: 'beginRound' }, { type: 'openHandoff' }), {
      loadDictionaries: load,
    });
    const random = await screen.findByRole('radio', { name: 'ランダム出題' });
    await waitFor(() => expect(random).toBeEnabled());
    await user.click(random);
    expect(screen.getByText('山')).toBeVisible();
    expect(screen.getByText(/^(富士山|阿蘇山)$/)).toBeVisible();
    const reroll = screen.getByRole('button', { name: '引き直す（残り1回）' });
    await user.click(reroll);
    expect(screen.getByRole('button', { name: '引き直す（残り0回）' })).toBeDisabled();
  });

  it('辞書がなければ任意出題のみ', () => {
    renderGame(play(newGame(), { type: 'beginRound' }, { type: 'openHandoff' }));
    expect(screen.getByRole('radio', { name: 'ランダム出題' })).toBeDisabled();
    expect(screen.getByText('辞書がないため、任意出題のみです。')).toBeVisible();
  });
});

describe('終了の告知と結果発表（SPEC 3.9, 3.10）', () => {
  it('誤射で脱落したら脱落者を告知し、結果発表で全記録を公開する', async () => {
    const user = userEvent.setup();
    const game = { ...shootingState(), hp: { a: 500, b: 600, c: 13 } };
    const { router, current } = renderGame(game);
    await user.click(screen.getByRole('button', { name: '誤射' }));
    await user.click(screen.getByRole('button', { name: '誤射を記録' }));

    expect(screen.getByRole('heading', { name: '脱落者が出ました。試合終了' })).toBeVisible();
    expect(screen.getByText('チカさんが脱落しました。')).toBeVisible();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '次へ' }));

    expect(screen.getByText('優勝：ベンさん')).toBeVisible();
    const rows = within(screen.getByRole('table', { name: '順位表' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['1位ベン600', '2位アオイ500', '3位チカ0']);
    // HP推移のグラフ
    expect(screen.getByRole('img', { name: 'HP推移' })).toBeInTheDocument();
    // 出題順と遠さ点、誤射のダメージ量を公開する
    expect(screen.getByText('1射目：山（遠さ点91）')).toBeVisible();
    expect(screen.getByText('1射目 チカさんが誤射：13ダメージ')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '同じメンバーでもう一度' }));
    expect(router.state.location.pathname).toBe('/new');
    expect(screen.getByRole('textbox', { name: '1番目のプレイヤーの名前' })).toHaveValue('アオイ');
    expect(screen.getByRole('textbox', { name: '3番目のプレイヤーの名前' })).toHaveValue('チカ');
  });

  it('延長戦の告知は倍率だけで、誰が同点かは示さない', async () => {
    const user = userEvent.setup();
    let game = newGame(PLAYERS, { ...CONFIG, maxCycles: 1 });
    for (let i = 0; i < 3; i += 1) {
      game = play(
        game,
        { type: 'beginRound' },
        { type: 'openHandoff' },
        { type: 'submitHints', topic: { source: 'free', text: '富士山' }, hints: HINTS },
        { type: 'openHandoff' },
        { type: 'approveHints', farToNear: [0, 1, 2, 3, 4], shotOrder: [0, 1, 2, 3, 4] },
      );
      while (game.round?.outcome === null)
        game = play(game, { type: 'recordShot', result: 'pass' });
      game = play(game, { type: 'proceedToResult' }, { type: 'nextFromResult' });
    }
    const { current } = renderGame(game);
    expect(screen.getByRole('heading', { name: '延長戦：ダメージ2倍' })).toBeVisible();
    expect(screen.queryByText(/アオイ|ベン|チカ/)).toBeNull();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getByRole('heading', { name: '延長戦 第1ゲーム' })).toBeVisible();
    expect(screen.getByText('ダメージ2倍')).toBeVisible();
  });

  it('サドンデスの告知で参加者と観測手を示し、標的の順を登録する', async () => {
    const user = userEvent.setup();
    const four = [...PLAYERS, { id: 'd', name: 'ダン' }];
    let game = play(
      newGame(four),
      { type: 'beginRound' },
      { type: 'openHandoff' },
      { type: 'submitHints', topic: { source: 'free', text: '富士山' }, hints: HINTS },
      { type: 'openHandoff' },
      { type: 'approveHints', farToNear: [0, 1, 2, 3, 4], shotOrder: [0, 1, 2, 3, 4] },
      { type: 'startShooting', answerOrder: ['c', 'd'] },
    );
    game = { ...game, hp: { a: 700, b: 700, c: 13, d: 100 } };
    game = play(game, { type: 'recordShot', result: 'miss' }, { type: 'acknowledge' });
    const { current } = renderGame(game);

    expect(screen.getByRole('heading', { name: 'サドンデス' })).toBeVisible();
    expect(screen.getByText('アオイ、ベン')).toBeVisible();
    expect(screen.getByText('チカ')).toBeVisible();
    expectNoSecrets(current());
    await user.click(screen.getByRole('button', { name: '標的の順を決める' }));
    await user.click(screen.getByRole('button', { name: 'ベンを上へ' }));
    await user.click(screen.getByRole('button', { name: 'この順で始める' }));
    expect(screen.getByRole('heading', { name: 'サドンデス 第1ゲーム' })).toBeVisible();
    expect(current().round).toMatchObject({ targetId: 'b', spotterId: 'c', sniperIds: ['a'] });
  });
});

describe('ゲーム中のメニュー（SPEC 3.1）', () => {
  it('中断は確認してからトップへ。ゲームは残り、続きから戻れる', async () => {
    const user = userEvent.setup();
    const { router } = renderGame(newGame());
    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: '中断してトップへ' }));
    expect(screen.getByRole('dialog', { name: '試合を中断しますか？' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '中断する' }));
    expect(router.state.location.pathname).toBe('/');
    await user.click(screen.getByRole('button', { name: '続きから' }));
    expect(screen.getByRole('button', { name: '標的に端末を渡す' })).toBeVisible();
  });

  it('ゲームがなければトップへ戻す', () => {
    const { router } = renderRoute('/play');
    expect(router.state.location.pathname).toBe('/');
  });
});
