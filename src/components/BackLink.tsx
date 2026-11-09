import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ROUTE_PATHS } from '../routePaths';

export function BackLink() {
  const { t } = useTranslation();
  return (
    <Link className="btn" to={ROUTE_PATHS.top}>
      {t('common.backToTop')}
    </Link>
  );
}
