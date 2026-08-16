import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import react from "@vitejs/plugin-react-swc";
import renderer from "vite-plugin-electron-renderer";
import toxenApi from './vite_toxen_plugin';
import sass from "sass";

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    css: {
      preprocessorOptions: {
        scss: {
          // Modern sass API. The legacy JS API (sass.types.*) was removed in Vite 7
          // and is deprecated in Dart Sass; custom functions must return sass.Value.
          api: 'modern-compiler',
          functions: {
            "ToxenIsWeb()": () => {
              return process.env["TOXEN_IS_WEB"] === "true" ? sass.sassTrue : sass.sassFalse;
            }
          }
        },
      }
    },
    root,
    mode,
    base: './',
    build: {
      // Electron 43 renderer runs Chromium 150. Pinned explicitly because Vite 7
      // defaults to 'baseline-widely-available', which downlevels for stale browsers.
      target: 'chrome150',
      outDir: `.vite/renderer/${name}`,
      chunkSizeWarningLimit: 4096,
    },
    plugins: [
      toxenApi("desktop"),
      renderer(),
      react(),
      pluginExposeRenderer(name)
    ],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  } as UserConfig;
});
