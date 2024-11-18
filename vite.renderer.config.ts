import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import react from "@vitejs/plugin-react-swc";
import path from "path";
import renderer from "vite-plugin-electron-renderer";
import toxenApi from './vite_toxen_plugin';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
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
