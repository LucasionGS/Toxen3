import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

/**
 * Packages that are loaded with a runtime `require()` instead of being bundled,
 * so Vite never sees them and cannot inline them into the renderer.
 * Currently just the Discord Rich Presence client and its transitive deps —
 * it is a Node-only CJS package that breaks when pre-bundled for the browser.
 *
 * Forge's Vite plugin ignores everything outside `/.vite` when packaging, and
 * since 7.5 it no longer copies dependencies into the app either, so without
 * this list the require() resolves to nothing in a packaged build and takes the
 * whole renderer down with it. Keep in sync with the dependency tree of
 * discord-rpc-electron (node-fetch and ws, plus whatwg-url's chain) and of
 * node-dtls-client (debug -> ms, semver), used for Hue Entertainment streaming.
 */
const runtimeRequiredModules = [
  'discord-rpc-electron',
  'node-fetch',
  'ws',
  'whatwg-url',
  'tr46',
  'webidl-conversions',
  'node-dtls-client',
  'debug',
  'ms',
  'semver',
];

const config: ForgeConfig = {
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "LucasionGS",
          name: "Toxen3"
        },
        draft: false,
        prerelease: false
      }
    }
  ],
  packagerConfig: {
    asar: true,
    icon: './src/icons/sizes/icon.ico',
    executableName: 'toxen3',
    // Defining this ourselves stops the Vite plugin installing its own filter,
    // which keeps only `/.vite`. Same behaviour, plus the runtime-require'd
    // modules above. Paths always start with '/'.
    ignore: (file: string) => {
      if (!file) return false;
      if (file.startsWith('/.vite')) return false;
      if (file === '/node_modules') return false;
      return !runtimeRequiredModules.some(
        (m) => file === `/node_modules/${m}` || file.startsWith(`/node_modules/${m}/`)
      );
    },
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({
    name: 'toxen3',
    authors: 'Lucasion',
    description: 'Toxen Music Player',
    setupIcon: './src/icons/toxen.ico',
    exe: 'toxen3.exe',
  }), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
