import { useCallback, useMemo, useReducer, type ReactNode } from 'react';
import type { GameConfig } from '../game/config';
import type { Player } from '../game/players';
import { createGame, gameReducer, type GameAction } from '../game/reducer';
import type { GameState } from '../game/state';
import { GameSessionContext, type GameSessionValue } from './gameSession';

interface SessionState {
  game: GameState | null;
  lastPlayerNames: string[];
}

type SessionAction =
  { type: 'start'; game: GameState } | { type: 'game'; action: GameAction } | { type: 'discard' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start':
      return { game: action.game, lastPlayerNames: action.game.players.map((p) => p.name) };
    case 'game': {
      if (!state.game) return state;
      const game = gameReducer(state.game, action.action);
      return game === state.game ? state : { ...state, game };
    }
    case 'discard':
      return { ...state, game: null };
  }
}

/**
 * 進行中のゲームを保持する。ゲーム進行は useReducer による状態機械（SPEC 6章）。
 * 保存と再開は段階4で実装する。
 */
export function GameSessionProvider({
  children,
  initialGame = null,
  initialPlayerNames = [],
}: {
  children: ReactNode;
  initialGame?: GameState | null;
  initialPlayerNames?: string[];
}) {
  const [state, send] = useReducer(sessionReducer, {
    game: initialGame,
    lastPlayerNames: initialPlayerNames,
  });

  const dispatch = useCallback((action: GameAction) => send({ type: 'game', action }), []);
  const startGame = useCallback(
    (players: Player[], config: GameConfig) =>
      send({ type: 'start', game: createGame(players, config) }),
    [],
  );
  const discardGame = useCallback(() => send({ type: 'discard' }), []);

  const value = useMemo<GameSessionValue>(
    () => ({
      game: state.game,
      lastPlayerNames: state.lastPlayerNames,
      dispatch,
      startGame,
      discardGame,
    }),
    [state, dispatch, startGame, discardGame],
  );
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}
