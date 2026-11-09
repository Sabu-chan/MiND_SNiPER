import { useTranslation } from 'react-i18next';
import { BackLink } from '../components/BackLink';

/** 段階4で設定項目を実装する */
export function ConfigPage() {
  const { t } = useTranslation();
  return (
    <div className="page">
      <h1>{t('config.title')}</h1>
      <p>{t('common.comingSoon')}</p>
      <BackLink />
    </div>
  );
}
