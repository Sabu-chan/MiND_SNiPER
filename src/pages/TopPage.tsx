import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { ROUTE_PATHS } from '../routePaths';

/** 段階1では仮置き。新規ゲームと続きからは段階3・4で実装する。 */
export function TopPage() {
  const { t } = useTranslation();
  return (
    <div className="page page--top">
      <Logo />
      <nav className="menu">
        <button type="button" className="btn btn--primary" disabled>
          {t('top.newGame')}
        </button>
        <Link className="btn" to={ROUTE_PATHS.rules}>
          {t('top.rules')}
        </Link>
        <Link className="btn" to={ROUTE_PATHS.config}>
          {t('top.config')}
        </Link>
      </nav>
    </div>
  );
}
