import { pickOne, type Rng } from './rng';
import { normalizeText } from './text';

/** 辞書ファイルの形式のバージョン（SPEC 5.1） */
export const DICTIONARY_FORMAT_VERSION = 1;

/** 辞書ファイルの一覧（public/dictionaries/index.json）の形式のバージョン */
export const DICTIONARY_INDEX_VERSION = 1;

export interface DictionaryCategory {
  id: string;
  label: string;
}

export interface DictionaryEntry {
  /** 辞書をまたいで一意なキー（`<ファイル名>#<id>`） */
  key: string;
  id: string;
  word: string;
  reading: string | null;
  categoryId: string;
  year: number | null;
}

export interface Dictionary {
  /** 読み込んだファイル名 */
  source: string;
  lang: string;
  name: string;
  categories: DictionaryCategory[];
  entries: DictionaryEntry[];
}

/** 抽選結果（標的・観測手への表示に使う） */
export interface DrawnEntry {
  key: string;
  word: string;
  reading: string | null;
  categoryId: string;
  categoryLabel: string;
}

export interface DictionaryLoadResult<T> {
  value: T;
  /** 除外した項目などの警告。読み込み側でコンソールに出す（SPEC 5.1） */
  warnings: string[];
}

const FILE_NAME_PATTERN = /^[A-Za-z0-9_.-]+\.json$/;

/**
 * index.json を検証する。形式：`{ "version": 1, "dictionaries": ["sample.ja.json", ...] }`
 * 不正なファイル名（パスを含むもの、index.json 自身、重複）は除外する。
 */
export function parseDictionaryIndex(raw: unknown): DictionaryLoadResult<string[]> {
  const warnings: string[] = [];
  if (!isRecord(raw) || raw['version'] !== DICTIONARY_INDEX_VERSION) {
    return { value: [], warnings: ['index.json: unsupported format or version'] };
  }
  const list = raw['dictionaries'];
  if (!Array.isArray(list)) {
    return { value: [], warnings: ['index.json: "dictionaries" must be an array'] };
  }
  const files: string[] = [];
  list.forEach((name: unknown, i) => {
    if (
      typeof name !== 'string' ||
      !FILE_NAME_PATTERN.test(name) ||
      name === 'index.json' ||
      name.startsWith('.')
    ) {
      warnings.push(`index.json: dictionaries[${i}] is not a valid file name; skipped`);
    } else if (files.includes(name)) {
      warnings.push(`index.json: "${name}" is listed twice; skipped`);
    } else {
      files.push(name);
    }
  });
  return { value: files, warnings };
}

/**
 * 辞書ファイルを検証する（SPEC 5.1）。
 * ファイル全体の形式が不正なら null。項目単位の不正は、その項目を除外して警告に残す。
 */
export function validateDictionary(
  raw: unknown,
  source: string,
): DictionaryLoadResult<Dictionary | null> {
  const warnings: string[] = [];
  const fail = (reason: string) => ({ value: null, warnings: [`${source}: ${reason}`] });

  if (!isRecord(raw)) return fail('not a JSON object');
  if (raw['version'] !== DICTIONARY_FORMAT_VERSION) return fail('unsupported version');
  const lang = raw['lang'];
  if (!isNonEmptyString(lang)) return fail('"lang" is required');
  const name = raw['name'];
  if (!isNonEmptyString(name)) return fail('"name" is required');
  const rawCategories = raw['categories'];
  const rawEntries = raw['entries'];
  if (!Array.isArray(rawCategories)) return fail('"categories" must be an array');
  if (!Array.isArray(rawEntries)) return fail('"entries" must be an array');

  const categories: DictionaryCategory[] = [];
  rawCategories.forEach((c: unknown, i) => {
    if (!isRecord(c) || !isNonEmptyString(c['id']) || !isNonEmptyString(c['label'])) {
      warnings.push(`${source}: categories[${i}] is invalid; skipped`);
    } else if (categories.some((existing) => existing.id === c['id'])) {
      warnings.push(`${source}: category "${c['id']}" is duplicated; skipped`);
    } else {
      categories.push({ id: c['id'], label: c['label'].trim() });
    }
  });
  const categoryIds = new Set(categories.map((c) => c.id));

  const entries: DictionaryEntry[] = [];
  const seenIds = new Set<string>();
  rawEntries.forEach((e: unknown, i) => {
    const where = `${source}: entries[${i}]`;
    if (!isRecord(e)) return warnings.push(`${where} is not an object; skipped`);
    const id = e['id'];
    const word = e['word'];
    const category = e['category'];
    const reading = e['reading'];
    const year = e['year'];
    if (!isNonEmptyString(id)) return warnings.push(`${where}: "id" is required; skipped`);
    if (seenIds.has(id)) return warnings.push(`${where}: id "${id}" is duplicated; skipped`);
    if (!isNonEmptyString(word)) return warnings.push(`${where}: "word" is required; skipped`);
    if (!isNonEmptyString(category) || !categoryIds.has(category)) {
      return warnings.push(`${where}: unknown category; skipped`);
    }
    if (reading !== undefined && typeof reading !== 'string') {
      return warnings.push(`${where}: "reading" must be a string; skipped`);
    }
    if (year !== undefined && !Number.isInteger(year)) {
      return warnings.push(`${where}: "year" must be an integer; skipped`);
    }
    seenIds.add(id);
    entries.push({
      key: `${source}#${id}`,
      id,
      word: word.trim(),
      reading: typeof reading === 'string' && reading.trim() !== '' ? reading.trim() : null,
      categoryId: category,
      year: typeof year === 'number' ? year : null,
    });
    return undefined;
  });

  return { value: { source, lang, name: name.trim(), categories, entries }, warnings };
}

