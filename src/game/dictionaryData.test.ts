import { GENRE_IDS } from './genre';
import { describe, expect, it } from 'vitest';
import { buildPool, parseDictionaryIndex, validateDictionary, type Dictionary } from './dictionary';
import { normalizeText } from './text';

/**
 * 同梱している本番辞書（public/dictionaries/）の検査。
 * 辞書を足したり直したりしたら、このテストで形式の誤り・重複・読みの書式を確かめる。
 */
const files = import.meta.glob<unknown>('../../public/dictionaries/*.json', {
  eager: true,
  import: 'default',
});

const byName = new Map(
  Object.entries(files).map(([path, json]) => [path.split('/').pop() ?? path, json]),
);

const index = parseDictionaryIndex(byName.get('index.json'));
const dictionaries: Dictionary[] = index.value.map((file) => {
  const { value, warnings } = validateDictionary(byName.get(file), file);
  if (!value || warnings.length > 0) {
    throw new Error(`${file}: ${warnings.join(' / ') || 'not found'}`);
  }
  return value;
});

/** 1カテゴリに最低限ほしい単語数（2段階抽選でカテゴリが等確率に選ばれるため） */
const MIN_ENTRIES_PER_CATEGORY = 5;

describe('同梱の辞書（SPEC 5.1）', () => {
  it('index.json に載っているファイルがすべてあり、警告なしで読み込める', () => {
    expect(index.warnings).toEqual([]);
    expect(dictionaries.length).toBeGreaterThan(0);
    // index.json に載っていない辞書ファイルを置き忘れていない
    const listed = new Set([...index.value, 'index.json']);
    expect([...byName.keys()].filter((name) => !listed.has(name))).toEqual([]);
  });

  it('すべて日本語の辞書で、カテゴリ id は辞書をまたいで重複しない', () => {
    expect(dictionaries.every((d) => d.lang === 'ja')).toBe(true);
    const ids = dictionaries.flatMap((d) => d.categories.map((c) => c.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('同じ単語（正規化後）は辞書・カテゴリをまたいで1回だけ', () => {
    const words = dictionaries.flatMap((d) => d.entries.map((e) => normalizeText(e.word)));
    expect(words.filter((w, i) => words.indexOf(w) !== i)).toEqual([]);
  });

  it(`各カテゴリに${MIN_ENTRIES_PER_CATEGORY}語以上ある`, () => {
    const pool = buildPool(dictionaries, 'ja', []);
    const allCategories = dictionaries.flatMap((d) => d.categories.map((c) => c.id));
    expect(pool.categories.map((c) => c.id)).toEqual(allCategories);
    const small = pool.categories.filter((c) => c.entries.length < MIN_ENTRIES_PER_CATEGORY);
    expect(small.map((c) => `${c.label}: ${c.entries.length}`)).toEqual([]);
  });

  it('読みはひらがな・カタカナと長音・中黒だけで書く', () => {
    const bad = dictionaries
      .flatMap((d) => d.entries)
      .filter((e) => e.reading !== null && !/^[ぁ-ゖァ-ヺー・]+$/.test(e.reading));
    expect(bad.map((e) => `${e.word}: ${e.reading}`)).toEqual([]);
  });

  it('読みの付いた単語は、かな部分が読みと食い違っていない', () => {
    // 単語中のかな（ひらがな・カタカナ）は、読みにも同じ順で現れるはず。
    // 「ヶ」（槍ヶ岳＝やりがたけ）と、歴史的仮名遣いの表記（平塚らいてう＝らいちょう）は例外
    const HISTORICAL_SPELLING = new Set(['平塚らいてう']);
    const toHiragana = (s: string) =>
      s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    const bad = dictionaries
      .flatMap((d) => d.entries)
      .filter((e) => {
        if (e.reading === null || HISTORICAL_SPELLING.has(e.word)) return false;
        const kana = toHiragana(e.word.replace(/ヶ/g, '').replace(/[^ぁ-ゖァ-ヶー]/g, ''));
        const reading = toHiragana(e.reading);
        let at = 0;
        for (const ch of kana) {
          at = reading.indexOf(ch, at);
          if (at < 0) return true;
          at += 1;
        }
        return false;
      });
    expect(bad.map((e) => `${e.word}: ${e.reading}`)).toEqual([]);
  });

  it('時事性のある人名（有名人の辞書）には収録年が入っている', () => {
    const people = dictionaries.find((d) => d.source === 'people.ja.json');
    expect(people?.entries.every((e) => e.year !== null)).toBe(true);
  });
});

describe('同梱の辞書のジャンル（DECISIONS D-33）', () => {
  it('すべてのカテゴリに既知のジャンルがあり、16ジャンルのどれかに必ず単語がある', () => {
    const categories = dictionaries.flatMap((d) => d.categories);
    expect(categories.filter((c) => c.genre === null).map((c) => c.id)).toEqual([]);
    const used = new Set(categories.map((c) => c.genre));
    expect(GENRE_IDS.filter((g) => !used.has(g))).toEqual([]);
  });
});
