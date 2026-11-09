# MiND SNiPER（連想スナイピングゲーム）

1台のスマホを回して遊ぶ、パス・アンド・プレイ方式の連想ゲーム（3〜6人）。サーバーもログインも使わない静的サイト（SPA）。

- 仕様書：[docs/SPEC.md](docs/SPEC.md)
- 実装上の判断記録：[docs/DECISIONS.md](docs/DECISIONS.md)

## 開発

Node.js 26 以上が必要。

```bash
npm install
npm run dev        # 開発サーバー
npm run check      # 型検査・lint・整形チェック・テストをまとめて実行
npm run build      # 本番ビルド（dist/）
```

| コマンド                | 内容                                                 |
| ----------------------- | ---------------------------------------------------- |
| `npm run lint`          | oxlint（警告もエラー扱い）                           |
| `npm run format`        | Prettier で整形                                      |
| `npm test`              | Vitest を1回実行（`test:watch` で監視）              |
| `npm run test:coverage` | 網羅率を測る（`src/game` は90%以上を必須にしている） |
| `npm run preview`       | ビルド結果をローカルで配信                           |

## 多言語化

画面の文言はすべて `src/locales/<lang>.json` に置く。言語を足すときは JSON ファイルを1つ追加するだけでよく、
`meta.languageName` が言語切替え欄の表示名になる。翻訳キーは `ja.json` を基準に型検査される。
英字タイトル「MiND SNiPER」は全言語共通（`src/constants.ts`）。

## 辞書

`public/dictionaries/` に辞書ファイル（JSON）を置き、`index.json` の `dictionaries` にファイル名を足すと使えるようになる。
形式は仕様書 5.1 と DECISIONS D-16 を参照。同梱している本番辞書（5ファイル・40カテゴリ・1,286語）の収録方針は DECISIONS D-30。

辞書を足したり直したりしたら `npm test` を実行する。`src/game/dictionaryData.test.ts` が、形式の誤り、
辞書をまたいだ単語の重複、読みの書式、カテゴリごとの語数（5語以上）、有名人の辞書の収録年を確かめる。

## PWA

ホーム画面に追加すると全画面で開き、オフラインでも遊べる（辞書もキャッシュする）。Service Worker は本番ビルドでのみ有効で、
`npm run build && npm run preview` で確認できる。アイコンを変えるときは `public/icon.svg` を編集して次を実行する。

```bash
npx pwa-assets-generator --preset minimal-2023 public/icon.svg
```

## 保存データ

ブラウザの localStorage に `mind-sniper:` で始まるキーで保存する（ゲーム状態・CONFIG・前回のプレイヤー名）。
同じ端末・同じブラウザでのみ再開でき、プライベートモードや閲覧履歴の削除で消える。
ゲーム状態の形を変えたら `src/game/state.ts` の `GAME_SCHEMA_VERSION` を上げる（古いデータは破棄される）。

## デプロイ

GitHub リポジトリを Vercel に接続する。`main` への push で本番、プルリクエストでプレビューが作られる。
SPA のため `vercel.json` で全パスを `index.html` に書き換えている（実在する静的ファイルが優先される）。
