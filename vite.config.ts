import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import netlify from '@netlify/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Emulates Netlify Functions and the local database during `npm run dev`.
    // Edge functions aren't used, and their local emulator needs a Deno install.
    netlify({ edgeFunctions: { enabled: false } }),
    VitePWA({
      registerType: 'autoUpdate',
      // API responses are always fetched live; the app caches what it needs itself.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Interesting Questions',
        short_name: 'Questions',
        description: 'A few good questions to spark a better conversation.',
        theme_color: '#14121a',
        background_color: '#14121a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
