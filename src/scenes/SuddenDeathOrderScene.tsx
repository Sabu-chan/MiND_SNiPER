import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReorderList } from '../components/ReorderList';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/** サドンデスの標的の順の登録（SPEC 2.7, 3.9）。ジャンケンの結果を並べ替えで入力する。HPは示さない */
export function SuddenDeathOrderScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const sd = must(game.suddenDeath, 'sudden death');
  const name = nameOf(game);
  const [order, setOrder] = useState(sd.participantIds);

  return (
    <section className="scene">
      <p className="scene__eyebrow">
        {t('roles.spotter')}：{name(sd.spotterId)}
      </p>
      <h1 className="scene__title">{t('sdOrder.title')}</h1>
      <p className="hint-text">{t('sdOrder.help')}</p>
      <ReorderList
        items={order}
        getKey={(id) => id}
        getLabel={name}
        onChange={setOrder}
        renderItem={(id, index) => (
          <span className="order-row">
            <span className="order-row__number">{index + 1}</span>
            {name(id)}
          </span>
        )}
      />
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'setSuddenDeathOrder', targetOrder: order })}
        >
          {t('sdOrder.start')}
        </button>
      </div>
    </section>
  );
}
