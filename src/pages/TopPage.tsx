import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { isGameInProgress, useGameSession } from '../app/gameSession';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Logo } from '../components/Logo';
import { ROUTE_PATHS } from '../routePaths';

/** トップ（SPEC 3.2）。起動時の「続きから／新規」ダイアログと保存は段階4で実装する。 */
export function TopPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { game, discardGame } = useGameSession();
  const [confirmingNew, setConfirmingNew] = useState(false);
  const inProgress = isGameInProgress(game);
  const finished = game !== null && !inProgress;

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
      <nav className="menu">
        <button type="button" className="btn btn--primary" onClick={startNew}>
          {t('top.newGame')}
        </button>
        {inProgress ? (
          <Link className="btn" to={ROUTE_PATHS.play}>
            {t('top.continue')}
          </Link>
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
      <ConfirmDialog
        open={confirmingNew}
        title={t('top.discardTitle')}
        message={t('top.discardMessage')}
        confirmLabel={t('top.discardOk')}
        danger
        onCancel={() => setConfirmingNew(false)}
        onConfirm={() => {
          discardGame();
          navigate(ROUTE_PATHS.setup);
        }}
      />
    </div>
  );
}
