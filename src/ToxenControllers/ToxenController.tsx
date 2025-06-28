import type DesktopController from "./DesktopController";
import type Settings from "../app/toxen/Settings";
import { ISettings } from "../app/toxen/Settings";
import type Stats from "../app/toxen/Statistics";
import { IStatistics } from "../app/toxen/Statistics";
import type Theme from "../app/toxen/Theme";
import type Song from "../app/toxen/Song";
import type { Toxen } from "../app/ToxenApp";
import type User from "../app/toxen/User";
import type { SongDiff } from "../app/toxen/Song";
import { showNotification } from "@mantine/notifications";

/**
 * Implementation of Toxen Controller for the web version. DesktopController should be used for desktop-specific functions and overwrites.
 */
export default class ToxenController {
  public isDesktop(): this is DesktopController {
    return false;
  }

  /**
   * Alias for `!$settings.isRemote() && this.isDesktop()`.
   * @returns True if the ToxenController is the desktop version and not remote using remote libraries.
   */
  public isLocal($settings: typeof Settings): this is DesktopController {
    return !$settings.isRemote() && this.isDesktop();
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
    showNotification({
      title: "Desktop Only",
      message: "This function is only available on the desktop version of Toxen." + (hint ? " (" + hint + ")" : ""),
      color: "red",
    });
    throw "@DESKTOPONLY This function is only available on the desktop version of Toxen." + (hint ? " (" + hint + ")" : "");
  }

  /**
   * Logs a warning if the ToxenController isn't the desktop version.
   */
  public warnDesktopOnly(hint?: string) {
    console.warn("@DESKTOPONLY This function is only available on the desktop version of Toxen." + (hint ? " (" + hint : ""));
  }

  public async saveSettings($settings: typeof Settings) {
    window.localStorage.setItem("toxen.settings", $settings.toString());
  }

  public async loadSettings($settings: typeof Settings): Promise<ISettings> {
    if (window.localStorage.getItem("toxen.settings") == null) {
      $settings.applyDefaultSettings();
      await $settings.save();
      return $settings.data;
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

  public async saveTheme(theme: Theme): Promise<void> {
    // Web version: save themes to localStorage
    try {
      const existingThemes = this.getStoredThemes();
      const themeIndex = existingThemes.findIndex(t => t.name === theme.name);
      
      if (themeIndex !== -1) {
        // Update existing theme
        existingThemes[themeIndex] = theme;
      } else {
        // Add new theme
        existingThemes.push(theme);
      }
      
      localStorage.setItem('toxen_themes', JSON.stringify(existingThemes));
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
      throw new Error('Failed to save theme');
    }
  }

  public async loadThemes($theme: typeof Theme): Promise<Theme[]> {
    // Web version: load themes from localStorage
    try {
      const storedThemes = this.getStoredThemes();
      return storedThemes.map(themeData => $theme.create(themeData));
    } catch (error) {
      console.error('Failed to load themes from localStorage:', error);
      return [];
    }
  }

  private getStoredThemes(): any[] {
    try {
      const stored = localStorage.getItem('toxen_themes');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse stored themes:', error);
      return [];
    }
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   * Web version: No external CSS files, customCSS is stored in the theme JSON in localStorage
   */
  public loadThemeExternalCSS(theme: Theme) {
    // Web version: customCSS is already included in the theme JSON from localStorage
    // No external files needed - everything is stored in memory/localStorage
    // This is intentionally a no-op for web
  }

  /**
   * Export one or more songs into a zip file.
   * @param songs 
   */
  public async exportLocalSongs(...songs: Song[]) {
    this.throwDesktopOnly("exportLocalSongs");
  }

  public async syncSong($toxen: typeof Toxen, user: User, song: Song, diff: SongDiff, { silenceValidated }: { silenceValidated?: boolean; }): Promise<void> {
    this.throwDesktopOnly("syncSong");
  }

  public async validateSongAgainstRemote($toxen: Toxen, user: User, song: Song): Promise<boolean> {
    this.throwDesktopOnly("validateSongAgainstRemote");
  }

  public async compareLocalSongsAgainstRemote($toxen: typeof Toxen, user: User, data: any): Promise<{
    result: Record<string, SongDiff>
  }> {
    this.throwDesktopOnly("fetchRemoteSongsData");
  }

  /**
   * Export a theme as a downloadable .theme.json file
   * Web version: Creates a blob and triggers browser download
   */
  public async exportTheme(theme: Theme): Promise<void> {
    try {
      // Create the theme data object
      const themeData = {
        name: theme.name,
        displayName: theme.displayName,
        description: theme.description,
        styles: theme.styles,
        customCSS: theme.customCSS || ""
      };

      // Convert to JSON string with formatting
      const jsonString = JSON.stringify(themeData, null, 2);

      // Create blob for download
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create download URL
      const url = URL.createObjectURL(blob);
      
      // Create temporary download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${theme.name}.theme.json`;
      downloadLink.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up URL
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Failed to export theme:', error);
      throw new Error('Failed to export theme');
    }
  }
}

// Inject the ToxenController into the window object type.
declare global {
  interface Window {
    toxenapi: ToxenController;
  }
  let toxenapi: ToxenController;
}