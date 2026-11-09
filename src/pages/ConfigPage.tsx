import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDictionaries } from '../app/dictionaries';
import { isGameInProgress, useGameSession } from '../app/gameSession';
import { useSettings } from '../app/settings';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  checkStrategyConstraint,
  CONFIG_LIMITS,
  createDefaultConfig,
  TIEBREAKS,
  validateConfig,
  type ConfigField,
  type ConfigIssue,
  type GameConfig,
  type Tiebreak,
} from '../game/config';
import { listCategories } from '../game/dictionary';
import { LANGUAGES } from '../i18n/languages';

type NumberKey =
  | 'startHp'
  | 'maxHp'
  | 'missDamage'
  | 'escapeHeal'
  | 'maxCycles'
  | 'overtimeMultiplier'
  | 'suddenDeathMultiplier'
  | 'rerollLimit';

/** 入力途中の値。数値は文字列のまま持ち、空欄や途中の入力を許す */
interface Draft {
  numbers: Record<NumberKey, string>;
  shotPoints: string[];
  distancePoints: string[];
  holdSeconds: string;
  tiebreak: Tiebreak;
  language: string;
  disabledCategoryIds: string[];
}

const MS_PER_SECOND = 1000;

function toDraft(config: GameConfig): Draft {
  return {
    numbers: {
      startHp: String(config.startHp),
      maxHp: String(config.maxHp),
      missDamage: String(config.missDamage),
      escapeHeal: String(config.escapeHeal),
      maxCycles: String(config.maxCycles),
      overtimeMultiplier: String(config.overtimeMultiplier),
      suddenDeathMultiplier: String(config.suddenDeathMultiplier),
      rerollLimit: String(config.rerollLimit),
    },
    shotPoints: config.shotPoints.map(String),
    distancePoints: config.distancePoints.map(String),
    holdSeconds: String(config.holdDurationMs / MS_PER_SECOND),
    tiebreak: config.tiebreak,
    language: config.language,
    disabledCategoryIds: [...config.disabledCategoryIds],
  };
}

function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

function toConfig(draft: Draft): GameConfig {
  const n = (key: NumberKey) => toNumber(draft.numbers[key]);
  const seconds = toNumber(draft.holdSeconds);
  return {
    startHp: n('startHp'),
    maxHp: n('maxHp'),
    shotPoints: draft.shotPoints.map(toNumber),
    distancePoints: draft.distancePoints.map(toNumber),
    missDamage: n('missDamage'),
    escapeHeal: n('escapeHeal'),
    maxCycles: n('maxCycles'),
    overtimeMultiplier: n('overtimeMultiplier'),
    suddenDeathMultiplier: n('suddenDeathMultiplier'),
    tiebreak: draft.tiebreak,
    rerollLimit: n('rerollLimit'),
    // 秒で入力し、ミリ秒の整数で持つ
    holdDurationMs: Number.isFinite(seconds) ? Math.round(seconds * MS_PER_SECOND) : Number.NaN,
    disabledCategoryIds: draft.disabledCategoryIds,
    language: draft.language,
  };
}

