import { describe, expect, it } from 'vitest';
import {
  buildPool,
  countAvailable,
  drawEntry,
  listCategories,
  loadDictionaries,
  NO_EXCLUSIONS,
  parseDictionaryIndex,
  validateDictionary,
  type Dictionary,
} from './dictionary';
import { createSeededRng, createSequenceRng } from './rng';

const rawJa = {
  version: 1,
  lang: 'ja',
  name: '基本辞書',
  categories: [
    { id: 'prefecture', label: '都道府県' },
    { id: 'animal', label: '動物' },
  ],
  entries: [
    {
      id: 'pref-hokkaido',
      word: '北海道',
      reading: 'ほっかいどう',
      category: 'prefecture',
      year: 2026,
    },
    { id: 'pref-aomori', word: '青森県', category: 'prefecture' },
    { id: 'pref-iwate', word: '岩手県', category: 'prefecture' },
    { id: 'animal-panda', word: 'パンダ', category: 'animal' },
  ],
};

function dict(raw: unknown, source = 'base.ja.json'): Dictionary {
  const { value } = validateDictionary(raw, source);
  if (!value) throw new Error('invalid test dictionary');
  return value;
}

describe('validateDictionary（SPEC 5.1）', () => {
  it('正しい辞書を読み込み、キーにファイル名を付ける', () => {
    const { value, warnings } = validateDictionary(rawJa, 'base.ja.json');
    expect(warnings).toEqual([]);
    expect(value?.entries[0]).toEqual({
      key: 'base.ja.json#pref-hokkaido',
      id: 'pref-hokkaido',
      word: '北海道',
      reading: 'ほっかいどう',
      categoryId: 'prefecture',
      year: 2026,
    });
    expect(value?.entries[1]).toMatchObject({ reading: null, year: null });
  });

  it('不正な項目だけを除外して警告に残す', () => {
    const { value, warnings } = validateDictionary(
      {
        ...rawJa,
        categories: [...rawJa.categories, { id: 'animal', label: '重複' }, { id: '' }],
        entries: [
          ...rawJa.entries,
          { id: 'pref-hokkaido', word: '重複ID', category: 'prefecture' },
          { id: 'no-word', word: ' ', category: 'prefecture' },
          { id: 'bad-cat', word: '月', category: 'space' },
          { id: 'bad-year', word: '富士山', category: 'prefecture', year: '2026' },
          { id: 'bad-reading', word: '富士山', category: 'prefecture', reading: 1 },
          { word: 'IDなし', category: 'prefecture' },
          'not an object',
        ],
      },
      'base.ja.json',
    );
    expect(value?.categories.map((c) => c.id)).toEqual(['prefecture', 'animal']);
    expect(value?.entries.map((e) => e.id)).toEqual([
      'pref-hokkaido',
      'pref-aomori',
      'pref-iwate',
      'animal-panda',
    ]);
    expect(warnings).toHaveLength(9);
    expect(warnings.every((w) => w.startsWith('base.ja.json'))).toBe(true);
  });

  it.each([
    ['オブジェクトでない', []],
    ['バージョン違い', { ...rawJa, version: 2 }],
    ['lang なし', { ...rawJa, lang: '' }],
    ['name なし', { ...rawJa, name: undefined }],
    ['entries が配列でない', { ...rawJa, entries: {} }],
  ])('ファイル全体の形式が不正なら null（%s）', (_, raw) => {
    const { value, warnings } = validateDictionary(raw, 'x.json');
    expect(value).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});

describe('parseDictionaryIndex', () => {
  it('ファイル名の一覧を読み、不正な名前と重複を除外する', () => {
    const { value, warnings } = parseDictionaryIndex({
      version: 1,
      dictionaries: ['a.json', 'a.json', '../secret.json', 'index.json', 'b.txt', 3, 'c-ja.json'],
    });
    expect(value).toEqual(['a.json', 'c-ja.json']);
    expect(warnings).toHaveLength(5);
  });

  it('形式が不正なら空', () => {
    expect(parseDictionaryIndex({ dictionaries: ['a.json'] }).value).toEqual([]);
    expect(parseDictionaryIndex({ version: 1 }).value).toEqual([]);
  });
});

describe('listCategories / buildPool', () => {
  const ja = dict(rawJa);
  const ja2 = dict(
    {
      version: 1,
      lang: 'ja',
      name: '追加',
      categories: [
        { id: 'animal', label: 'どうぶつ' },
        { id: 'empty', label: '空' },
      ],
      entries: [{ id: 'koala', word: 'コアラ', category: 'animal' }],
    },
    'extra.ja.json',
  );
  const en = dict(
    {
      ...rawJa,
      lang: 'en',
      entries: [{ id: 'tokyo', word: 'Tokyo', category: 'prefecture' }],
    },
    'base.en.json',
  );

  it('表示言語と一致する辞書だけを使い、同じ id のカテゴリはまとめる', () => {
    expect(listCategories([ja, ja2, en], 'ja')).toEqual([
      { id: 'prefecture', label: '都道府県' },
      { id: 'animal', label: '動物' },
      { id: 'empty', label: '空' },
    ]);
    const pool = buildPool([ja, ja2, en], 'ja', []);
    expect(pool.categories.map((c) => [c.id, c.entries.map((e) => e.word)])).toEqual([
      ['prefecture', ['北海道', '青森県', '岩手県']],
      ['animal', ['パンダ', 'コアラ']],
    ]);
  });

  it('無効にしたカテゴリは含めない', () => {
    const pool = buildPool([ja, ja2], 'ja', ['prefecture']);
    expect(pool.categories.map((c) => c.id)).toEqual(['animal']);
  });

  it('一致する言語がなければ空', () => {
    expect(buildPool([ja], 'en', []).categories).toEqual([]);
  });
});

describe('drawEntry（SPEC 2.2：2段階抽選）', () => {
  const pool = buildPool([dict(rawJa)], 'ja', []);

  it('まずカテゴリを等確率で選び、その中から単語を選ぶ', () => {
    // 1つ目の乱数でカテゴリ（0.6 → 2つ中の2番目＝動物）、2つ目で単語
    expect(drawEntry(pool, NO_EXCLUSIONS, createSequenceRng([0.6, 0]))).toEqual({
      key: 'base.ja.json#animal-panda',
      word: 'パンダ',
      reading: null,
      categoryId: 'animal',
      categoryLabel: '動物',
    });
    expect(drawEntry(pool, NO_EXCLUSIONS, createSequenceRng([0.1, 0.99]))?.word).toBe('岩手県');
  });

  it('カテゴリの単語数に関係なく、カテゴリは等確率で選ばれる', () => {
    const rng = createSeededRng(123);
    let animal = 0;
    const trials = 4000;
    for (let i = 0; i < trials; i += 1) {
      if (drawEntry(pool, NO_EXCLUSIONS, rng)?.categoryId === 'animal') animal += 1;
    }
    // 単語数は 3:1 だが、カテゴリは 1:1 で選ばれる
    expect(animal / trials).toBeGreaterThan(0.45);
    expect(animal / trials).toBeLessThan(0.55);
  });

  it('使用済みの単語（キー・正規化した表記）は除外し、単語の尽きたカテゴリは選ばない', () => {
    const exclusions = {
      keys: new Set(['base.ja.json#animal-panda']),
      words: new Set(['北海道', '青森県']),
    };
    expect(countAvailable(pool, exclusions)).toBe(1);
    // どんな乱数でも残りの1件になる
    for (const v of [0, 0.5, 0.99]) {
      expect(drawEntry(pool, exclusions, createSequenceRng([v]))?.word).toBe('岩手県');
    }
  });

  it('出せる単語がなければ null', () => {
    const exclusions = {
      keys: new Set(pool.categories.flatMap((c) => c.entries.map((e) => e.key))),
      words: new Set<string>(),
    };
    expect(countAvailable(pool, exclusions)).toBe(0);
    expect(drawEntry(pool, exclusions, createSeededRng(1))).toBeNull();
    expect(drawEntry({ categories: [] }, NO_EXCLUSIONS, createSeededRng(1))).toBeNull();
  });
});

describe('loadDictionaries', () => {
  it('index.json を起点に読み込み、失敗したファイルは除外して警告に残す', async () => {
    const files: Record<string, unknown> = {
      '/dictionaries/index.json': {
        version: 1,
        dictionaries: ['base.ja.json', 'broken.json', 'missing.json'],
      },
      '/dictionaries/base.ja.json': rawJa,
      '/dictionaries/broken.json': { version: 99 },
    };
    const fetchJson = (path: string) =>
      path in files ? Promise.resolve(files[path]) : Promise.reject(new Error('404'));
    const { value, warnings } = await loadDictionaries(fetchJson);
    expect(value.map((d) => d.source)).toEqual(['base.ja.json']);
    expect(warnings).toHaveLength(2);
  });

  it('index.json が読めなければ空', async () => {
    const { value, warnings } = await loadDictionaries(() => Promise.reject(new Error('offline')));
    expect(value).toEqual([]);
    expect(warnings).toHaveLength(1);
  });
});
