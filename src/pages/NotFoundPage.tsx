import { useTranslation } from 'react-i18next';
import { BackLink } from '../components/BackLink';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="page">
      <h1>{t('notFound.title')}</h1>
      <BackLink />
    </div>
  );
}
