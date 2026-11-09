import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReorderList } from '../components/ReorderList';
import { createApproveAction } from '../game/actions';
import { defaultRng } from '../game/rng';
import { must } from '../game/util';
import type { SceneProps } from './types';

interface Check {
  rejected: boolean;
  comment: string;
}

/**
 * 承認（SPEC 2.3, 3.6）：観測手だけが見る。
 * 差し戻しがあれば標的へ戻し、なければ遠い順に並べ替えて承認する。並べ替え中は各行の遠さ点を表示する。
 */
export function ReviewScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const round = must(game.round, 'round');
  const topic = must(round.topic, 'topic');
  const points = game.config.distancePoints;

  /** 上が最も遠い。初期値は標的の入力順 */
  const [order, setOrder] = useState<number[]>(() => round.hints.map((_, i) => i));
  const [checks, setChecks] = useState<Check[]>(() =>
    round.hints.map(() => ({ rejected: false, comment: '' })),
  );
  const anyRejected = checks.some((c) => c.rejected);

  const updateCheck = (index: number, patch: Partial<Check>) =>
    setChecks(checks.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const reject = () =>
    dispatch({
      type: 'rejectHints',
      rejections: checks.flatMap((c, hintIndex) =>
        c.rejected ? [{ hintIndex, comment: c.comment.trim() || null }] : [],
      ),
    });

  const approve = () => dispatch(createApproveAction(game, order, defaultRng));

  return (
    <section className="scene">
      <p className="scene__eyebrow">{t('roles.spotter')}</p>
      <h1 className="scene__title">{t('review.title')}</h1>

      <div className="card">
        <p className="card__label">
          {t('compose.topic')}
          {topic.categoryLabel ? `（${topic.categoryLabel}）` : ''}
        </p>
        <p className="topic">{topic.text}</p>
        {topic.reading ? <p className="topic__reading">{topic.reading}</p> : null}
        <p className="hint-text">{t('review.genre', { genre: t(`genres.${topic.genre}`) })}</p>
      </div>

      <p className="hint-text">{t('review.help')}</p>

      <ReorderList
        items={order}
        getKey={(i) => String(i)}
        getLabel={(i) => must(round.hints[i], 'hint')}
        onChange={setOrder}
        renderItem={(hintIndex, rank) => (
          <div className="review-row">
            <span className="points" aria-label={t('review.pointsLabel', { points: points[rank] })}>
              {t('review.points', { points: points[rank] })}
            </span>
            <span className="review-row__hint">{round.hints[hintIndex]}</span>
          </div>
        )}
        renderDetail={(hintIndex) => {
          const check = must(checks[hintIndex], 'check');
          return (
            <div className="review-row__check">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={check.rejected}
                  onChange={(e) => updateCheck(hintIndex, { rejected: e.target.checked })}
                />
                {t('review.reject')}
              </label>
              {check.rejected ? (
                <input
                  className="input input--small"
                  value={check.comment}
                  maxLength={60}
                  placeholder={t('review.commentPlaceholder')}
                  aria-label={t('review.commentLabel', { hint: round.hints[hintIndex] })}
                  onChange={(e) => updateCheck(hintIndex, { comment: e.target.value })}
                />
              ) : null}
            </div>
          );
        }}
      />

      <div className="actions">
        {anyRejected ? (
          <button type="button" className="btn btn--primary" onClick={reject}>
            {t('review.sendBack')}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={approve}>
            {t('review.approve')}
          </button>
        )}
      </div>
    </section>
  );
}
