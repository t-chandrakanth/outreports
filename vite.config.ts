import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'production' && !/^https?:\/\//.test(env.VITE_APPS_SCRIPT_URL ?? '')) {
    throw new Error(
      'VITE_APPS_SCRIPT_URL is not set — a build without the Apps Script /exec URL cannot reach Google Sheets.',
    );
  }
  return {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // src/pwa.ts applies updates, deferring while a form is dirty
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: "SCR TMR'S OUTREPORTS",
        short_name: 'OUTREPORTS',
        description: 'South Central Railway train outreport entry',
        theme_color: '#2C7A7B',
        background_color: '#F7FAFC',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        clientsClaim: true,
        // The Apps Script API is never HTTP-cached: responses arrive via
        // redirected one-time googleusercontent URLs. Offline reads come from
        // the app-level list cache in IndexedDB instead.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/script\.google(usercontent)?\.com\//,
            handler: 'NetworkOnly',
          },
          {
            // Vercel Analytics / Speed Insights script and beacons: never
            // served stale from a cache, never replayed.
            urlPattern: /^https?:\/\/[^/]+\/_vercel\/(insights|speed-insights)\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  };
});