/** 抽選の対象になるカテゴリと単語 */
export interface DictionaryPool {
  categories: { id: string; label: string; entries: DictionaryEntry[] }[];
}

/**
 * 表示言語に一致する辞書のカテゴリ一覧（CONFIG のカテゴリ切替え用）。
 * 同じ id のカテゴリは1つにまとめ、表示名は最初に読み込んだものを使う。
 */
export function listCategories(
  dictionaries: readonly Dictionary[],
  lang: string,
): DictionaryCategory[] {
  const result: DictionaryCategory[] = [];
  for (const d of dictionaries) {
    if (d.lang !== lang) continue;
    for (const c of d.categories) {
      if (!result.some((r) => r.id === c.id)) result.push({ ...c });
    }
  }
  return result;
}

/** 表示言語が一致し、有効なカテゴリの単語を集める（単語が1件もないカテゴリは含めない） */
export function buildPool(
  dictionaries: readonly Dictionary[],
  lang: string,
  disabledCategoryIds: readonly string[],
): DictionaryPool {
  const categories = listCategories(dictionaries, lang)
    .filter((c) => !disabledCategoryIds.includes(c.id))
    .map((c) => ({
      ...c,
      entries: dictionaries
        .filter((d) => d.lang === lang)
        .flatMap((d) => d.entries.filter((e) => e.categoryId === c.id)),
    }));
  return { categories: categories.filter((c) => c.entries.length > 0) };
}

/** 抽選から外す単語（DECISIONS D-03） */
export interface DrawExclusions {
  /** 出題済み・引き直しで捨てた単語のキー */
  keys: ReadonlySet<string>;
  /** 使用済みのお題の表記（正規化済み） */
  words: ReadonlySet<string>;
}

export const NO_EXCLUSIONS: DrawExclusions = { keys: new Set(), words: new Set() };

function isAvailable(entry: DictionaryEntry, exclusions: DrawExclusions): boolean {
  return !exclusions.keys.has(entry.key) && !exclusions.words.has(normalizeText(entry.word));
}

/** まだ出せる単語の数。0 ならランダム出題はできない（SPEC 2.2, 5.1） */
export function countAvailable(pool: DictionaryPool, exclusions: DrawExclusions): number {
  return pool.categories.reduce(
    (sum, c) => sum + c.entries.filter((e) => isAvailable(e, exclusions)).length,
    0,
  );
}

/**
 * 2段階抽選（SPEC 2.2）：まだ単語の残っている有効なカテゴリを等確率で選び、その中から単語を等確率で選ぶ。
 * 出せる単語がなければ null。
 */
export function drawEntry(
  pool: DictionaryPool,
  exclusions: DrawExclusions,
  rng: Rng,
): DrawnEntry | null {
  const candidates = pool.categories
    .map((c) => ({ ...c, entries: c.entries.filter((e) => isAvailable(e, exclusions)) }))
    .filter((c) => c.entries.length > 0);
  if (candidates.length === 0) return null;
  const category = pickOne(candidates, rng);
  const entry = pickOne(category.entries, rng);
  return {
    key: entry.key,
    word: entry.word,
    reading: entry.reading,
    categoryId: category.id,
    categoryLabel: category.label,
  };
}

/** JSON を取得する関数（テストで差し替える） */
export type FetchJson = (path: string) => Promise<unknown>;

/**
 * public/dictionaries/index.json を起点に辞書を読み込む（SPEC 5.1）。
 * 取得や検証に失敗したファイルは除外し、警告に残す。
 */
export async function loadDictionaries(
  fetchJson: FetchJson,
  basePath = '/dictionaries/',
): Promise<DictionaryLoadResult<Dictionary[]>> {
  const warnings: string[] = [];
  let indexRaw: unknown;
  try {
    indexRaw = await fetchJson(`${basePath}index.json`);
  } catch (error) {
    return { value: [], warnings: [`index.json: failed to load (${String(error)})`] };
  }
  const index = parseDictionaryIndex(indexRaw);
  warnings.push(...index.warnings);

  const loaded = await Promise.all(
    index.value.map(async (file) => {
      try {
        return validateDictionary(await fetchJson(`${basePath}${file}`), file);
      } catch (error) {
        return { value: null, warnings: [`${file}: failed to load (${String(error)})`] };
      }
    }),
  );
  const dictionaries: Dictionary[] = [];
  for (const result of loaded) {
    warnings.push(...result.warnings);
    if (result.value) dictionaries.push(result.value);
  }
  return { value: dictionaries, warnings };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
