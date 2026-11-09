import { useTranslation } from 'react-i18next';
import { APP_TITLE } from '../constants';

export function Logo() {
  const { t } = useTranslation();
  return (
    <header className="logo">
      <h1 className="logo__title">{APP_TITLE}</h1>
      <p className="logo__subtitle">{t('app.subtitle')}</p>
    </header>
  );
}
