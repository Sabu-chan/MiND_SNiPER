import { useTranslation } from 'react-i18next';
import type { RoundLabel } from '../game/state';

/** ラウンド・ターン番号と延長戦／サドンデスの別（SPEC 3.4、DECISIONS D-05） */
export function RoundLabelText({ label, maxCycles }: { label: RoundLabel; maxCycles: number }) {
  const { t } = useTranslation();
  switch (label.phase) {
    case 'main':
      return <>{t('round.main', { cycle: label.cycle, maxCycles, round: label.roundInCycle })}</>;
    case 'overtime':
      return <>{t('round.overtime', { round: label.round })}</>;
    case 'suddenDeath':
      return <>{t('round.suddenDeath', { round: label.round })}</>;
  }
}
