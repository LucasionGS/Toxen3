import os from "os";
import fs from "fs";
import fsp from "fs/promises";
import Path from "path";
import CrossPlatform from "./CrossPlatform";
import { PanelDirection } from "../components/Sidepanel/Sidepanel"
import JSONX from "./JSONX";
import { Toxen } from "../ToxenApp";
import User from "./User";
import { remote } from "electron";

export default class Settings {
  /**
   * Path for the Toxen data folder.
   */
  public static readonly toxenDataPath = CrossPlatform.getToxenDataPath();
  /**
   * Path for the settings file.
   */
  public static readonly filePath = CrossPlatform.getToxenDataPath("settings.json");
  /**
   * Save Toxen's current settings.
   */
  public static async save(opts?: {
    suppressNotification?: boolean;
  }) {
    opts = opts || {};
    if (!(await fsp.stat(Settings.toxenDataPath).then(() => true).catch(() => false))) {
      await fsp.mkdir(Settings.toxenDataPath, { recursive: true });
    }
    try {
      try {
        let ws = fs.createWriteStream(Settings.filePath);
        ws.write(Buffer.from(Settings.toString()));
        ws.close();
        if (!opts.suppressNotification) Toxen.notify({
          content: "Your settings have been saved.",
          expiresIn: 3000
        });
      } catch (error) {
        Toxen.notify({
          content: "Failed to save Settings",
          expiresIn: 5000,
          type: "error"
        });
      }
    } catch (error) {
      console.error(error);
      Toxen.notify({
        content: "Failed to save Settings",
        expiresIn: 5000,
        type: "error"
      });
    }
  }
  /**
   * Load Toxen's settings from `filePath`.
   */
  public static async load(): Promise<ISettings> {
    return Promise.resolve().then(async () => {
      if (!(await fsp.stat(Settings.filePath).then(() => true).catch(() => false))) {
        const musicPath = Path.resolve(os.homedir(), "Music", "ToxenMusic");
        if (await fsp.stat(musicPath).then(() => false).catch(() => true)) {
          await fsp.mkdir(musicPath, { recursive: true });
        }
        Settings.applyDefaultSettings({
          libraryDirectory: musicPath
        })
        await Settings.save();
      }
      try {
        let data = await fsp.readFile(Settings.filePath, "utf8");
        Settings.data = JSON.parse(data);
        Settings.applyDefaultSettings();
        return Settings.data;
      } catch (error) {
        throw "Unable to parse settings file";
      }
    })
  }

  public static applyDefaultSettings(overrideDefault?: Partial<ISettings>, forceReset?: boolean) {
    // Default settings for Toxen.
    const defaultSettings: Partial<ISettings> = {
      showAdvancedSettings: false,
      remoteServer: null,
      isRemote: false,
      volume: 50,
      exposePanelIcons: true,
      backgroundDynamicLighting: true,
      backgroundDim: 50,
      discordPresence: true,
      discordPresenceDetailed: true,
      panelDirection: "left",
      panelVerticalTransition: false,
      repeat: false,
      shuffle: false,
      visualizerRainbowMode: false,
      pauseWithClick: true,
      visualizerPulseBackground: false
    };

    let toUse: Partial<ISettings> = {};
    for (const key in defaultSettings) {
      if (!forceReset && Settings.data && key in Settings.data) continue;
      (toUse as any)[key] = (defaultSettings as any)[key];
    }
    toUse = Object.assign(toUse, overrideDefault || {});

    Settings.apply(toUse);
    // if (overrideDefault) Settings.apply(overrideDefault);
  }

  private static officalStreamServer = "https://stream.toxen.net";

  public static getServer() {
    return (Settings.get("remoteServer") || Settings.officalStreamServer).replace(/\/+$/, ""); // Remove trailing slashes.
  }

  /**
   * Returns whether the current music folder is remote.
   */
  public static isRemote(): boolean;
  /**
   * If the current music folder is a remote folder, return what is parsed, otherwise return `null`.  
   * Do not pass `null` to the function, as it would return `null` in both cases, rendering it useless.
   */
  public static isRemote<T>(toReturn: T): T;
  public static isRemote<T>(toReturn?: T): T | boolean {
    // const isRemote = Boolean(
    //   Settings.data
    //   && Settings.data.libraryDirectory
    //   && (
    //     Settings.data.libraryDirectory.toLowerCase().startsWith("http://")
    //     || Settings.data.libraryDirectory.toLowerCase().startsWith("https://")
    //     || Settings.data.libraryDirectory.toLowerCase().startsWith("tx://")
    //     || Settings.data.libraryDirectory.toLowerCase().startsWith("txs://")
    //   ));
    const isRemote = Settings.get("isRemote") ?? false;
    if (toReturn === undefined) return isRemote;
    return isRemote ? toReturn : null;
  }

