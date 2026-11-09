/**
 * ルーティングするのはトップ・ルール・CONFIG のみ（SPEC 6章）。
 * ゲーム内の画面は状態機械の場面で切り替え、URL に秘密情報を含めない（段階3）。
 */
export const ROUTE_PATHS = {
  top: '/',
  rules: '/rules',
  config: '/config',
} as const;
