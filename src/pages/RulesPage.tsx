import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../app/settings';
import { BackLink } from '../components/BackLink';
import { hintCountOf, NORMAL_MULTIPLIER } from '../game/config';
import { hitDamage } from '../game/damage';

/**
 * ルール説明（SPEC 3.11）。数値は現在の CONFIG 値を差し込む。
 * ゲーム中に開いても秘密情報は表示しない（ゲーム状態を参照しない）。
 */
export function RulesPage() {
  const { t } = useTranslation();
  const { config } = useSettings();
  const sep = t('rules.listSeparator');
  const values = {
    startHp: config.startHp,
    maxHp: config.maxHp,
    hintCount: hintCountOf(config),
    rerollLimit: config.rerollLimit,
    holdSeconds: config.holdDurationMs / 1000,
    shotPoints: config.shotPoints.join(sep),
    distancePoints: config.distancePoints.join(sep),
    maxHit: hitDamage(config, 0, Math.max(...config.distancePoints), NORMAL_MULTIPLIER),
    missDamage: config.missDamage,
    escapeHeal: config.escapeHeal,
    maxCycles: config.maxCycles,
    overtimeMultiplier: config.overtimeMultiplier,
    suddenDeathMultiplier: config.suddenDeathMultiplier,
  };

  return (
    <div className="page page--rules">
      <h1 className="page__title">{t('rules.title')}</h1>

      <Section title={t('rules.overviewTitle')}>
        <p>{t('rules.overview', values)}</p>
      </Section>

      <Section title={t('rules.rolesTitle')}>
        <dl className="rules-roles">
          <dt>{t('roles.target')}</dt>
          <dd>{t('rules.roleTarget', values)}</dd>
          <dt>{t('roles.spotter')}</dt>
          <dd>{t('rules.roleSpotter')}</dd>
          <dt>{t('roles.sniper')}</dt>
          <dd>{t('rules.roleSniper')}</dd>
        </dl>
        <p>{t('rules.rolesRotation')}</p>
      </Section>

      <Section title={t('rules.flowTitle')}>
        <ol>
          <li>{t('rules.flow1', values)}</li>
          <li>{t('rules.flow2', values)}</li>
          <li>{t('rules.flow3')}</li>
          <li>{t('rules.flow4', values)}</li>
          <li>{t('rules.flow5')}</li>
          <li>{t('rules.flow6', values)}</li>
        </ol>
        <p>{t('rules.flowHandoff', values)}</p>
      </Section>

      <Section title={t('rules.damageTitle')}>
        <ul>
          <li>{t('rules.damageHit', values)}</li>
          <li>{t('rules.damageMiss', values)}</li>
          <li>{t('rules.damageEscape', values)}</li>
          <li>{t('rules.damagePass')}</li>
        </ul>
        <p>{t('rules.damageSecret')}</p>
      </Section>

      <Section title={t('rules.victoryTitle')}>
        <ul>
          <li>{t('rules.victoryElimination')}</li>
          <li>{t('rules.victoryCycles', values)}</li>
          <li>
            {config.tiebreak === 'suddenDeath'
              ? t('rules.victorySuddenDeath', values)
              : t('rules.victoryDraw')}
          </li>
        </ul>
      </Section>

      <Section title={t('rules.forbiddenTitle')}>
        <p className="rules-forbidden">{t('rules.forbidden')}</p>
      </Section>

      <Section title={t('rules.savingTitle')}>
        <p>{t('rules.saving')}</p>
      </Section>

      <div className="actions">
        <BackLink />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rules-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}
