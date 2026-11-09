import { AnswerOrderScene } from './AnswerOrderScene';
import { ComposeScene } from './ComposeScene';
import { EliminatedScene, OvertimeScene, SuddenDeathScene } from './AnnouncementScenes';
import { FinishedScene } from './FinishedScene';
import { HandoffScene } from './HandoffScene';
import { ReviewScene } from './ReviewScene';
import { RoundIntroScene } from './RoundIntroScene';
import { RoundResultScene } from './RoundResultScene';
import { ShootingScene } from './ShootingScene';
import { SuddenDeathOrderScene } from './SuddenDeathOrderScene';
import type { SceneProps } from './types';

/** 状態機械の場面に応じて画面を切り替える */
export function SceneView({ game, dispatch }: SceneProps) {
  const props = { game, dispatch };
  const { scene } = game;
  // 場面が変わったら入力中の内容を捨てるため、key に場面を入れる
  const key = `${game.records.length}-${scene.type}-${game.round?.rejectionCount ?? 0}`;
  switch (scene.type) {
    case 'roundIntro':
      return <RoundIntroScene key={key} {...props} />;
    case 'handoff':
      return <HandoffScene key={`${key}-${scene.next}`} {...props} scene={scene} />;
    case 'compose':
      return <ComposeScene key={key} {...props} />;
    case 'review':
      return <ReviewScene key={key} {...props} />;
    case 'answerOrder':
      return <AnswerOrderScene key={key} {...props} />;
    case 'shooting':
      return <ShootingScene key={key} {...props} />;
    case 'roundResult':
      return <RoundResultScene key={key} {...props} />;
    case 'eliminated':
      return <EliminatedScene key={key} {...props} playerId={scene.playerId} />;
    case 'overtimeAnnouncement':
      return <OvertimeScene key={key} {...props} />;
    case 'suddenDeathAnnouncement':
      return <SuddenDeathScene key={key} {...props} />;
    case 'suddenDeathOrder':
      return <SuddenDeathOrderScene key={key} {...props} />;
    case 'finished':
      return <FinishedScene key={key} {...props} />;
  }
}
