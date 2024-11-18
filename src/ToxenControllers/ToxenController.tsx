import type DesktopController from "./DesktopController";
import type Settings from "../app/toxen/Settings";
import { ISettings } from "../app/toxen/Settings";
import type Stats from "../app/toxen/Statistics";
import { IStatistics } from "../app/toxen/Statistics";
import type Theme from "../app/toxen/Theme";
import type Song from "../app/toxen/Song";
import type { Toxen } from "../app/ToxenApp";
import type User from "../app/toxen/User";

/**
 * Implementation of Toxen Controller for the web version. DesktopController should be used for desktop-specific functions and overwrites.
 */
export default class ToxenController {
  public isDesktop(): this is DesktopController {
    return false;
  }

  // Global tools / Polyfills

  public packageJson: {
    version: string;
    name: string;
    description: string;
    dependencies: {
      [key: string]: string;
    };
    devDependencies: {
      [key: string]: string;
    };
  } = {
    version: "0.0.0",
    name: "Toxen",
    description: "Toxen",
    dependencies: {},
    devDependencies: {},
  }

  public getBasename(filePath: string, ext?: string) {
    const basename = filePath.split('/').pop().split('\\').pop(); // Handle both '/' and '\' separators
    return ext ? basename.slice(0, basename.length - ext.length) : basename;
  }
  
  public getFileExtension(filePath: string) {
    const baseName = this.getBasename(filePath);
    const lastDot = baseName.lastIndexOf('.');
    return lastDot > 0 ? baseName.slice(lastDot) : "";
  }

  /**
   * Joins multiple paths together and normalizes the path.
   * @returns The normalized path.
   */
  public joinPath(...paths: string[]) {
    return paths.join("/").replace(/\/+/g, "/");
  }
  
  /**
   * Throws an error if the ToxenController isn't the desktop version.
   */
  public throwDesktopOnly(hint?: string): never {
    throw "@DESKTOPONLY This function is only available on the desktop version of Toxen." + (hint ? " (" + hint : ")");
  }

  public async saveSettings($settings: typeof Settings) {
    window.localStorage.setItem("toxen.settings", $settings.toString());
  }

  public async loadSettings($settings: typeof Settings): Promise<ISettings> {
    if (window.localStorage.getItem("toxen.settings") == null) {
      $settings.applyDefaultSettings();
      await $settings.save();
    }
    try {
      let data = window.localStorage.getItem("toxen.settings");
      $settings.data = JSON.parse(data);
      $settings.applyDefaultSettings();
      return $settings.data;
    } catch (error) {
      // throw "Unable to parse settings file";
      console.error("Unable to parse settings file", error);
      $settings.data = {} as any;
      $settings.applyDefaultSettings();
      return $settings.data;
    }
  }

  public async saveStats(stats: typeof Stats) {
    window.localStorage.setItem("toxen.stats", stats.toString());
  }

  public async loadStats(stats: typeof Stats): Promise<IStatistics> {
    if (window.localStorage.getItem("toxen.stats") == null) {
      await stats.save();
    }
    try {
      let data = window.localStorage.getItem("toxen.stats");
      stats.data = JSON.parse(data);
      return stats.data;
    } catch (error) {
      throw "Unable to parse stats file";
    }
  }

  public async saveTheme(theme: Theme) {
    this.throwDesktopOnly("saveTheme");
  }

  public async loadThemes(theme: typeof Theme): Promise<Theme[]> {
    console.warn("Loading themes is not available on the web version yet.");
    return []; // No themes available on web version yet
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   */
  public loadThemeExternalCSS(theme: Theme) {
    // this.throwDesktopOnly("loadThemeExternalCSS");
    console.warn("Loading external CSS is not available on the web version yet.");
  }

  /**
   * Export one or more songs into a zip file.
   * @param songs 
   */
  public async exportLocalSongs(...songs: Song[]) {
    this.throwDesktopOnly("exportLocalSongs");
  }

  public async syncSong($toxen: typeof Toxen, user: User, song: Song, { silenceValidated }: { silenceValidated?: boolean; }): Promise<void> {
    this.throwDesktopOnly("syncSong");
  }

  public async validateSongAgainstRemote($toxen: Toxen, user: User, song: Song): Promise<boolean> {
    this.throwDesktopOnly("validateSongAgainstRemote");
  }
}

// Inject the ToxenController into the window object type.
declare global {
  interface Window {
    toxenapi: ToxenController;
  }
  let toxenapi: ToxenController;
}