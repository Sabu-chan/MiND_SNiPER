import { useTranslation } from 'react-i18next';
import { HoldButton } from '../components/HoldButton';
import { isHoldRequired } from '../game/selectors';
import type { Scene } from '../game/state';
import { nameOf, type SceneProps } from './types';

/**
 * 受け渡し画面（SPEC 3.1）。役割名とプレイヤー名だけを表示し、秘密情報は一切表示しない。
 * 秘密情報を開くボタンは長押しで発動する。
 */
export function HandoffScene({
  game,
  dispatch,
  scene,
}: SceneProps & { scene: Extract<Scene, { type: 'handoff' }> }) {
  const { t } = useTranslation();
  const name = nameOf(game)(scene.playerId);
  const role = t(`roles.${scene.role}`);
  const open = () => dispatch({ type: 'openHandoff' });

  return (
    <section className="scene scene--handoff">
      <div className="handoff">
        <p className="handoff__role">{role}</p>
        <p className="handoff__name">{t('common.nameSuffix', { name })}</p>
        <p className="handoff__message">{t('handoff.message', { name, role })}</p>
      </div>
      <div className="actions">
        {isHoldRequired(game) ? (
          <>
            <p className="hint-text">{t('handoff.holdHelp', { name })}</p>
            <HoldButton
              className="btn--primary"
              durationMs={game.config.holdDurationMs}
              onComplete={open}
            >
              {t('handoff.holdToOpen')}
            </HoldButton>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={open}>
            {t('handoff.tapToOpen', { name })}
          </button>
        )}
      </div>
    </section>
  );
}
