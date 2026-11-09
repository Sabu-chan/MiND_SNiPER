import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDictionaries } from '../app/dictionaries';
import { createDrawTopicAction, exclusionsOf } from '../game/actions';
import { hintCountOf } from '../game/config';
import { buildPool, countAvailable } from '../game/dictionary';
import { hasHintIssues, validateHints, type HintIssue } from '../game/hints';
import { defaultRng } from '../game/rng';
import { remainingDraws, remainingRerolls } from '../game/selectors';
import { isBlank } from '../game/text';
import { must } from '../game/util';
import type { SceneProps } from './types';

type Mode = 'free' | 'random';

/** 出題（SPEC 2.2, 2.3, 3.5）：標的だけが見る */
export function ComposeScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const round = must(game.round, 'round');
  const hintCount = hintCountOf(game.config);
  const revision = round.rejections !== null;
  const rejected = new Map((round.rejections ?? []).map((r) => [r.hintIndex, r.comment]));

  const { dictionaries } = useDictionaries();
  const pool = useMemo(
    () => buildPool(dictionaries, game.config.language, game.config.disabledCategoryIds),
    [dictionaries, game.config.language, game.config.disabledCategoryIds],
  );
  const available = countAvailable(pool, exclusionsOf(game));
  // 辞書が1件もないときは任意出題のみ（SPEC 2.2）
  const randomEnabled = round.drawnEntry !== null || available > 0;

  const [mode, setMode] = useState<Mode>(round.drawnEntry ? 'random' : 'free');
  const [topicText, setTopicText] = useState('');
  // 差し戻し後は前回の内容を初期値にして、差し戻されたヒントだけを編集させる
  const [hints, setHints] = useState<string[]>(() =>
    revision ? [...round.hints] : Array.from({ length: hintCount }, () => ''),
  );
  const [submitted, setSubmitted] = useState(false);

  const topic = revision
    ? must(round.topic, 'topic').text
    : mode === 'free'
      ? topicText
      : (round.drawnEntry?.word ?? '');
  const topicMissing = !revision && (mode === 'free' ? isBlank(topicText) : !round.drawnEntry);
  const hintIssues = validateHints(hints, topic);

  const draw = () => {
    const action = createDrawTopicAction(game, pool, defaultRng);
    if (action) dispatch(action);
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    // ランダム出題を選んだら、まだ抽選していなければすぐに抽選する（1回目は引き直しに数えない）
    if (next === 'random' && !round.drawnEntry) draw();
  };

  const submit = () => {
    setSubmitted(true);
    if (topicMissing || hasHintIssues(hintIssues)) return;
    dispatch({
      type: 'submitHints',
      topic:
        revision || mode === 'free'
          ? { source: 'free', text: revision ? topic : topicText }
          : { source: 'random' },
      hints,
    });
  };

  return (
    <section className="scene">
      <p className="scene__eyebrow">{t('roles.target')}</p>
      <h1 className="scene__title">{revision ? t('compose.revisionTitle') : t('compose.title')}</h1>

      {revision ? (
        <div className="card">
          <p className="card__label">{t('compose.topic')}</p>
          <p className="topic">{topic}</p>
        </div>
      ) : (
        <fieldset className="field">
          <legend className="field__label">{t('compose.mode')}</legend>
          <div className="segmented" role="radiogroup">
            {(['free', 'random'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                disabled={m === 'random' && !randomEnabled}
                className={`segmented__item ${mode === m ? 'segmented__item--active' : ''}`}
                onClick={() => chooseMode(m)}
              >
                {t(`compose.modes.${m}`)}
              </button>
            ))}
          </div>
          {!randomEnabled ? <p className="hint-text">{t('compose.noDictionary')}</p> : null}

          {mode === 'free' ? (
            <label className="field">
              <span className="field__label">{t('compose.topic')}</span>
              <input
                className={`input ${submitted && topicMissing ? 'input--error' : ''}`}
                value={topicText}
                maxLength={40}
                placeholder={t('compose.topicPlaceholder')}
                onChange={(e) => setTopicText(e.target.value)}
              />
              <span className="hint-text">{t('compose.topicHelp')}</span>
              {submitted && topicMissing ? (
                <span className="error-text">{t('compose.errors.topicEmpty')}</span>
              ) : null}
            </label>
          ) : (
            <div className="card">
              {round.drawnEntry ? (
                <>
                  <p className="card__label">{round.drawnEntry.categoryLabel}</p>
                  <p className="topic">{round.drawnEntry.word}</p>
                  {round.drawnEntry.reading ? (
                    <p className="topic__reading">{round.drawnEntry.reading}</p>
                  ) : null}
                </>
              ) : (
                <p className="hint-text">{t('compose.noMoreWords')}</p>
              )}
              <button
                type="button"
                className="btn btn--small"
                disabled={remainingDraws(game) <= 0 || available === 0}
                onClick={draw}
              >
                {t('compose.reroll', { count: remainingRerolls(game) })}
              </button>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="field">
        <legend className="field__label">{t('compose.hints', { count: hintCount })}</legend>
        <p className="hint-text">{t('compose.hintsHelp')}</p>
        <ol className="hint-inputs">
          {hints.map((hint, index) => {
            const locked = revision && !rejected.has(index);
            const issue: HintIssue | null = submitted ? (hintIssues[index] ?? null) : null;
            const comment = rejected.get(index);
            return (
              <li key={index} className={`hint-input ${locked ? 'hint-input--locked' : ''}`}>
                {locked ? (
                  <p className="hint-input__text">{hint}</p>
                ) : (
                  <>
                    <input
                      className={`input ${issue ? 'input--error' : ''}`}
                      value={hint}
                      maxLength={40}
                      aria-label={t('compose.hintLabel', { number: index + 1 })}
                      aria-invalid={issue ? true : undefined}
                      onChange={(e) =>
                        setHints(hints.map((h, i) => (i === index ? e.target.value : h)))
                      }
                    />
                    {revision ? (
                      <p className="rejection-note">
                        {comment
                          ? t('compose.rejectedWithComment', { comment })
                          : t('compose.rejected')}
                      </p>
                    ) : null}
                    {issue ? (
                      <span className="error-text">{t(`compose.errors.${issue}`)}</span>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </fieldset>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={submit}>
          {t('compose.submit')}
        </button>
      </div>
    </section>
  );
}
