import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { GameState } from '../game/state';
import { ROUTE_PATHS } from '../routePaths';
import { ConfirmDialog } from './ConfirmDialog';
import { RoundLabelText } from './RoundLabelText';

/**
 * ゲーム中の見出しとメニュー。メニューにはルール説明・CONFIG・中断を置く（SPEC 3.1, 3.11, 3.12）。
 * ここには秘密情報を出さない。
 */
export function GameHeader({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const finished = game.scene.type === 'finished';

  return (
    <header className="game-header">
      <div className="game-header__label">
        {game.round && !finished ? (
          <RoundLabelText label={game.round.label} maxCycles={game.config.maxCycles} />
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn--small"
        aria-expanded={menuOpen}
        aria-controls="game-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {t('game.menu')}
      </button>
      {menuOpen ? (
        <nav id="game-menu" className="game-menu">
          <Link className="btn" to={ROUTE_PATHS.rules}>
            {t('game.rules')}
          </Link>
          <Link className="btn" to={ROUTE_PATHS.config}>
            {t('game.config')}
          </Link>
          {finished ? (
            <Link className="btn" to={ROUTE_PATHS.top}>
              {t('common.backToTop')}
            </Link>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmQuit(true)}>
              {t('game.quit')}
            </button>
          )}
        </nav>
      ) : null}
      <ConfirmDialog
        open={confirmQuit}
        title={t('game.quitTitle')}
        message={t('game.quitMessage')}
        confirmLabel={t('game.quitOk')}
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => navigate(ROUTE_PATHS.top)}
      />
    </header>
  );
}
