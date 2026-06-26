import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react-swc";
import path from "path";
import toxenApi from './vite_toxen_plugin';
import sass from "sass";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        functions: {
          "ToxenIsWeb()": () => sass.types.Boolean.TRUE
        }
      },
    }
  },
  base: './',
  build: {
    outDir: 'buildweb',
    chunkSizeWarningLimit: 4096,
  },
  plugins: [
    toxenApi("web"),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Toxen",
        short_name: "Toxen",
        description: "Toxen Music Player",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "any",
        theme_color: "#1e2327",
        background_color: "#1e2327",
        icons: [
          { src: "icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache only the app shell. User audio/media belongs in IndexedDB/OPFS,
        // never in the Workbox precache.
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2,ttf}"],
        // SPA fallback so deep links resolve to the app shell when offline.
        navigateFallback: "index.html",
        // Allow caching larger JS chunks (e.g. the FLAC decoder bundle).
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    // alias: {
    //   'node-aead-crypto': path.resolve(__dirname, './emptyModule.js'),
    // }
  },
  clearScreen: false,
} as UserConfig);