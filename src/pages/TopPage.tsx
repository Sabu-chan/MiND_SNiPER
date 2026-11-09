import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { isGameInProgress, useGameSession } from '../app/gameSession';
import { useSettings } from '../app/settings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Logo } from '../components/Logo';
import { ROUTE_PATHS } from '../routePaths';

/**
 * トップ（SPEC 3.2）。
 * 未完了のゲームが保存された状態でアプリを開いたら「続きから始める／新規ゲームを始める」を選ばせ、
 * 新規を選んだら「保存中のゲームは削除されます」と再確認する。
 */
export function TopPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    game,
    resumeGame,
    discardGame,
    resumePromptPending,
    dismissResumePrompt,
    gameDiscarded,
    dismissGameDiscarded,
  } = useGameSession();
  const { configDiscarded, dismissConfigDiscarded } = useSettings();
  const [confirmingNew, setConfirmingNew] = useState(false);
  const inProgress = isGameInProgress(game);
  const finished = game !== null && !inProgress;

  const continueGame = () => {
    resumeGame();
    navigate(ROUTE_PATHS.play);
  };

  const startNew = () => {
    if (inProgress) {
      setConfirmingNew(true);
      return;
    }
    navigate(ROUTE_PATHS.setup);
  };

  return (
    <div className="page page--top">
      <Logo />

      {gameDiscarded || configDiscarded ? (
        <div className="notice" role="status">
          {gameDiscarded ? <p>{t('top.gameDiscarded')}</p> : null}
          {configDiscarded ? <p>{t('top.configDiscarded')}</p> : null}
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              dismissGameDiscarded();
              dismissConfigDiscarded();
            }}
          >
            {t('common.close')}
          </button>
        </div>
      ) : null}

      <nav className="menu">
        <button type="button" className="btn btn--primary" onClick={startNew}>
          {t('top.newGame')}
        </button>
        {inProgress ? (
          <button type="button" className="btn" onClick={continueGame}>
            {t('top.continue')}
          </button>
        ) : null}
        {finished ? (
          <Link className="btn" to={ROUTE_PATHS.play}>
            {t('top.viewResult')}
          </Link>
        ) : null}
        <Link className="btn" to={ROUTE_PATHS.rules}>
          {t('top.rules')}
        </Link>
        <Link className="btn" to={ROUTE_PATHS.config}>
          {t('top.config')}
        </Link>
      </nav>

      {/* 起動時：続きから／新規 */}
      <ConfirmDialog
        open={resumePromptPending && !confirmingNew}
        title={t('top.resumeTitle')}
        message={t('top.resumeMessage')}
        confirmLabel={t('top.resumeContinue')}
        cancelLabel={t('top.resumeNew')}
        onConfirm={continueGame}
        onCancel={() => {
          dismissResumePrompt();
          setConfirmingNew(true);
        }}
      />

      {/* 新規ゲームの再確認 */}
      <ConfirmDialog
        open={confirmingNew}
        title={t('top.discardTitle')}
        message={t('top.discardMessage')}
        confirmLabel={t('top.discardOk')}
        danger
        onCancel={() => setConfirmingNew(false)}
        onConfirm={() => {
          setConfirmingNew(false);
          discardGame();
          navigate(ROUTE_PATHS.setup);
        }}
      />
    </div>
  );
}
