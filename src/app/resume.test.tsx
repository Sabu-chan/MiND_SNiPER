import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../game/config';
import { createGame, gameReducer, type GameAction } from '../game/reducer';
import type { GameState } from '../game/state';
import { memoryStorage } from '../test/memoryStorage';
import { renderRoute } from '../test/renderRoute';
import { loadGame, saveGame, STORAGE_KEYS } from './storage';

const players = [
  { id: 'a', name: 'アオイ' },
  { id: 'b', name: 'ベン' },
  { id: 'c', name: 'チカ' },
];

function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

/** 標的が出題中の状態 */
function composing(): GameState {
  return play(
    createGame(players, createDefaultConfig()),
    { type: 'beginRound' },
    {
      type: 'openHandoff',
    },
  );
}

describe('途中保存と再開（SPEC 3.2, 5.2）', () => {
  it('操作のたびに保存する', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderRoute('/play', { storage, initialGame: createGame(players, createDefaultConfig()) });
    expect(loadGame(storage)).toMatchObject({
      status: 'ok',
      value: { scene: { type: 'roundIntro' } },
    });
    await user.click(screen.getByRole('button', { name: '標的に端末を渡す' }));
    expect(loadGame(storage)).toMatchObject({
      status: 'ok',
      value: { scene: { type: 'handoff' } },
    });
  });

  it('未完了のゲームがあれば起動時に選ばせ、続きからは受け渡し画面から再開する', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveGame(storage, composing());
    const { router } = renderRoute('/', { storage });

    const dialog = screen.getByRole('dialog', { name: '続きから始めますか？' });
    await user.click(within(dialog).getByRole('button', { name: '続きから始める' }));
    expect(router.state.location.pathname).toBe('/play');
    // 出題画面（秘密情報）に直接戻らず、標的への受け渡し画面から
    expect(screen.getByText('アオイさん（標的）に端末を渡してください')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '正解とヒントを決める' })).toBeNull();
  });

  it('新規を選ぶと「保存中のゲームは削除されます」と再確認してから削除する', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveGame(storage, composing());
    const { router } = renderRoute('/', { storage });

    await user.click(screen.getByRole('button', { name: '新規ゲームを始める' }));
    const confirm = screen.getByRole('dialog', { name: '新規ゲームを始めますか？' });
    expect(within(confirm).getByText('保存中のゲームは削除されます。')).toBeVisible();
    await user.click(within(confirm).getByRole('button', { name: 'キャンセル' }));
    // 取り消したらゲームは残り、「続きから」で戻れる
    expect(storage.getItem(STORAGE_KEYS.game)).not.toBeNull();
    expect(screen.getByRole('button', { name: '続きから' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '新規ゲーム' }));
    await user.click(screen.getByRole('button', { name: '削除して始める' }));
    expect(router.state.location.pathname).toBe('/new');
    expect(storage.getItem(STORAGE_KEYS.game)).toBeNull();
  });

  it('前回のプレイヤー名を保存し、次に開いたときの初期入力にする', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const first = renderRoute('/new', { storage });
    await user.click(screen.getByRole('radio', { name: '3人' }));
    for (const [i, name] of ['アオイ', 'ベン', 'チカ'].entries()) {
      await user.type(
        screen.getByRole('textbox', { name: `${i + 1}番目のプレイヤーの名前` }),
        name,
      );
    }
    await user.click(screen.getByRole('button', { name: 'この順番で始める' }));
    first.unmount();

    renderRoute('/new', { storage });
    expect(screen.getByRole('textbox', { name: '2番目のプレイヤーの名前' })).toHaveValue('ベン');
  });

  it('ゲーム画面を直接開いた場合も受け渡し画面から再開し、起動時の選択は出さない', async () => {
    const storage = memoryStorage();
    saveGame(storage, composing());
    const { router } = renderRoute('/play', { storage });
    expect(screen.getByText('アオイさん（標的）に端末を渡してください')).toBeVisible();
    await router.navigate('/');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('終了したゲームでは選択を出さず、「前回の結果を見る」を出す', () => {
    const storage = memoryStorage();
    const finished: GameState = {
      ...composing(),
      scene: { type: 'finished' },
      result: { winnerIds: ['a'], draw: false, standings: [] },
    };
    saveGame(storage, finished);
    renderRoute('/', { storage });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: '前回の結果を見る' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '続きから' })).toBeNull();
  });

  it('読めない古いデータは破棄し、その旨を表示する', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEYS.game, JSON.stringify({ schemaVersion: 0 }));
    storage.setItem(
      STORAGE_KEYS.config,
      JSON.stringify({ schemaVersion: 1, config: { startHp: 1 } }),
    );
    renderRoute('/', { storage });
    expect(
      screen.getByText(/保存されていたゲームは古い形式のため読み込めませんでした/),
    ).toBeVisible();
    expect(screen.getByText(/CONFIG を読み込めなかったため/)).toBeVisible();
    expect(storage.getItem(STORAGE_KEYS.game)).toBeNull();
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
