import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react-swc";
import path from "path";
import toxenApi from './vite_toxen_plugin';

// https://vitejs.dev/config
export default defineConfig({
  base: './',
  build: {
    outDir: 'buildweb',
    chunkSizeWarningLimit: 4096,
  },
  plugins: [
    toxenApi("web"),
    react(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      'node-aead-crypto': path.resolve(__dirname, './emptyModule.js'),
    }
  },
  clearScreen: false,
} as UserConfig);