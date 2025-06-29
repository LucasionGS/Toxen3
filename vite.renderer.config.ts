import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import react from "@vitejs/plugin-react-swc";
import path from "path";
import renderer from "vite-plugin-electron-renderer";
import toxenApi from './vite_toxen_plugin';
import sass, { SassString } from "sass";

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    css: {
      preprocessorOptions: {
        scss: {
          functions: {
            "ToxenIsWeb()": () => {
              const val = process.env["TOXEN_IS_WEB"] === "true" ? sass.types.Boolean.TRUE : sass.types.Boolean.FALSE;
              // const val = sass.types.Boolean.TRUE;
              return val;
            }
          }
        },
      }
    },
    root,
    mode,
    base: './',
    build: {
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
      alias: {
        'node-aead-crypto': path.resolve(__dirname, './emptyModule.js'),
      }
    },
    clearScreen: false,
  } as UserConfig;
});
