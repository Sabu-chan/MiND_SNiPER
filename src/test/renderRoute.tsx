import { act, fireEvent, render } from '@testing-library/react';
import { expect } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders, type AppProvidersProps } from '../app/AppProviders';
import { useGameSession } from '../app/gameSession';
import type { GameState } from '../game/state';
import { routes } from '../routes';

/** 辞書を読み込まない（テストの既定） */
const noDictionaries = () => Promise.resolve({ value: [], warnings: [] });

export interface RenderRouteOptions extends Omit<AppProvidersProps, 'children'> {
  /** 現在のゲーム状態を受け取る（秘匿の検査用） */
  onGame?: (game: GameState | null) => void;
}

function GameProbe({ onGame }: { onGame: (game: GameState | null) => void }) {
  onGame(useGameSession().game);
  return null;
}

/** 指定したパスでアプリのルーティングを描画する（テスト用） */
export function renderRoute(path: string, { onGame, ...options }: RenderRouteOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <AppProviders loadDictionaries={noDictionaries} {...options}>
        <RouterProvider router={router} />
        {onGame ? <GameProbe onGame={onGame} /> : null}
      </AppProviders>,
    ),
  };
}

/** 長押しボタンを指定時間押し続けて離す（実時間で待つ） */
export async function holdButton(button: HTMLElement, ms: number): Promise<void> {
  fireEvent.pointerDown(button, { pointerId: 1 });
  await act(() => new Promise((resolve) => setTimeout(resolve, ms + 50)));
  fireEvent.pointerUp(button, { pointerId: 1 });
}

/**
 * 画面に秘密情報（HP・遠さ点・ダメージ量・回復量）の数値が出ていないことを確かめる（SPEC 2.6, 7章）。
 * 秘密の値と画面の数字が偶然重ならないよう、テストでは2桁以上の特徴的な値の CONFIG を使う。
 */
export function expectNoSecrets(game: GameState, root: HTMLElement = document.body): void {
  const secrets = new Set<number>([
    game.config.startHp,
    game.config.maxHp,
    game.config.missDamage,
    game.config.escapeHeal,
    ...game.config.distancePoints,
    ...Object.values(game.hp),
  ]);
  for (const record of [...game.records, ...(game.round ? [game.round] : [])]) {
    for (const e of record.events) if (e.kind !== 'pass') secrets.add(e.damage).add(e.applied);
  }
  const numbers = (root.textContent ?? '').match(/\d+/g)?.map(Number) ?? [];
  expect(numbers.filter((n) => n >= 10 && secrets.has(n))).toEqual([]);
}
