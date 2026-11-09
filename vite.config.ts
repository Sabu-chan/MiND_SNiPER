import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA：ホーム画面への追加、全画面表示、オフライン動作（辞書もキャッシュ）（SPEC 6章）
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'MiND SNiPER 連想スナイピングゲーム',
        short_name: 'MiND SNiPER',
        description: '1台のスマホを回して遊ぶ、HP制の対戦型連想ゲーム',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        background_color: '#121216',
        theme_color: '#c62f2f',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 辞書（public/dictionaries/*.json）も含めて事前キャッシュし、オフラインで遊べるようにする
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,json,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