/** CONFIG（SPEC 3.12, 4章） */
export function ConfigPage() {
  const { t } = useTranslation();
  const { config, setConfig } = useSettings();
  const { game } = useGameSession();
  const { dictionaries } = useDictionaries();
  const [draft, setDraft] = useState<Draft>(() => toDraft(config));
  const [saved, setSaved] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const candidate = toConfig(draft);
  const issues = validateConfig(candidate, { supportedLanguages: LANGUAGES.map((l) => l.code) });
  const pointsValid = !issues.some((i) => i.field === 'shotPoints' || i.field === 'distancePoints');
  const strategy = pointsValid ? checkStrategyConstraint(candidate) : null;
  const categories = useMemo(
    () => listCategories(dictionaries, draft.language),
    [dictionaries, draft.language],
  );

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  const updateNumber = (key: NumberKey, value: string) =>
    update({ numbers: { ...draft.numbers, [key]: value } });

  const issueOf = (field: ConfigField, index?: number) =>
    issues.find((i) => i.field === field && (index === undefined || i.index === index)) ??
    (index === undefined
      ? undefined
      : issues.find((i) => i.field === field && i.index === undefined));

  const message = (issue: ConfigIssue | undefined): string | null => {
    if (!issue) return null;
    switch (issue.code) {
      case 'notInteger':
        return issue.field === 'holdDurationMs'
          ? t('config.errors.notNumber')
          : t('config.errors.notInteger');
      case 'outOfRange': {
        const { min, max } = rangeOf(issue.field, candidate);
        return issue.field === 'holdDurationMs'
          ? t('config.errors.outOfRangeSeconds', { min, max })
          : t('config.errors.outOfRange', { min, max });
      }
      case 'notDescending':
        return t('config.errors.notDescending');
      case 'wrongLength':
      case 'invalidValue':
      case 'unsupportedLanguage':
        return t('config.errors.invalid');
    }
  };

  const save = () => {
    if (issues.length > 0) return;
    setConfig(candidate);
    setSaved(true);
  };

  const numberField = (key: NumberKey) => (
    <NumberField
      label={t(`config.fields.${key}`)}
      help={t(`config.help.${key}`)}
      value={draft.numbers[key]}
      error={message(issueOf(key))}
      onChange={(v) => updateNumber(key, v)}
    />
  );

  return (
    <div className="page page--config">
      <h1 className="page__title">{t('config.title')}</h1>
      {isGameInProgress(game) ? (
        <p className="notice" role="note">
          {t('config.inGameNote')}
        </p>
      ) : null}

      <Section title={t('config.sections.hp')}>
        {numberField('startHp')}
        {numberField('maxHp')}
      </Section>

      <Section title={t('config.sections.points')}>
        <PointsField
          label={t('config.fields.shotPoints')}
          help={t('config.help.shotPoints')}
          itemLabel={(i) => t('config.shotLabel', { shot: i + 1 })}
          values={draft.shotPoints}
          errorAt={(i) => message(issueOf('shotPoints', i))}
          onChange={(values) => update({ shotPoints: values })}
        />
        <PointsField
          label={t('config.fields.distancePoints')}
          help={t('config.help.distancePoints')}
          itemLabel={(i) => t('config.distanceLabel', { rank: i + 1 })}
          values={draft.distancePoints}
          errorAt={(i) => message(issueOf('distancePoints', i))}
          onChange={(values) => update({ distancePoints: values })}
        />
        {strategy && !strategy.ok ? (
          <p className="warning" role="alert">
            {t('config.strategyWarning', {
              step: strategy.minShotStep,
              spread: strategy.distanceSpread,
            })}
          </p>
        ) : null}
      </Section>

      <Section title={t('config.sections.damage')}>
        {numberField('missDamage')}
        {numberField('escapeHeal')}
        {numberField('overtimeMultiplier')}
        {numberField('suddenDeathMultiplier')}
      </Section>

      <Section title={t('config.sections.progress')}>
        {numberField('maxCycles')}
        <fieldset className="field">
          <legend className="field__label">{t('config.fields.tiebreak')}</legend>
          <div className="segmented" role="radiogroup">
            {TIEBREAKS.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={draft.tiebreak === mode}
                className={`segmented__item ${draft.tiebreak === mode ? 'segmented__item--active' : ''}`}
                onClick={() => update({ tiebreak: mode })}
              >
                {t(`config.tiebreaks.${mode}`)}
              </button>
            ))}
          </div>
          <span className="hint-text">{t(`config.help.tiebreak_${draft.tiebreak}`)}</span>
        </fieldset>
        {numberField('rerollLimit')}
        <NumberField
          label={t('config.fields.holdDuration')}
          help={t('config.help.holdDuration')}
          value={draft.holdSeconds}
          step="0.1"
          inputMode="decimal"
          error={message(issueOf('holdDurationMs'))}
          onChange={(v) => update({ holdSeconds: v })}
        />
      </Section>

      <Section title={t('config.sections.dictionary')}>
        {categories.length === 0 ? (
          <p className="hint-text">{t('config.noCategories')}</p>
        ) : (
          <ul className="category-list">
            {categories.map((c) => {
              const enabled = !draft.disabledCategoryIds.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        update({
                          disabledCategoryIds: e.target.checked
                            ? draft.disabledCategoryIds.filter((id) => id !== c.id)
                            : [...draft.disabledCategoryIds, c.id],
                        })
                      }
                    />
                    {c.label}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('config.sections.language')}>
        <label className="field">
          <span className="field__label">{t('config.fields.language')}</span>
          <select
            className="input"
            value={draft.language}
            onChange={(e) => update({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <div className="actions actions--sticky">
        {issues.length > 0 ? (
          <p className="error-text" role="alert">
            {t('config.fixErrors')}
          </p>
        ) : null}
        {saved ? (
          <p className="saved-text" role="status">
            {t('config.saved')}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn--primary"
          disabled={issues.length > 0}
          onClick={save}
        >
          {t('config.save')}
        </button>
        <div className="button-row">
          <button type="button" className="btn" onClick={() => setConfirmingReset(true)}>
            {t('config.reset')}
          </button>
          <BackLink />
        </div>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title={t('config.resetTitle')}
        message={t('config.resetMessage')}
        confirmLabel={t('config.resetOk')}
        danger
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          const defaults = createDefaultConfig();
          setConfig(defaults);
          setDraft(toDraft(defaults));
          setConfirmingReset(false);
          setSaved(true);
        }}
      />
    </div>
  );
}

/** 範囲チェックのメッセージに出す範囲 */
function rangeOf(field: ConfigField, config: GameConfig): { min: number; max: number } {
  const L = CONFIG_LIMITS;
  switch (field) {
    case 'startHp':
      return L.startHp;
    case 'maxHp':
      return {
        min: Number.isInteger(config.startHp) ? config.startHp : L.startHp.min,
        max: L.maxHp.max,
      };
    case 'shotPoints':
    case 'distancePoints':
      return L.points;
    case 'missDamage':
      return L.missDamage;
    case 'escapeHeal':
      return L.escapeHeal;
    case 'maxCycles':
      return L.maxCycles;
    case 'overtimeMultiplier':
    case 'suddenDeathMultiplier':
      return L.multiplier;
    case 'rerollLimit':
      return L.rerollLimit;
    case 'holdDurationMs':
      return {
        min: L.holdDurationMs.min / MS_PER_SECOND,
        max: L.holdDurationMs.max / MS_PER_SECOND,
      };
    default:
      return { min: 0, max: 0 };
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="config-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function NumberField({
  label,
  help,
  value,
  error,
  onChange,
  step = '1',
  inputMode = 'numeric',
}: {
  label: string;
  help: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  step?: string;
  inputMode?: 'numeric' | 'decimal';
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`input input--number ${error ? 'input--error' : ''}`}
        type="number"
        inputMode={inputMode}
        step={step}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={`${id}-help`} className="hint-text">
        {help}
      </span>
      {error ? (
        <span id={`${id}-error`} className="error-text">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function PointsField({
  label,
  help,
  itemLabel,
  values,
  errorAt,
  onChange,
}: {
  label: string;
  help: string;
  itemLabel: (index: number) => string;
  values: string[];
  errorAt: (index: number) => string | null;
  onChange: (values: string[]) => void;
}) {
  const errors = values.map((_, i) => errorAt(i));
  const firstError = errors.find((e) => e !== null) ?? null;
  return (
    <fieldset className="field">
      <legend className="field__label">{label}</legend>
      <div className="points-inputs">
        {values.map((value, i) => (
          <label key={i} className="points-input">
            <span className="points-input__label">{itemLabel(i)}</span>
            <input
              className={`input input--number ${errors[i] ? 'input--error' : ''}`}
              type="number"
              inputMode="numeric"
              value={value}
              aria-invalid={errors[i] ? true : undefined}
              onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
            />
          </label>
        ))}
      </div>
      <span className="hint-text">{help}</span>
      {firstError ? <span className="error-text">{firstError}</span> : null}
    </fieldset>
  );
}
