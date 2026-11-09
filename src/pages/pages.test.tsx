import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../game/config';
import { createGame } from '../game/reducer';
import type { GameState } from '../game/state';
import { dragByKeyboard, renderRoute } from '../test/renderRoute';

const nameBox = (seat: number) =>
  screen.getByRole('textbox', { name: `${seat}番目のプレイヤーの名前` });

describe('プレイヤー登録（SPEC 3.3）', () => {
  it('人数分の名前を入れて席順を決め、ゲームを始める', async () => {
    const user = userEvent.setup();
    let game: GameState | null = null;
    const { router } = renderRoute('/new', {
      onGame: (g) => {
        game = g;
      },
    });
    await user.click(screen.getByRole('radio', { name: '3人' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    await user.type(nameBox(1), 'アオイ');
    await user.type(nameBox(2), 'ベン');
    await user.type(nameBox(3), 'チカ');
    await dragByKeyboard(user, 'チカ', -1);
    expect(nameBox(2)).toHaveValue('チカ');
    await user.click(screen.getByRole('button', { name: 'この順番で始める' }));

    expect(router.state.location.pathname).toBe('/play');
    expect((game as GameState | null)?.players.map((p) => p.name)).toEqual([
      'アオイ',
      'チカ',
      'ベン',
    ]);
    expect(screen.getByRole('button', { name: '標的に端末を渡す' })).toBeVisible();
  });

  it('空欄・重複は不可', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/new');
    await user.click(screen.getByRole('radio', { name: '3人' }));
    await user.type(nameBox(1), 'アオイ');
    await user.type(nameBox(2), 'アオイ ');
    await user.click(screen.getByRole('button', { name: 'この順番で始める' }));
    expect(screen.getAllByText('同じ名前があります')).toHaveLength(2);
    expect(screen.getByText('名前を入力してください')).toBeVisible();
    expect(router.state.location.pathname).toBe('/new');
  });

  it('前回の名前を初期入力として複製する', () => {
    renderRoute('/new', { initialPlayerNames: ['A', 'B', 'C', 'D', 'E'] });
    expect(screen.getByRole('radio', { name: '5人' })).toHaveAttribute('aria-checked', 'true');
    expect(nameBox(5)).toHaveValue('E');
  });

  it('ランダムに並べても名前の組は変わらない', async () => {
    const user = userEvent.setup();
    renderRoute('/new', { initialPlayerNames: ['A', 'B', 'C', 'D'] });
    await user.click(screen.getByRole('button', { name: 'ランダムに並べる' }));
    const names = [1, 2, 3, 4].map((i) => (nameBox(i) as HTMLInputElement).value);
    expect([...names].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('決定した時点の CONFIG をゲームに固定する', async () => {
    const user = userEvent.setup();
    let game: GameState | null = null;
    renderRoute('/new', {
      initialPlayerNames: ['A', 'B', 'C'],
      initialConfig: { ...createDefaultConfig(), maxCycles: 7 },
      onGame: (g) => {
        game = g;
      },
    });
    await user.click(screen.getByRole('button', { name: 'この順番で始める' }));
    expect((game as GameState | null)?.config.maxCycles).toBe(7);
  });
});

describe('トップ（SPEC 3.2）', () => {
  const players = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];

  it('ゲームがなければ「続きから」を出さない', () => {
    renderRoute('/');
    expect(screen.queryByRole('button', { name: '続きから' })).toBeNull();
  });

  it('進行中のゲームがあれば「続きから」を出し、新規は確認してから捨てる', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/', {
      initialGame: createGame(players, createDefaultConfig()),
    });
    expect(screen.getByRole('button', { name: '続きから' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '新規ゲーム' }));
    const dialog = screen.getByRole('dialog', { name: '新規ゲームを始めますか？' });
    expect(within(dialog).getByText('保存中のゲームは削除されます。')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(router.state.location.pathname).toBe('/');
    await user.click(screen.getByRole('button', { name: '新規ゲーム' }));
    await user.click(screen.getByRole('button', { name: '削除して始める' }));
    expect(router.state.location.pathname).toBe('/new');
  });
});
