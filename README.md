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

## デプロイ

GitHub リポジトリを Vercel に接続する。`main` への push で本番、プルリクエストでプレビューが作られる。
SPA のため `vercel.json` で全パスを `index.html` に書き換えている（実在する静的ファイルが優先される）。
