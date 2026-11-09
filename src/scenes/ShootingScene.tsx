import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HoldButton } from '../components/HoldButton';
import { hintCountOf } from '../game/config';
import {
  answerHistory,
  canScoutGenre,
  canUndo,
  currentSniperId,
  hasGenreScout,
  revealedGenre,
  revealedHints,
} from '../game/selectors';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/**
 * 射撃（SPEC 2.4, 3.7）：観測手が操作し、全員に見せる。
 * ヒントの距離点・HP・ダメージ量は表示しない。演出もそれらで変えない（SPEC 7章）。
 * ジャンル偵察のボタン・偵察結果・持っている印もここに出す（DECISIONS D-33）。
 */
export function ShootingScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const round = must(game.round, 'round');
  const name = nameOf(game);
  const total = hintCountOf(game.config);
  const sniperId = currentSniperId(game);
  const hints = revealedHints(game);
  const answers = answerHistory(game);
  const answerOrder = round.answerOrder ?? round.sniperIds;
  const genre = revealedGenre(game);

  const [confirmingHit, setConfirmingHit] = useState(false);
  const [confirmingScout, setConfirmingScout] = useState(false);
  const [missMemo, setMissMemo] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);

  const recordMiss = () => {
    dispatch({ type: 'recordShot', result: 'miss', memo: missMemo ?? '' });
    setMissMemo(null);
  };

  return (
    <section className="scene scene--shooting">
      <div className="shot-counter" aria-live="polite">
        <span className="shot-counter__label">{t('shooting.shot')}</span>
        <span className="shot-counter__value">
          {t('shooting.shotOf', { current: round.shot + 1, total })}
        </span>
      </div>

      {genre ? (
        <p className="scout-result" role="status">
          <span aria-hidden="true">🔍</span>{' '}
          {t('shooting.scoutResult', { genre: t(`genres.${genre}`) })}
        </p>
      ) : null}

      <ol className="revealed-hints" aria-label={t('shooting.revealed')}>
        {hints.map((hint, index) => (
          <li
            key={index}
            className={`revealed-hint ${index === hints.length - 1 ? 'revealed-hint--latest' : ''}`}
          >
            <span className="revealed-hint__number">{index + 1}</span>
            <span className="revealed-hint__text">{hint}</span>
          </li>
        ))}
      </ol>

      {round.outcome ? (
        <div className="outcome" role="status">
          {round.outcome.kind === 'hit' ? (
            <>
              <p className="outcome__title">{t('shooting.hitTitle')}</p>
              <p>
                {t('shooting.hitMessage', {
                  name: name(round.outcome.sniperId),
                  shot: round.outcome.shot + 1,
                })}
              </p>
            </>
          ) : (
            <>
              <p className="outcome__title">{t('shooting.escapedTitle')}</p>
              <p>{t('shooting.escapedMessage', { name: name(round.targetId) })}</p>
            </>
          )}
        </div>
      ) : sniperId ? (
        <div className="current-sniper" aria-live="polite">
          <p className="current-sniper__label">{t('shooting.answering')}</p>
          <p className="current-sniper__name">{t('common.nameSuffix', { name: name(sniperId) })}</p>
        </div>
      ) : null}

      <ul className="snipers" aria-label={t('shooting.answerHistory')}>
        {answerOrder.map((id) => {
          const list = answers[id] ?? [];
          return (
            <li key={id} className={`sniper ${id === sniperId ? 'sniper--current' : ''}`}>
              <span className="sniper__name">
                {name(id)}
                {hasGenreScout(game, id) ? (
                  <span className="sniper__scout" role="img" aria-label={t('shooting.hasScout')}>
                    🔍
                  </span>
                ) : null}
              </span>
              {list.length > 0 ? (
                <span className="sniper__answers">
                  {list.map((a) => (
                    <span key={a.shot} className={`sniper__answer sniper__answer--${a.kind}`}>
                      {a.kind === 'pass'
                        ? t('shooting.passLog', { shot: a.shot + 1 })
                        : a.memo
                          ? t('shooting.missLogWithMemo', { shot: a.shot + 1, memo: a.memo })
                          : t('shooting.missLog', { shot: a.shot + 1 })}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="sniper__answers sniper__answers--none">
                  {t('shooting.noAnswer')}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="actions">
        {round.outcome ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => dispatch({ type: 'proceedToResult' })}
          >
            {t('shooting.toResult')}
          </button>
        ) : missMemo !== null ? (
          <div className="miss-memo">
            <label className="field">
              <span className="field__label">
                {t('shooting.memoLabel', { name: sniperId ? name(sniperId) : '' })}
              </span>
              <input
                className="input"
                value={missMemo}
                maxLength={40}
                placeholder={t('shooting.memoPlaceholder')}
                onChange={(e) => setMissMemo(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button type="button" className="btn" onClick={() => setMissMemo(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--primary" onClick={recordMiss}>
                {t('shooting.recordMiss')}
              </button>
            </div>
          </div>
        ) : (
          <div className="shot-buttons">
            <button type="button" className="btn btn--hit" onClick={() => setConfirmingHit(true)}>
              {t('shooting.hit')}
            </button>
            <button type="button" className="btn btn--miss" onClick={() => setMissMemo('')}>
              {t('shooting.missButton')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'recordShot', result: 'pass' })}
            >
              {t('shooting.pass')}
            </button>
            <button
              type="button"
              className="btn btn--scout"
              disabled={!canScoutGenre(game)}
              onClick={() => setConfirmingScout(true)}
            >
              <span aria-hidden="true">🔍</span> {t('shooting.scout')}
            </button>
          </div>
        )}

        <div className="button-row">
          <button
            type="button"
            className="btn btn--small"
            disabled={!canUndo(game)}
            onClick={() => dispatch({ type: 'undo' })}
          >
            {t('shooting.undo')}
          </button>
          <HoldButton
            className="btn--small"
            durationMs={game.config.holdDurationMs}
            onComplete={() => setPeeking(true)}
            onRelease={() => setPeeking(false)}
          >
            {peeking ? must(round.topic, 'topic').text : t('shooting.peek')}
          </HoldButton>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingScout}
        title={t('shooting.scoutTitle', { name: sniperId ? name(sniperId) : '' })}
        message={t('shooting.scoutMessage', { damage: game.config.genreScoutDamage })}
        confirmLabel={t('shooting.scoutOk')}
        danger
        onCancel={() => setConfirmingScout(false)}
        onConfirm={() => {
          setConfirmingScout(false);
          dispatch({ type: 'scoutGenre' });
        }}
      />
      <ConfirmDialog
        open={confirmingHit}
        title={t('shooting.hitConfirmTitle')}
        message={t('shooting.hitConfirmMessage', { name: sniperId ? name(sniperId) : '' })}
        confirmLabel={t('shooting.hit')}
        onCancel={() => setConfirmingHit(false)}
        onConfirm={() => {
          setConfirmingHit(false);
          dispatch({ type: 'recordShot', result: 'hit' });
        }}
      />
    </section>
  );
}
