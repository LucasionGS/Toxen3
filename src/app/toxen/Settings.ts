import fs from "fs";
import fsp from "fs/promises";
import Path from "path";
import CrossPlatform from "./CrossPlatform";
import { PanelDirection } from "../components/Sidepanel/Sidepanel"
import JSONX from "./JSONX";
import { Toxen } from "../ToxenApp";

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
  public static async save() {
    console.log("Saving...");

    if (Settings.isRemote()) {
      // Remote server
      throw "Saving remotely not yet implemented";
    }
    else {
      if (!(await fsp.stat(Settings.toxenDataPath).then(() => true).catch(() => false))) {
        await fsp.mkdir(Settings.toxenDataPath, { recursive: true });
      }
      try {
        let ws = fs.createWriteStream(Settings.filePath);
        ws.write(Buffer.from(Settings.toString()));
        ws.close();
      } catch (error) {
        console.error(error);
      }
    }
  }
  /**
   * Load Toxen's settings from `filePath`.
   */
  public static async load(): Promise<ISettings> {
    return Promise.resolve().then(async () => {
      if (Settings.isRemote()) {
        // Remote server
        throw "Loading remotely not yet implemented";
      }
      else {
        // Local
        if (!(await fsp.stat(Settings.filePath).then(() => true).catch(() => false))) {
          await Settings.save();
        }
        try {
          let data = await fsp.readFile(Settings.filePath, "utf8");
          return (Settings.data = JSON.parse(data));
        } catch (error) {
          throw "Unable to parse settings file.";
        }
      }
    })
  }

  public static isRemote() {
    return Boolean(
      Settings.data
      && Settings.data.libraryDirectory
      && (
        Settings.data.libraryDirectory.toLowerCase().startsWith("http://") ||
        Settings.data.libraryDirectory.toLowerCase().startsWith("https://")
      ));
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
  public static apply(data: Partial<ISettings>) {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = (data as any)[key];
        const preValue = JSONX.getObjectValue(Settings.data, key);

        JSONX.setObjectValue(Settings.data, key, value);

        // Special cases
        if (value !== preValue) {
          if (key === "libraryDirectory") Toxen.loadSongs();
        }
      }
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
}

export interface ISettings {
  // General settings
  libraryDirectory: string;
  isRemote: boolean;
  volume: number;

  // Panel settings
  panelVerticalTransition: boolean;
  panelDirection: PanelDirection;
  exposePanelIcons: boolean;
  panelWidth: number;

  // Window
  restoreWindowSize: boolean;
  windowWidth: number;
  windowHeight: number;

  // Visuals
  visualizerColor: string;
  visualizerStyle: VisualizerStyle;
  visualizerIntensity: number;
  visualizerRainbowMode: boolean;
}

export enum VisualizerStyle {
  None = "none",
  ProgressBar = "progressbar",
  Bottom = "bottom",
  Top = "top",
  TopAndBottom = "topbottom",
  Center = "center",
  Singularity = "circle",
  SingularityWithLogo = "circlelogo",
  MirroredSingularity = "mirroredsingularity",
  MirroredSingularityWithLogo = "mirroredsingularitywithlogo",
};