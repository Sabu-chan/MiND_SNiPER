import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReorderList } from '../components/ReorderList';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/**
 * 狙撃手の回答順の登録（SPEC 2.4, 3.6-4）。ジャンケンの結果を並べ替えで入力する。
 * この画面には秘密情報を表示しない。
 */
export function AnswerOrderScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const round = must(game.round, 'round');
  const name = nameOf(game);
  const [order, setOrder] = useState(round.sniperIds);

  return (
    <section className="scene">
      <p className="scene__eyebrow">{t('roles.spotter')}</p>
      <h1 className="scene__title">{t('answerOrder.title')}</h1>
      <p className="hint-text">{t('answerOrder.help')}</p>
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
          onClick={() => dispatch({ type: 'startShooting', answerOrder: order })}
        >
          {t('answerOrder.start')}
        </button>
      </div>
    </section>
  );
}
