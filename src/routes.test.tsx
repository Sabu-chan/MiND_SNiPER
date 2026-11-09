import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { APP_TITLE } from './constants';
import { renderRoute } from './test/renderRoute';

describe('routing', () => {
  it('トップに英字タイトルと日本語の副題を表示する', () => {
    renderRoute('/');
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
