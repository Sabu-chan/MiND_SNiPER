import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useGameSession } from '../app/gameSession';
import { useSettings } from '../app/settings';
import { BackLink } from '../components/BackLink';
import { ReorderList } from '../components/ReorderList';
import { PLAYER_COUNT, validatePlayerNames } from '../game/players';
import { defaultRng, shuffle } from '../game/rng';
import { newId } from '../newId';
import { ROUTE_PATHS } from '../routePaths';

interface Row {
  key: string;
  name: string;
}

const COUNTS = Array.from(
  { length: PLAYER_COUNT.max - PLAYER_COUNT.min + 1 },
  (_, i) => PLAYER_COUNT.min + i,
);

/** 前回の名前を初期入力として複製する（SPEC 3.3）。足りない分は空欄 */
function initialRows(names: readonly string[]): Row[] {
  return Array.from({ length: PLAYER_COUNT.max }, (_, i) => ({
    key: newId(),
    name: names[i] ?? '',
  }));
}

/** プレイヤー登録（SPEC 3.3） */
export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useSettings();
  const { lastPlayerNames, startGame } = useGameSession();
  const [count, setCount] = useState(() =>
    lastPlayerNames.length >= PLAYER_COUNT.min && lastPlayerNames.length <= PLAYER_COUNT.max
      ? lastPlayerNames.length
      : 4,
  );
  // 人数を減らしても入力は残す（増やしたときに戻る）。並べ替え・席順は先頭 count 件が対象
  const [rows, setRows] = useState<Row[]>(() => initialRows(lastPlayerNames));
  const [submitted, setSubmitted] = useState(false);

  const active = rows.slice(0, count);
  const issues = validatePlayerNames(active.map((r) => r.name));
  const hasIssues = issues.some((issue) => issue !== null);

  const updateActive = (next: Row[]) => setRows([...next, ...rows.slice(count)]);

  const submit = () => {
    setSubmitted(true);
    if (hasIssues) return;
    startGame(
      active.map((r) => ({ id: newId(), name: r.name.trim() })),
      config,
    );
    navigate(ROUTE_PATHS.play, { replace: true });
  };

  return (
    <div className="page">
      <h1 className="page__title">{t('setup.title')}</h1>

      <fieldset className="field">
        <legend className="field__label">{t('setup.count')}</legend>
        <div className="segmented" role="radiogroup">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              className={`segmented__item ${count === n ? 'segmented__item--active' : ''}`}
              onClick={() => setCount(n)}
            >
              {t('setup.countOption', { count: n })}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="hint-text">{t('setup.seatHelp')}</p>

      <ReorderList
        items={active}
        getKey={(r) => r.key}
        getLabel={(r) => r.name || t('setup.unnamed')}
        onChange={updateActive}
        renderItem={(row, index) => {
          const issue = submitted ? issues[index] : null;
          const errorId = `${row.key}-error`;
          return (
            <label className="name-input">
              <span className="name-input__seat">{index + 1}</span>
              <input
                className={`input ${issue ? 'input--error' : ''}`}
                value={row.name}
                maxLength={20}
                placeholder={t('setup.namePlaceholder')}
                aria-label={t('setup.nameLabel', { seat: index + 1 })}
                aria-invalid={issue ? true : undefined}
                aria-describedby={issue ? errorId : undefined}
                onChange={(e) =>
                  updateActive(
                    active.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
              {issue ? (
                <span id={errorId} className="error-text">
                  {t(`setup.errors.${issue}`)}
                </span>
              ) : null}
            </label>
          );
        }}
      />

      <div className="button-row">
        <button
          type="button"
          className="btn"
          onClick={() => updateActive(shuffle(active, defaultRng))}
        >
          {t('setup.shuffle')}
        </button>
        {/* 前回の名前を消して入力し直す（DECISIONS D-35）。人数と保存済みの前回の名前は変えない */}
        <button
          type="button"
          className="btn"
          onClick={() => {
            setRows(rows.map((r) => ({ ...r, name: '' })));
            setSubmitted(false);
          }}
        >
          {t('setup.clear')}
        </button>
      </div>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={submit}>
          {t('setup.start')}
        </button>
        <BackLink />
      </div>
    </div>
  );
}
