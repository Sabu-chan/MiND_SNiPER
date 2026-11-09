import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { HpChart } from '../components/HpChart';
import { RoundLabelText } from '../components/RoundLabelText';
import type { RoundRecord } from '../game/state';
import { must } from '../game/util';
import { ROUTE_PATHS } from '../routePaths';
import { nameOf, type SceneProps } from './types';

/**
 * 結果発表（SPEC 3.10）。ここで初めて HP・ダメージ量・遠さ点を含む全記録とHP推移を公開する。
 */
export function FinishedScene({ game }: SceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const result = must(game.result, 'result');
  const name = nameOf(game);

  return (
    <section className="scene scene--finished">
      <h1 className="scene__title">{t('final.title')}</h1>
      <p className="final-winner">
        {result.draw
          ? t('final.draw', { names: result.winnerIds.map(name).join('、') })
          : t('final.winner', { name: name(must(result.winnerIds[0], 'winner')) })}
      </p>

      <table className="standings" aria-label={t('final.standings')}>
        <thead>
          <tr>
            <th scope="col">{t('final.rank')}</th>
            <th scope="col">{t('final.player')}</th>
            <th scope="col">{t('final.hp')}</th>
          </tr>
        </thead>
        <tbody>
          {result.standings.map((s) => (
            <tr key={s.playerId} className={s.rank === 1 ? 'standings__top' : ''}>
              <td>{t('final.rankValue', { rank: s.rank })}</td>
              <td>{name(s.playerId)}</td>
              <td>{game.hp[s.playerId]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <HpChart game={game} />

      <h2 className="section-title">{t('final.records')}</h2>
      <ol className="records">
        {game.records.map((record, index) => (
          <RecordCard key={index} record={record} game={game} />
        ))}
      </ol>

      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => navigate(ROUTE_PATHS.setup)}
        >
          {t('final.playAgain')}
        </button>
        <Link className="btn" to={ROUTE_PATHS.top}>
          {t('common.backToTop')}
        </Link>
      </div>
    </section>
  );
}

function RecordCard({ record, game }: { record: RoundRecord; game: SceneProps['game'] }) {
  const { t } = useTranslation();
  const name = nameOf(game);
  const topic = record.topic;
  const hitEvent = record.events.find((e) => e.kind === 'hit');

  return (
    <li className="record card">
      <p className="record__label">
        <RoundLabelText label={record.label} maxCycles={game.config.maxCycles} />
        {record.multiplier !== 1 ? ` ×${record.multiplier}` : ''}
      </p>
      <p className="record__roles">
        {t('roles.target')}：{name(record.targetId)} ／ {t('roles.spotter')}：
        {name(record.spotterId)}
      </p>
      {topic ? (
        <p className="record__topic">
          {t('compose.topic')}：<strong>{topic.text}</strong>
          {topic.categoryLabel ? `（${topic.categoryLabel}）` : ''}
        </p>
      ) : null}

      {record.shotOrder && record.distanceByHint ? (
        <ol className="record__hints">
          {record.shotOrder.map((hintIndex, shot) => (
            <li
              key={hintIndex}
              className={hitEvent?.hintIndex === hintIndex ? 'record__hint--hit' : ''}
            >
              {t('final.hintLine', {
                shot: shot + 1,
                hint: record.hints[hintIndex],
                points: record.distanceByHint?.[hintIndex],
              })}
            </li>
          ))}
        </ol>
      ) : null}

      <ul className="record__events">
        {record.events.map((e, i) => {
          switch (e.kind) {
            case 'hit':
              return (
                <li key={i}>
                  {t('final.hitLine', {
                    shot: e.shot + 1,
                    name: name(e.sniperId),
                    damage: e.damage,
                  })}
                </li>
              );
            case 'miss':
              return (
                <li key={i}>
                  {e.memo
                    ? t('final.missLineWithMemo', {
                        shot: e.shot + 1,
                        name: name(e.sniperId),
                        memo: e.memo,
                        damage: e.damage,
                      })
                    : t('final.missLine', {
                        shot: e.shot + 1,
                        name: name(e.sniperId),
                        damage: e.damage,
                      })}
                </li>
              );
            case 'pass':
              return (
                <li key={i} className="record__pass">
                  {t('final.passLine', { shot: e.shot + 1, name: name(e.sniperId) })}
                </li>
              );
          }
        })}
        {record.outcome?.kind === 'escaped' ? (
          <li>{t('final.escapedLine', { heal: record.outcome.healApplied })}</li>
        ) : null}
        {record.outcome?.kind === 'sniperEliminated' ? <li>{t('final.interruptedLine')}</li> : null}
      </ul>
    </li>
  );
}
