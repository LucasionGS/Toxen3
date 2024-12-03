import { PanelDirection } from "../components/Sidepanel/Sidepanel"
import JSONX from "./JSONX";
import { Toxen } from "../ToxenApp";
import User from "./User";

export default class Settings {
  /**
   * Save Toxen's current settings.
   */
  public static async save(opts?: {
    suppressNotification?: boolean;
  }) {
    opts = opts || {};
    try {
      try {
        toxenapi.saveSettings(Settings);
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
      return toxenapi.loadSettings(Settings);
    });
  }

  public static applyDefaultSettings(overrideDefault?: Partial<ISettings>, forceReset?: boolean) {
    // Default settings for Toxen.
    const defaultSettings: Partial<ISettings> = {
      showAdvancedSettings: false,
      remoteServer: null,
      isRemote: !toxenapi.isDesktop(),
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
      visualizerPulseBackground: false,
      visualizerGlow: false,
      acceptedResponsibility: false,
      visualizerStyleOptions: {},
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

  private static officalStreamServer = "https://stream.toxen.net/api";

  public static getServer() {
    return (Settings.get("remoteServer") || Settings.officalStreamServer).replace(/\/+$/, ""); // Remove trailing slashes.
  }

  /**
   * Returns whether the current music folder is remote. For web, it will always return `true`.
   */
  public static isRemote(): boolean;
  /**
   * If the current music folder is a remote folder, return what is parsed, otherwise return `null`.  
   * Do not pass `null` to the function, as it would return `null` in both cases, rendering it useless.  
   * For web, it will always act as `true`.
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
    const isRemote = Settings.get("isRemote", false) || !toxenapi.isDesktop();
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
    if (!Settings.data) throw "No data to save.";
    return JSON.stringify(Settings.data, null, 2);
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


  public static get<T extends keyof ISettings>(key: T, fallback: ISettings[T]): ISettings[T];
  public static get<T extends string, ValueType = any>(key: T, fallback: ValueType): ValueType;
  public static get<T extends keyof ISettings>(key: T): ISettings[T] | undefined;
  public static get<T extends string, ValueType = any>(key: T): ValueType | undefined;
  public static get<T extends keyof ISettings>(key: T, fallback?: ISettings[T]): ISettings[T] | undefined {
    // if (Settings.data && Settings.data.hasOwnProperty(key)) return Settings.data[key];
    return JSONX.getObjectValue(Settings.data, key) ?? fallback;
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

    if (!toxenapi.isDesktop()) { toxenapi.throwDesktopOnly(); }
    
    opts = opts || {};
    const file = await toxenapi.remote.dialog.showOpenDialog({
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
    if (!toxenapi.isDesktop()) { toxenapi.throwDesktopOnly(); }
    
    opts = opts || {};
    const file = await toxenapi.remote.dialog.showOpenDialog({
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
    if (!toxenapi.isDesktop()) { toxenapi.throwDesktopOnly(); }
    
    opts = opts || {};
    const folder = await toxenapi.remote.dialog.showOpenDialog({
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
  visualizerStyleOptions: Partial<Record<VisualizerStyle, Record<string, any>>>;
  visualizerIntensity: number;
  visualizerNormalize: boolean;
  /**
   * @unimplemented
   */
  visualizerShuffle: boolean;
  visualizerRainbowMode: boolean;
  visualizerPulseBackground: boolean;
  visualizerGlow: boolean;
  backgroundDynamicLighting: boolean;
  fftSize: number;

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

  // Hue settings
  hueEnabled: boolean;
  hueBridgeIp: string;
  hueUsername: string;
  hueClientkey: string;
  hueEntertainmentAreaId: string;

  // Media downloader
  acceptedResponsibility: boolean;
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
  Waveform = "waveform",
  Orb = "orb",
};

export type VisualizerStyleOptionsTypes =
  | "range"
  | "boolean"

export interface VisualizerStyleOption {
  name: string;
  key: string;
  type: VisualizerStyleOptionsTypes;
  defaultValue?: any | (() => any);

  min?: number;
  max?: number;
  step?: number;
};
  
export const visualizerStyleOptions: Partial<Record<VisualizerStyle, VisualizerStyleOption[]>> = {
  [VisualizerStyle.Orb]: [
    {
      name: "X Position",
      key: "x",
      type: "range",
      defaultValue: -0.1,
      min: -0.1,
      max: 100,
      step: 0.1,
    },
    {
      name: "Y Position",
      key: "y",
      type: "range",
      defaultValue: -0.1,
      min: -0.1,
      max: 100,
      step: 0.1,
    },
    {
      name: "Size",
      key: "size",
      type: "range",
      defaultValue: 0,
      min: 0,
      max: 1000,
      step: 0.1,
    },
    {
      name: "Opaque",
      key: "opaque",
      type: "boolean",
      defaultValue: "",
    }
  ],
}

/**
 * A map of the `VisualizerStyle` to the `VisualizerStyleOption`.  
 * This is used to quickly get the options for a specific `VisualizerStyle` when order is not important.
 */
export const visualizerStyleOptionsMap: Partial<Record<VisualizerStyle, Record<string, VisualizerStyleOption>>> = {};
for (const key in visualizerStyleOptions) {
  if (Object.prototype.hasOwnProperty.call(visualizerStyleOptions, key)) {
    const options = visualizerStyleOptions[key as VisualizerStyle];
    const map: Record<string, VisualizerStyleOption> = {};
    for (const option of options) {
      map[option.key] = option;
    }
    visualizerStyleOptionsMap[key as VisualizerStyle] = map;
  }
}