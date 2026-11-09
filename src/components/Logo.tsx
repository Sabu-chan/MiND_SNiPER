import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_TITLE, LOGO_IMAGE } from '../constants';

/**
 * タイトルロゴ（DECISIONS D-36）。ロゴ画像は全言語で共通（日本語の副題入り）。
 * 画像を読み込めなかったときは、文字の英字タイトルと副題を表示する。
 * 言語ごとのゲームタイトルはトップ下部の表記（TopFooter）に出す。
 */
export function Logo() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <header className="logo">
        <h1 className="logo__title">
          <img
            className="logo__image"
            src={LOGO_IMAGE.src}
            width={LOGO_IMAGE.width}
            height={LOGO_IMAGE.height}
            alt={t('app.logoAlt')}
            decoding="async"
            onError={() => setFailed(true)}
          />
        </h1>
      </header>
    );
  }

  return (
    <header className="logo">
      <h1 className="logo__title">{APP_TITLE}</h1>
      <p className="logo__subtitle">{t('app.subtitle')}</p>
    </header>
  );
}
