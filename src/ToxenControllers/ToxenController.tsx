import type DesktopController from "./DesktopController";
import type Settings from "../app/toxen/Settings";
import { ISettings } from "../app/toxen/Settings";
import type Stats from "../app/toxen/Statistics";
import { IStatistics } from "../app/toxen/Statistics";
import type Theme from "../app/toxen/Theme";
import type Song from "../app/toxen/Song";
import { Toxen } from "../app/ToxenApp";
import User from "../app/toxen/User";

/**
 * Implementation of Toxen Controller for the web version. DesktopController should be used for desktop-specific functions and overwrites.
 */
export default class ToxenController {
  public isDesktop(): this is DesktopController {
    return false;
  }

  // Global tools / Polyfills

  public getFileExtension(filePath: string) {
    const baseName = filePath.split('/').pop().split('\\').pop(); // Handle both '/' and '\' separators
    const dotIndex = baseName.lastIndexOf('.');
    return dotIndex > 0 ? baseName.slice(dotIndex) : '';
  }
  
  /**
   * Throws an error if the ToxenController isn't the desktop version.
   */
  public throwDesktopOnly(hint?: string): never {
    throw "@DESKTOPONLY This function is only available on the desktop version of Toxen." + (hint ? " (" + hint : ")");
  }

  public async saveSettings(settings: typeof Settings) {
    this.throwDesktopOnly("saveSettings");
  }

  public async loadSettings(settings: typeof Settings): Promise<ISettings> {
    this.throwDesktopOnly("loadSettings");
  }

  public async saveStats(stats: typeof Stats) {
    this.throwDesktopOnly("saveStats");
  }

  public async loadStats(stats: typeof Stats): Promise<IStatistics> {
    this.throwDesktopOnly("loadStats");
  }

  public async saveTheme(theme: Theme) {
    this.throwDesktopOnly("saveTheme");
  }

  public async loadThemes(theme: typeof Theme): Promise<Theme[]> {
    this.throwDesktopOnly("loadThemes");
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   */
  public loadThemeExternalCSS(theme: Theme) {
    this.throwDesktopOnly("loadThemeExternalCSS");
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