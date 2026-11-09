import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { APP_TITLE } from './constants';
import { renderRoute } from './test/renderRoute';

describe('routing', () => {
  it('トップに英字タイトルと日本語の副題を表示する', () => {
    renderRoute('/');
    // 日本語ではロゴ画像（副題入り）を表示し、文字の副題は重ねて出さない（DECISIONS D-36）
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAccessibleName(`${APP_TITLE} 連想スナイピングゲーム`);
    expect(
      screen.getByRole('img', { name: `${APP_TITLE} 連想スナイピングゲーム` }),
    ).toHaveAttribute('src', '/logo.ja.webp');
    expect(screen.queryByText('連想スナイピングゲーム')).toBeNull();
  });

  it('ロゴ画像を読み込めなければ、文字のタイトルと副題を表示する', () => {
    renderRoute('/');
    fireEvent.error(screen.getByRole('img', { name: `${APP_TITLE} 連想スナイピングゲーム` }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(APP_TITLE);
    expect(screen.getByText('連想スナイピングゲーム')).toBeInTheDocument();
  });

  it('トップからルール説明へ移り、トップへ戻れる', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    await user.click(screen.getByRole('link', { name: 'ルール説明' }));
    expect(router.state.location.pathname).toBe('/rules');
    await user.click(screen.getByRole('link', { name: 'トップへ' }));
    expect(router.state.location.pathname).toBe('/');
  });

  it('CONFIG を開ける', () => {
    renderRoute('/config');
    expect(screen.getByRole('heading', { name: 'CONFIG' })).toBeInTheDocument();
  });

  it('未知のパスでは「ページが見つかりません」を表示する', () => {
    renderRoute('/no-such-page');
    expect(screen.getByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
  });
});
