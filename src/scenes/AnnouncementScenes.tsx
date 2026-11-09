import { useTranslation } from 'react-i18next';
import type { PlayerId } from '../game/players';
import { must } from '../game/util';
import { nameOf, type SceneProps } from './types';

/** 脱落の告知（SPEC 3.9） */
export function EliminatedScene({ game, dispatch, playerId }: SceneProps & { playerId: PlayerId }) {
  const { t } = useTranslation();
  return (
    <section className="scene scene--announce" role="alert">
      <h1 className="announce__title">{t('announce.eliminatedTitle')}</h1>
      <p className="announce__message">
        {t('announce.eliminatedMessage', { name: nameOf(game)(playerId) })}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'acknowledge' })}
        >
          {t('common.next')}
        </button>
      </div>
    </section>
  );
}

/** 延長戦突入の告知（SPEC 3.9）。誰が同点かは示さない */
export function OvertimeScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  return (
    <section className="scene scene--announce" role="alert">
      <h1 className="announce__title">
        {t('announce.overtimeTitle', { multiplier: game.config.overtimeMultiplier })}
      </h1>
      <p className="announce__message">{t('announce.overtimeMessage')}</p>
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'acknowledge' })}
        >
          {t('common.next')}
        </button>
      </div>
    </section>
  );
}

/** サドンデス突入の告知（SPEC 3.9）：参加者（同点者）と観測手（脱落者）。HPの値は示さない */
export function SuddenDeathScene({ game, dispatch }: SceneProps) {
  const { t } = useTranslation();
  const sd = must(game.suddenDeath, 'sudden death');
  const name = nameOf(game);
  return (
    <section className="scene scene--announce" role="alert">
      <h1 className="announce__title">{t('announce.suddenDeathTitle')}</h1>
      <p className="announce__message">{t('announce.suddenDeathMessage')}</p>
      <dl className="roles">
        <div className="roles__row">
          <dt>{t('announce.participants')}</dt>
          <dd>{sd.participantIds.map(name).join('、')}</dd>
        </div>
        <div className="roles__row">
          <dt>{t('roles.spotter')}</dt>
          <dd>{name(sd.spotterId)}</dd>
        </div>
      </dl>
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'acknowledge' })}
        >
          {t('announce.toOrder')}
        </button>
      </div>
    </section>
  );
}
