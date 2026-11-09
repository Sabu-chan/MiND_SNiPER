import { useTranslation } from 'react-i18next';
import { BackLink } from '../components/BackLink';

/** 段階4で本文を実装する */
export function RulesPage() {
  const { t } = useTranslation();
  return (
    <div className="page">
      <h1>{t('rules.title')}</h1>
      <p>{t('common.comingSoon')}</p>
      <BackLink />
    </div>
  );
}
