import { useTranslation } from 'react-i18next';
import { RoundLabelText } from '../components/RoundLabelText';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/** ターン開始（SPEC 3.4）：全員に見せる */
export function RoundIntroScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const round = must(game.round, 'round');
  const name = nameOf(game);

  return (
    <section className="scene">
      <p className="scene__eyebrow">{t('intro.title')}</p>
      <h1 className="scene__title">
        <RoundLabelText label={round.label} maxCycles={game.config.maxCycles} />
      </h1>
      {round.phase !== 'main' ? (
        <p className="badge badge--accent">
          {t('intro.multiplier', { multiplier: round.multiplier })}
        </p>
      ) : null}

      <dl className="roles">
        <div className="roles__row">
          <dt>{t('roles.target')}</dt>
          <dd>{name(round.targetId)}</dd>
        </div>
        <div className="roles__row">
          <dt>{t('roles.spotter')}</dt>
          <dd>{name(round.spotterId)}</dd>
        </div>
        <div className="roles__row">
          <dt>{t('roles.sniper')}</dt>
          <dd>{round.sniperIds.map(name).join('、')}</dd>
        </div>
      </dl>

      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'beginRound' })}
        >
          {t('intro.handToTarget')}
        </button>
      </div>
    </section>
  );
}
