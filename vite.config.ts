import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: "SCR TMR'S OUTREPORTS",
        short_name: 'OUTREPORTS',
        description: 'South Central Railway train outreport entry',
        theme_color: '#002f5f',
        background_color: '#f2f4f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        clientsClaim: true,
        skipWaiting: true,
        // The Apps Script API is never HTTP-cached: responses arrive via
        // redirected one-time googleusercontent URLs. Offline reads come from
        // the app-level list cache in IndexedDB instead.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/script\.google(usercontent)?\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
