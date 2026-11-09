import type { PlayerId } from '../game/players';
import type { GameAction } from '../game/reducer';
import { playerById } from '../game/selectors';
import type { GameState } from '../game/state';

export interface SceneProps {
  game: GameState;
  dispatch: (action: GameAction) => void;
}

/** プレイヤー名を引く関数を作る */
export function nameOf(game: GameState): (id: PlayerId) => string {
  return (id) => playerById(game, id).name;
}
