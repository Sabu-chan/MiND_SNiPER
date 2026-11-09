import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ROUTE_PATHS } from '../routePaths';

/**
 * 前の画面に戻る。ゲーム中にルール説明や CONFIG を開いた場合はゲームに戻る。
 * 履歴がなければ（直接開いた場合）トップへ。
 */
export function BackLink() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;

  if (historyIndex > 0) {
    return (
      <button type="button" className="btn" onClick={() => void navigate(-1)}>
        {t('common.back')}
      </button>
    );
  }
  return (
    <Link className="btn" to={ROUTE_PATHS.top}>
      {t('common.backToTop')}
    </Link>
  );
}
