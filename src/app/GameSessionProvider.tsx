import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { GameConfig } from '../game/config';
import type { Player } from '../game/players';
import { createGame, gameReducer, prepareForResume, type GameAction } from '../game/reducer';
import type { GameState } from '../game/state';
import { GameSessionContext, isGameInProgress, type GameSessionValue } from './gameSession';
import { loadGame, loadPlayerNames, saveGame, savePlayerNames } from './storage';

interface SessionState {
  game: GameState | null;
  lastPlayerNames: string[];
  resumePromptPending: boolean;
  gameDiscarded: boolean;
}

type SessionAction =
  | { type: 'start'; game: GameState }
  | { type: 'game'; action: GameAction }
  | { type: 'resume' }
  | { type: 'discard' }
  | { type: 'dismissResumePrompt' }
  | { type: 'dismissGameDiscarded' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        game: action.game,
        lastPlayerNames: action.game.players.map((p) => p.name),
        resumePromptPending: false,
      };
    case 'game': {
      if (!state.game) return state;
      const game = gameReducer(state.game, action.action);
      return game === state.game ? state : { ...state, game };
    }
    case 'resume':
      return state.game
        ? { ...state, game: prepareForResume(state.game), resumePromptPending: false }
        : state;
    case 'discard':
      return { ...state, game: null, resumePromptPending: false };
    case 'dismissResumePrompt':
      return { ...state, resumePromptPending: false };
    case 'dismissGameDiscarded':
      return { ...state, gameDiscarded: false };
  }
}

export interface GameSessionProviderProps {
  children: ReactNode;
  /** 保存先。null なら保存しない */
  storage: Storage | null;
  /** テスト用：保存データより優先する初期状態 */
  initialGame?: GameState | null;
  initialPlayerNames?: string[];
}

interface InitArgs {
  storage: Storage | null;
  initialGame: GameState | null | undefined;
  initialPlayerNames: string[] | undefined;
}

function initState({ storage, initialGame, initialPlayerNames }: InitArgs): SessionState {
  const loadedGame = initialGame === undefined ? loadGame(storage) : null;
  const loadedNames = initialPlayerNames === undefined ? loadPlayerNames(storage) : null;
  // 保存データから再開するときは、秘密情報を含む場面に直接戻らない（SPEC 3.2）
  const game =
    initialGame !== undefined
      ? initialGame
      : loadedGame?.status === 'ok'
        ? prepareForResume(loadedGame.value)
        : null;
  return {
    game,
    lastPlayerNames: initialPlayerNames ?? (loadedNames?.status === 'ok' ? loadedNames.value : []),
    // 未完了のゲームが保存された状態でアプリを開いたら、続きから／新規を選ばせる
    resumePromptPending: initialGame === undefined && isGameInProgress(game),
    gameDiscarded: loadedGame?.status === 'discarded',
  };
}

/**
 * 進行中のゲームを保持する。ゲーム進行は useReducer による状態機械で、操作のたびに保存する（SPEC 5.2, 6章）。
 */
export function GameSessionProvider({
  children,
  storage,
  initialGame,
  initialPlayerNames,
}: GameSessionProviderProps) {
  const [state, send] = useReducer(
    sessionReducer,
    { storage, initialGame, initialPlayerNames } satisfies InitArgs,
    initState,
  );

  useEffect(() => {
    saveGame(storage, state.game);
  }, [storage, state.game]);

  useEffect(() => {
    if (state.lastPlayerNames.length > 0) savePlayerNames(storage, state.lastPlayerNames);
  }, [storage, state.lastPlayerNames]);

  const dispatch = useCallback((action: GameAction) => send({ type: 'game', action }), []);
  const startGame = useCallback(
    (players: Player[], config: GameConfig) =>
      send({ type: 'start', game: createGame(players, config) }),
    [],
  );
  const resumeGame = useCallback(() => send({ type: 'resume' }), []);
  const discardGame = useCallback(() => send({ type: 'discard' }), []);
  const dismissResumePrompt = useCallback(() => send({ type: 'dismissResumePrompt' }), []);
  const dismissGameDiscarded = useCallback(() => send({ type: 'dismissGameDiscarded' }), []);

  const value = useMemo<GameSessionValue>(
    () => ({
      game: state.game,
      lastPlayerNames: state.lastPlayerNames,
      resumePromptPending: state.resumePromptPending,
      gameDiscarded: state.gameDiscarded,
      dispatch,
      startGame,
      resumeGame,
      discardGame,
      dismissResumePrompt,
      dismissGameDiscarded,
    }),
    [
      state,
      dispatch,
      startGame,
      resumeGame,
      discardGame,
      dismissResumePrompt,
      dismissGameDiscarded,
    ],
  );
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}
