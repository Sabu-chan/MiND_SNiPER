/**
 * ルーティングするのはトップ・ルール・CONFIG と、ゲームの入口（プレイヤー登録・ゲーム画面）のみ（SPEC 6章）。
 * ゲーム内の画面は状態機械の場面で切り替え、URL に秘密情報を含めない（DECISIONS D-17）。
 */
export const ROUTE_PATHS = {
  top: '/',
  setup: '/new',
  play: '/play',
  rules: '/rules',
  config: '/config',
} as const;
