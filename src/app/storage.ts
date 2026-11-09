import { STORAGE_PREFIX } from '../constants';
import { cloneConfig, createDefaultConfig, validateConfig, type GameConfig } from '../game/config';
import { GAME_SCHEMA_VERSION, type GameState } from '../game/state';

/**
 * localStorage への保存（SPEC 5.2）。キーにはアプリ固有の接頭辞を付ける。
 * 保存データにはスキーマのバージョンを持たせ、読めない古いデータは破棄する。
 * プライベートモードなどで localStorage が使えない場合は保存しない（例外は出さない）。
 */

export const STORAGE_KEYS = {
  game: `${STORAGE_PREFIX}game`,
  config: `${STORAGE_PREFIX}config`,
  playerNames: `${STORAGE_PREFIX}player-names`,
} as const;

/** CONFIG と前回のプレイヤー名の保存形式のバージョン */
export const SETTINGS_SCHEMA_VERSION = 1;

/** 読み込みの結果。discarded は「データはあったが読めないので破棄した」 */
export type LoadResult<T> =
  { status: 'empty' } | { status: 'ok'; value: T } | { status: 'discarded' };

/** 使える localStorage を返す。使えなければ null */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_PREFIX}probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function read(storage: Storage | null, key: string): unknown {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    // JSON として読めない
    return null;
  }
}

function write(storage: Storage | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 容量不足など。ゲームは続けられるので警告だけ出す
    console.warn(`[storage] failed to save ${key}`, error);
  }
}

function discard(storage: Storage | null, key: string): { status: 'discarded' } {
  write(storage, key, undefined);
  return { status: 'discarded' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---- ゲーム状態 ----

/** ゲーム状態として読めるか（形の大枠と、固定した CONFIG を確かめる） */
function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value['schemaVersion'] !== GAME_SCHEMA_VERSION) return false;
  const { players, hp, scene, records, config } = value;
  return (
    Array.isArray(players) &&
    players.every(
      (p) => isRecord(p) && typeof p['id'] === 'string' && typeof p['name'] === 'string',
    ) &&
    isRecord(hp) &&
    players.every((p) => typeof hp[(p as { id: string }).id] === 'number') &&
    isRecord(scene) &&
    typeof scene['type'] === 'string' &&
    Array.isArray(records) &&
    isRecord(config) &&
    validateConfig(config as unknown as GameConfig).length === 0
  );
}

export function loadGame(storage: Storage | null): LoadResult<GameState> {
  const raw = read(storage, STORAGE_KEYS.game);
  if (raw === undefined) return { status: 'empty' };
  return isGameState(raw) ? { status: 'ok', value: raw } : discard(storage, STORAGE_KEYS.game);
}

/** ゲーム状態を保存する。null なら削除する */
export function saveGame(storage: Storage | null, game: GameState | null): void {
  write(storage, STORAGE_KEYS.game, game ?? undefined);
}

// ---- CONFIG ----

/**
 * CONFIG を読む。保存後に項目が増えた場合に備え、足りない項目は初期値で補う。
 * 範囲外の値を含むなど読めなければ破棄する。
 */
export function loadConfig(
  storage: Storage | null,
  supportedLanguages: readonly string[],
): LoadResult<GameConfig> {
  const raw = read(storage, STORAGE_KEYS.config);
  if (raw === undefined) return { status: 'empty' };
  if (
    !isRecord(raw) ||
    raw['schemaVersion'] !== SETTINGS_SCHEMA_VERSION ||
    !isRecord(raw['config'])
  ) {
    return discard(storage, STORAGE_KEYS.config);
  }
  const config = { ...createDefaultConfig(), ...raw['config'] } as GameConfig;
  if (validateConfig(config, { supportedLanguages }).length > 0) {
    return discard(storage, STORAGE_KEYS.config);
  }
  return { status: 'ok', value: cloneConfig(config) };
}

export function saveConfig(storage: Storage | null, config: GameConfig): void {
  write(storage, STORAGE_KEYS.config, { schemaVersion: SETTINGS_SCHEMA_VERSION, config });
}

// ---- 前回のプレイヤー名 ----

export function loadPlayerNames(storage: Storage | null): LoadResult<string[]> {
  const raw = read(storage, STORAGE_KEYS.playerNames);
  if (raw === undefined) return { status: 'empty' };
  if (
    !isRecord(raw) ||
    raw['schemaVersion'] !== SETTINGS_SCHEMA_VERSION ||
    !Array.isArray(raw['names']) ||
    !raw['names'].every((n) => typeof n === 'string')
  ) {
    return discard(storage, STORAGE_KEYS.playerNames);
  }
  return { status: 'ok', value: raw['names'] as string[] };
}

export function savePlayerNames(storage: Storage | null, names: readonly string[]): void {
  write(storage, STORAGE_KEYS.playerNames, {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    names: [...names],
  });
}