  /**
   * Returns if the `showAdvancedSettings` option is enabled.
   */
  public static isAdvanced(): boolean;
  /**
   * If the `showAdvancedSettings` option is enabled, return what is parsed, otherwise return `null`.  
   * Do not pass `null` to the function, as it would return `null` in both cases, rendering it useless.
   */
  public static isAdvanced<T>(toReturn: T): T;
  public static isAdvanced<T>(toReturn?: T): T | boolean {
    if (toReturn === undefined) return Boolean(Settings.get("showAdvancedSettings"));
    return Settings.get("showAdvancedSettings") ? toReturn : null;
    // return toReturn;
  }

  public static data: ISettings;

  /**
   * Returns a stringified version of `ISettings`.
   */
  public static toString() {
    return JSON.stringify(Settings.data ?? {}, null, 2);
  }

  /**
   * Applies the defined data to the ISettings.
   */
  public static async apply(data: Partial<ISettings>, save?: boolean) {
    if (!Settings.data) Settings.data = {} as ISettings;
    let key: keyof ISettings;
    for (key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        const preValue = JSONX.getObjectValue(Settings.data, key);

        JSONX.setObjectValue(Settings.data, key, value);

        // Special cases
        if (value !== preValue) {
          if (key === "libraryDirectory") {
            Toxen.loadSongs();
          }
          else if (key === "isRemote") {
            Toxen.loadSongs();
          }
          else if (key === "theme") Toxen.setThemeByName(value as typeof data[typeof key]);
        }
      }
    }

    if (save) {
      await Settings.save({
        suppressNotification: true
      });
      Toxen.updateSettings();
    }
  }


  public static get<T extends keyof ISettings>(key: T): ISettings[T];
  public static get<T extends string, ValueType = any>(key: T): ValueType;
  public static get<T extends keyof ISettings>(key: T): ISettings[T] {
    // if (Settings.data && Settings.data.hasOwnProperty(key)) return Settings.data[key];
    return JSONX.getObjectValue(Settings.data, key);
  }

  public static set<T extends keyof ISettings>(key: T, value: ISettings[T]): ISettings[T];
  public static set<T extends string, ValueType = any>(key: T, value: ValueType): ValueType;
  public static set<T extends keyof ISettings>(key: T, value: ISettings[T]): ISettings[T] {
    // if (Settings.data && Settings.data.hasOwnProperty(key)) return Settings.data[key] = value;
    JSONX.setObjectValue(Settings.data, key, value);
    return value;
  }

  public static getUser() {
    return User.getCurrentUser();
  }

  /**
   * Select a file from the file system.
   */
  public static async selectFile(opts?: Electron.OpenDialogOptions) {
    opts = opts || {};
    const file = await remote.dialog.showOpenDialog({
      ...opts,
      properties: ["openFile"],
    });

    if (file && file.filePaths && file.filePaths.length > 0) {
      return file.filePaths[0];
    }
    return null;
  }

  /**
   * Select multiple of files from the file system.
   */
  public static async selectFiles(opts?: Electron.OpenDialogOptions) {
    opts = opts || {};
    const file = await remote.dialog.showOpenDialog({
      ...opts,
      properties: ["openFile"],
    });

    if (file && file.filePaths && file.filePaths.length > 0) {
      return file.filePaths;
    }

    return [];
  }

  /**
   * Select a folder from the file system.
   */
  public static async selectFolder(opts?: Electron.OpenDialogOptions) {
    opts = opts || {};
    const folder = await remote.dialog.showOpenDialog({
      ...opts,
      properties: ["openDirectory"],
    });

    if (folder && folder.filePaths && folder.filePaths.length > 0) {
      return folder.filePaths[0];
    }
    return null;
  }
}

export interface ISettings {
  // General settings
  libraryDirectory: string;
  isRemote: boolean;
  volume: number;
  repeat: boolean;
  shuffle: boolean;

  // Panel settings
  panelVerticalTransition: boolean;
  panelDirection: PanelDirection;
  exposePanelIcons: boolean;
  panelWidth: number;
  sidepanelBackground: string;

  // Window
  restoreWindowSize: boolean;
  windowWidth: number;
  windowHeight: number;

  // Controls
  pauseWithClick: boolean;

  // Visuals
  theme: string;
  visualizerColor: string;
  visualizerStyle: VisualizerStyle;
  visualizerIntensity: number;
  visualizerRainbowMode: boolean;
  visualizerPulseBackground: boolean;
  backgroundDynamicLighting: boolean;

  // Backgrounds
  defaultBackground: string;
  backgroundDim: number;

  // Advanced settings & UI
  showAdvancedSettings: boolean;
  remoteServer: string;
  progressBarShowMs: boolean;

  // Discord
  discordPresence: boolean;
  discordPresenceDetailed: boolean;
}

export enum VisualizerStyle {
  None = "none",
  ProgressBar = "progressbar",
  Bottom = "bottom",
  Top = "top",
  TopAndBottom = "topbottom",
  Sides = "sides",
  Center = "center",
  Singularity = "circle",
  SingularityWithLogo = "circlelogo",
  MirroredSingularity = "mirroredsingularity",
  MirroredSingularityWithLogo = "mirroredsingularitywithlogo",
};