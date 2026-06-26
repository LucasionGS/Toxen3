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
        // Stable identity for the installed app. Absolute so it never depends on
        // the manifest's own URL path.
        id: "/",
        name: "Toxen",
        short_name: "Toxen",
        description: "Toxen Music Player",
        // Absolute start_url/scope and icon paths. Android's WebAPK minting
        // server rejects/stalls on relative paths (".", "icons/x.png"), causing
        // installs to hang at "Installing..."; the web build is served at the
        // site root, so leading-slash paths resolve correctly.
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#1e2327",
        background_color: "#1e2327",
        icons: [
          { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache only the app shell. User audio/media must never be precached
        // here; on the web it belongs in IndexedDB or OPFS (the Origin Private
        // File System, navigator.storage.getDirectory()) for large blobs.
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2,ttf}"],
        // SPA fallback so deep links resolve to the app shell when offline.
        navigateFallback: "/index.html",
        // The main renderer bundle is a few MB; raise the cap so the app shell
        // is fully precached rather than silently skipped.
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