import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../game/config';
import { createGame, gameReducer } from '../game/reducer';
import {
  getBrowserStorage,
  loadConfig,
  loadGame,
  loadPlayerNames,
  saveConfig,
  saveGame,
  savePlayerNames,
  STORAGE_KEYS,
} from './storage';
import { memoryStorage } from '../test/memoryStorage';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
];

describe('storage（SPEC 5.2）', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('キーにはアプリ固有の接頭辞が付く', () => {
    expect(Object.values(STORAGE_KEYS).every((k) => k.startsWith('mind-sniper:'))).toBe(true);
  });

  it('ゲーム状態を保存して、そのまま読み戻せる', () => {
    const game = gameReducer(createGame(players, createDefaultConfig()), { type: 'beginRound' });
    saveGame(storage, game);
    expect(loadGame(storage)).toEqual({ status: 'ok', value: game });
    saveGame(storage, null);
    expect(storage.getItem(STORAGE_KEYS.game)).toBeNull();
    expect(loadGame(storage)).toEqual({ status: 'empty' });
  });

  it('スキーマのバージョンが違う・壊れたゲーム状態は破棄する', () => {
    const game = createGame(players, createDefaultConfig());
    storage.setItem(STORAGE_KEYS.game, JSON.stringify({ ...game, schemaVersion: 0 }));
    expect(loadGame(storage)).toEqual({ status: 'discarded' });
    expect(storage.getItem(STORAGE_KEYS.game)).toBeNull();

    storage.setItem(STORAGE_KEYS.game, '{not json');
    expect(loadGame(storage)).toEqual({ status: 'discarded' });

    storage.setItem(STORAGE_KEYS.game, JSON.stringify({ ...game, hp: { a: 1 } }));
    expect(loadGame(storage)).toEqual({ status: 'discarded' });

    storage.setItem(
      STORAGE_KEYS.game,
      JSON.stringify({ ...game, config: { ...game.config, startHp: 5 } }),
    );
    expect(loadGame(storage)).toEqual({ status: 'discarded' });
  });

  it('CONFIG を保存して読み戻せる。足りない項目は初期値で補う', () => {
    const config = { ...createDefaultConfig(), maxCycles: 5, disabledCategoryIds: ['food'] };
    saveConfig(storage, config);
    expect(loadConfig(storage, ['ja'])).toEqual({ status: 'ok', value: config });

    const { holdDurationMs: _omit, ...partial } = config;
    void _omit;
    storage.setItem(STORAGE_KEYS.config, JSON.stringify({ schemaVersion: 1, config: partial }));
    expect(loadConfig(storage, ['ja'])).toEqual({
      status: 'ok',
      value: { ...config, holdDurationMs: 1500 },
    });
  });

  it('範囲外の値や未登録の言語を含む CONFIG は破棄する', () => {
    saveConfig(storage, { ...createDefaultConfig(), maxCycles: 99 });
    expect(loadConfig(storage, ['ja'])).toEqual({ status: 'discarded' });
    saveConfig(storage, { ...createDefaultConfig(), language: 'xx' });
    expect(loadConfig(storage, ['ja'])).toEqual({ status: 'discarded' });
    storage.setItem(STORAGE_KEYS.config, JSON.stringify({ schemaVersion: 2, config: {} }));
    expect(loadConfig(storage, ['ja'])).toEqual({ status: 'discarded' });
  });

  it('前回のプレイヤー名を保存して読み戻せる', () => {
    savePlayerNames(storage, ['A', 'B', 'C']);
    expect(loadPlayerNames(storage)).toEqual({ status: 'ok', value: ['A', 'B', 'C'] });
    storage.setItem(STORAGE_KEYS.playerNames, JSON.stringify({ schemaVersion: 1, names: [1] }));
    expect(loadPlayerNames(storage)).toEqual({ status: 'discarded' });
  });

  it('Storage が使えなければ何もしない', () => {
    saveGame(null, createGame(players, createDefaultConfig()));
    expect(loadGame(null)).toEqual({ status: 'empty' });
    expect(loadConfig(null, ['ja'])).toEqual({ status: 'empty' });
  });

  it('保存に失敗しても例外にしない（容量不足など）', () => {
    const full: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const warn = console.warn;
    console.warn = () => undefined;
    expect(() => saveConfig(full, createDefaultConfig())).not.toThrow();
    console.warn = warn;
  });

  it('ブラウザの localStorage を取得できる', () => {
    expect(getBrowserStorage()).not.toBeNull();
  });
});
