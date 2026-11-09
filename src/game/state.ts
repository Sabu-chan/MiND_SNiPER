import type { GameConfig } from './config';
import type { Phase } from './damage';
import type { DrawnEntry } from './dictionary';
import type { GenreId } from './genre';
import type { ContentionExit, Standing } from './outcome';
import type { Player, PlayerId } from './players';

/**
 * 保存データのスキーマのバージョン（SPEC 5.2）。
 * GameState の形を変えたら上げる。読めない古いデータは破棄する。
 */
export const GAME_SCHEMA_VERSION = 2;

/** ターンの表示用の番号（DECISIONS D-05） */
export type RoundLabel =
  | { phase: 'main'; cycle: number; roundInCycle: number }
  | { phase: 'overtime'; round: number }
  | { phase: 'suddenDeath'; round: number };

/** 確定した正解 */
export interface Topic {
  text: string;
  /** 読み（ランダム出題で辞書にあるとき） */
  reading: string | null;
  source: 'free' | 'random';
  /** ランダム出題の辞書キー */
  entryKey: string | null;
  /** ランダム出題のカテゴリ名 */
  categoryLabel: string | null;
  /** ジャンル（任意出題は標的が選ぶ、ランダム出題は辞書のカテゴリから。ジャンル偵察で公開する） */
  genre: GenreId;
}

/** 観測手の差し戻し（SPEC 2.3-4, 3.6） */
export interface Rejection {
  hintIndex: number;
  comment: string | null;
}

/** 射撃中の1操作の記録 */
export type ShotEvent =
  | {
      kind: 'hit';
      shot: number;
      sniperId: PlayerId;
      /** 命中した射で公開していたヒントの添字 */
      hintIndex: number;
      /** 計算上のダメージ */
      damage: number;
      /** 実際に減ったHP（下限0で頭打ち） */
      applied: number;
    }
  | {
      kind: 'miss';
      shot: number;
      sniperId: PlayerId;
      memo: string | null;
      damage: number;
      applied: number;
    }
  | { kind: 'pass'; shot: number; sniperId: PlayerId }
  /** ジャンル偵察（DECISIONS D-33）。ダメージに倍率はかけない */
  | { kind: 'scout'; shot: number; sniperId: PlayerId; damage: number; applied: number };

export type RoundOutcome =
  | { kind: 'hit'; sniperId: PlayerId; shot: number }
  | { kind: 'escaped'; healApplied: number }
  /** 誤射で狙撃手が脱落し、ターンが途中で終わった */
  | { kind: 'sniperEliminated'; sniperId: PlayerId; shot: number };

export interface RoundState {
  phase: Phase;
  label: RoundLabel;
  targetId: PlayerId;
  spotterId: PlayerId;
  /** 席順で観測手の次の人から並べた狙撃手 */
  sniperIds: PlayerId[];
  multiplier: number;

  /** 現在表示しているランダム出題の結果 */
  drawnEntry: DrawnEntry | null;
  /** このターンで抽選した回数（2回目以降が引き直し） */
  drawCount: number;

  /** 確定した正解（観測手に渡したあと） */
  topic: Topic | null;
  /** ヒント（標的の入力順） */
  hints: string[];
  /** 差し戻し中のヒント。null なら差し戻しなし */
  rejections: Rejection[] | null;
  /** 差し戻した回数 */
  rejectionCount: number;

  /** ヒントの添字ごとの遠さ点（承認後） */
  distanceByHint: number[] | null;
  /** 出題順（ヒントの添字を公開順に並べたもの。承認時にシャッフル） */
  shotOrder: number[] | null;
  /** 狙撃手の回答順 */
  answerOrder: PlayerId[] | null;

  /** 現在の射（0始まり） */
  shot: number;
  /** 回答順の中で今回答する人の位置 */
  answererIndex: number;
  events: ShotEvent[];
  outcome: RoundOutcome | null;
  /** このターンでジャンル偵察によりジャンルを公開したか */
  genreRevealed: boolean;
}

/** 終わったターンの記録（結果発表で公開する。SPEC 3.10） */
export interface RoundRecord extends RoundState {
  /** ターン終了時（脱落したターンは脱落した時点）の全員のHP */
  hpAfter: Record<PlayerId, number>;
}

export interface SuddenDeathState {
  participantIds: PlayerId[];
  spotterId: PlayerId;
  /** ジャンケンで決めた標的の順。登録前は null */
  targetOrder: PlayerId[] | null;
  /** 何人目の標的か（0始まり） */
  turn: number;
}

export interface GameResult {
  /** 勝者。引き分けなら同点者全員 */
  winnerIds: PlayerId[];
  draw: boolean;
  standings: Standing[];
}

/** 受け渡し画面のあとに開く場面 */
export type HandoffNext = 'compose' | 'review' | 'answerOrder' | 'shooting' | 'suddenDeathOrder';

/** 長押しで開く場面（秘密情報を表示する場面。SPEC 3.1） */
export const SECRET_SCENES: readonly HandoffNext[] = ['compose', 'review'];

/**
 * 場面。ゲーム内の画面はこれで切り替える（URL に秘密情報を含めない。SPEC 6章）。
 */
export type Scene =
  /** ターン開始（全員に見せる） */
  | { type: 'roundIntro' }
  /** 受け渡し画面 */
  | { type: 'handoff'; playerId: PlayerId; role: 'target' | 'spotter'; next: HandoffNext }
  /** 出題（標的） */
  | { type: 'compose' }
  /** 承認（観測手） */
  | { type: 'review' }
  /** 狙撃手の回答順の登録（観測手） */
  | { type: 'answerOrder' }
  /** 射撃（観測手が操作し全員に見せる） */
  | { type: 'shooting' }
  /** ターン結果 */
  | { type: 'roundResult' }
  /** 脱落の告知 */
  | { type: 'eliminated'; playerId: PlayerId }
  /** 延長戦突入の告知 */
  | { type: 'overtimeAnnouncement' }
  /** サドンデス突入の告知 */
  | { type: 'suddenDeathAnnouncement' }
  /** サドンデスの標的順の登録（観測手） */
  | { type: 'suddenDeathOrder' }
  /** 結果発表 */
  | { type: 'finished' };

export interface GameStateBody {
  schemaVersion: typeof GAME_SCHEMA_VERSION;
  /** ゲーム開始時に固定した CONFIG */
  config: GameConfig;
  /** 席順 */
  players: Player[];
  hp: Record<PlayerId, number>;
  phase: Phase;
  /** 本戦・延長戦で終わったターンの数（輪番の r） */
  rotationIndex: number;
  /** 延長戦で始めたターンの数 */
  overtimeRounds: number;
  /** サドンデスで始めたターンの数（繰り返しをまたいで数える） */
  suddenDeathRounds: number;
  suddenDeath: SuddenDeathState | null;
  round: RoundState | null;
  records: RoundRecord[];
  /** 抽選から外す辞書キー（出題済み・引き直しで捨てたもの） */
  usedEntryKeys: string[];
  /** 使用済みの正解の表記（正規化済み） */
  usedWords: string[];
  /** ジャンル偵察を使ったプレイヤー（1ゲームに1回。延長戦・サドンデスでも戻らない） */
  scoutUsedBy: PlayerId[];
  /** 勝ち残りから外れた人の記録（順位付け用） */
  exits: ContentionExit[];
  result: GameResult | null;
  scene: Scene;
}

export interface GameState extends GameStateBody {
  /** 「元に戻す」で戻る直前の状態（射撃中の直前の1操作のみ。DECISIONS D-02） */
  undo: GameStateBody | null;
}
