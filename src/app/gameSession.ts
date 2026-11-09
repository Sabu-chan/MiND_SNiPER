import { createContext, useContext } from 'react';
import type { GameConfig } from '../game/config';
import type { Player } from '../game/players';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/state';

export interface GameSessionValue {
  /** 進行中（または終了直後）のゲーム。なければ null */
  game: GameState | null;
  /** ゲーム進行のアクションを送る */
  dispatch: (action: GameAction) => void;
  /** 新しいゲームを始める（その時点の CONFIG を固定する） */
  startGame: (players: Player[], config: GameConfig) => void;
  /** 保存中のゲームを捨てる */
  discardGame: () => void;
  /** 前回のプレイヤー名（席順）。プレイヤー登録の初期入力に使う */
  lastPlayerNames: string[];
}

export const GameSessionContext = createContext<GameSessionValue | null>(null);

export function useGameSession(): GameSessionValue {
  const value = useContext(GameSessionContext);
  if (!value) throw new Error('useGameSession must be used within GameSessionProvider');
  return value;
}

/** 進行中のゲームがあるか（終了したゲームは含めない） */
export function isGameInProgress(game: GameState | null): boolean {
  return game !== null && game.scene.type !== 'finished';
}
