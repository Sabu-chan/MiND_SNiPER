import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../game/config';
import { createGame, gameReducer, type GameAction } from '../game/reducer';
import type { GameState } from '../game/state';
import { HpChart } from './HpChart';

const players = [
  { id: 'a', name: 'アオイ' },
  { id: 'b', name: 'ベン' },
  { id: 'c', name: 'チカ' },
];
const HINTS = ['山', '静岡', '日本一', '世界遺産', '富士宮'];

/** 2ラウンド遊んだ状態：1ラウンド目は1射目に命中（アオイ −60）、2ラウンド目は逃げ切り（ベン +20） */
function twoRounds(): GameState {
  const setup: GameAction[] = [
    { type: 'beginRound' },
    { type: 'openHandoff' },
    { type: 'submitHints', topic: { source: 'free', text: 'お題' }, hints: HINTS },
    { type: 'openHandoff' },
    { type: 'approveHints', farToNear: [0, 1, 2, 3, 4], shotOrder: [0, 1, 2, 3, 4] },
  ];
  let s = [...setup, { type: 'recordShot', result: 'hit' } as const].reduce(
    gameReducer,
    createGame(players, createDefaultConfig()),
  );
  s = [{ type: 'proceedToResult' } as const, { type: 'nextFromResult' } as const, ...setup].reduce(
    gameReducer,
    s,
  );
  while (s.round?.outcome === null) s = gameReducer(s, { type: 'recordShot', result: 'pass' });
  return gameReducer(s, { type: 'proceedToResult' });
}

describe('HpChart（SPEC 3.10）', () => {
  it('プレイヤーごとに折れ線を1本引き、凡例を出す', () => {
    const { container } = render(<HpChart game={twoRounds()} />);
    expect(container.querySelectorAll('.hp-chart__line')).toHaveLength(3);
    const legend = container.querySelector('.hp-chart__legend') as HTMLElement;
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['アオイ', 'ベン', 'チカ']);
    // 開始＋2ラウンド＝3点
    const firstPath = container.querySelector('.hp-chart__line')?.getAttribute('d') ?? '';
    expect(firstPath.split(/[ML]/).filter(Boolean)).toHaveLength(3);
    expect(screen.getByRole('img', { name: 'HP推移' })).toBeInTheDocument();
  });

  it('表でも同じ値を見られる', () => {
    render(<HpChart game={twoRounds()} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'アオイベンチカ',
      '開始100100100',
      'G140100100',
      'G240120100',
    ]);
  });

  it('キーボードの矢印でラウンドを選ぶと、そのときの全員のHPを表示する', async () => {
    const user = userEvent.setup();
    render(<HpChart game={twoRounds()} />);
    const svg = screen.getByRole('img', { name: 'HP推移' });
    svg.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('第1ラウンド（全3ラウンド） 第1ゲーム');
    // HPの多い順
    expect(
      within(tooltip)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['ベン100', 'チカ100', 'アオイ40']);
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
