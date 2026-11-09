import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';
import { useGameSession } from '../app/gameSession';
import { GameHeader } from '../components/GameHeader';
import { useWakeLock } from '../hooks/useWakeLock';
import { ROUTE_PATHS } from '../routePaths';
import { SceneView } from '../scenes/SceneView';

/** 開発時のみのデバッグ表示（SPEC 6章）。本番ビルドには含めない */
const DebugPanel = import.meta.env.DEV
  ? lazy(() => import('../components/DebugPanel').then((m) => ({ default: m.DebugPanel })))
  : null;

/** ゲーム画面。場面は状態機械で切り替える（URL は変えない） */
export function PlayPage() {
  const { game, dispatch } = useGameSession();
  const playing = game !== null && game.scene.type !== 'finished';
  useWakeLock(playing);

  if (!game) return <Navigate to={ROUTE_PATHS.top} replace />;
  return (
    <div className="page page--game">
      <GameHeader game={game} />
      <SceneView game={game} dispatch={dispatch} />
      {DebugPanel ? (
        <Suspense fallback={null}>
          <DebugPanel game={game} />
        </Suspense>
      ) : null}
    </div>
  );
}
