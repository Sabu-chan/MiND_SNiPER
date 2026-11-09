import { useState } from 'react';
import type { GameState } from '../game/state';

/**
 * 開発時のみのデバッグ表示（SPEC 6章）：全員のHPと遠さ点。
 * 本番ビルドには含めない（PlayPage で import.meta.env.DEV のときだけ読み込む）。
 * 開発中も秘匿の確認ができるよう、既定では閉じておき、開いているときだけ中身を描画する。
 * 文言は開発者向けなので多言語化しない。
 */
export function DebugPanel({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
  const round = game.round;
  return (
    <details className="debug-panel" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>DEBUG (dev only)</summary>
      {open ? (
        <>
          <table>
            <tbody>
              {game.players.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  <td>HP {game.hp[p.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            phase: {game.phase} / scene: {game.scene.type}
          </p>
          {round?.topic ? <p>topic: {round.topic.text}</p> : null}
          {round?.distanceByHint ? (
            <ol>
              {round.hints.map((hint, i) => (
                <li key={i}>
                  {hint}: {round.distanceByHint?.[i]}pt
                  {round.shotOrder ? ` (shot ${round.shotOrder.indexOf(i) + 1})` : ''}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
    </details>
  );
}
