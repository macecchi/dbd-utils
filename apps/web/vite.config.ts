import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const commitHash = (process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA)?.slice(0, 7) ?? 'dev';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/dbd-utils/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(commitHash)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  build: {
    // Modern target: the audience is up-to-date Twitch/streamer browsers, and no
    // @vitejs/plugin-legacy is installed, so down-leveling to es2022 buys nothing.
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        // Split each major dependency into its own hashed chunk so a single app
        // change (or a dependency bump) only invalidates the affected chunk for
        // returning users, instead of busting the whole bundle. Vite then auto-
        // emits <link rel="modulepreload"> for the eagerly-imported chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) return 'react';
          if (id.includes('node_modules/zustand')) return 'zustand';
          if (id.includes('node_modules/partysocket')) return 'partysocket';
          if (id.includes('node_modules/sonner')) return 'sonner';
          return 'vendor';
        }
      }
    }
  }
});
