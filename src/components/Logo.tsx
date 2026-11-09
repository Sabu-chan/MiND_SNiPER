import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_TITLE } from '../constants';

/**
 * 言語ごとのロゴ画像（public/ 配下。DECISIONS D-36）。
 * 日本語のロゴは副題「連想スナイピングゲーム」を含むので、画像を出すときは文字の副題を出さない。
 * 画像のない言語、または読み込めなかったときは、文字のタイトルと副題を表示する。
 */
const LOGO_IMAGES: Readonly<Record<string, { src: string; width: number; height: number }>> = {
  ja: { src: '/logo.ja.webp', width: 1200, height: 329 },
};

export function Logo() {
  const { t, i18n } = useTranslation();
  const [failed, setFailed] = useState(false);
  const image = LOGO_IMAGES[i18n.language];
  const label = `${APP_TITLE} ${t('app.subtitle')}`;

  if (image && !failed) {
    return (
      <header className="logo">
        <h1 className="logo__title">
          <img
            className="logo__image"
            src={image.src}
            width={image.width}
            height={image.height}
            alt={label}
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
