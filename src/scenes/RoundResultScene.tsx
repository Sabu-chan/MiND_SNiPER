import { useTranslation } from 'react-i18next';
import { lastRecord } from '../game/selectors';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/**
 * ターン結果（SPEC 2.6, 3.8）：正解、命中（狙撃手名と射番号）または逃げ切りまで。数値は表示しない。
 */
export function RoundResultScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const record = must(lastRecord(game), 'last record');
  const topic = must(record.topic, 'topic');
  const name = nameOf(game);
  const outcome = must(record.outcome, 'outcome');

  return (
    <section className="scene">
      <p className="scene__eyebrow">{t('result.title')}</p>
      <div className="card">
        <p className="card__label">{t('compose.topic')}</p>
        <p className="topic">{topic.text}</p>
        {topic.reading ? <p className="topic__reading">{topic.reading}</p> : null}
      </div>
      <div className="outcome">
        {outcome.kind === 'hit' ? (
          <>
            <p className="outcome__title">{t('shooting.hitTitle')}</p>
            <p>
              {t('shooting.hitMessage', { name: name(outcome.sniperId), shot: outcome.shot + 1 })}
            </p>
          </>
        ) : (
          <>
            <p className="outcome__title">{t('shooting.escapedTitle')}</p>
            <p>{t('shooting.escapedMessage', { name: name(record.targetId) })}</p>
          </>
        )}
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'nextFromResult' })}
        >
          {t('common.next')}
        </button>
      </div>
    </section>
  );
}
