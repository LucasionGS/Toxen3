import fs from "fs";
import fsp from "fs/promises";
import Path from "path";
import CrossPlatform from "./CrossPlatform";
import { PanelDirection } from "../components/Sidepanel/Sidepanel"
import JSONX from "./JSONX";
import { Toxen } from "../ToxenApp";
import Settings from "./Settings";
import Legacy, { Toxen2Stats } from "./Legacy";

export default class Stats {
  /**
   * Path for the statistics file.
   */
  public static readonly filePath = CrossPlatform.getToxenDataPath("statistics.json");
  /**
   * Save Toxen's current statistics.
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
        let ws = fs.createWriteStream(Stats.filePath);
        ws.write(Buffer.from(Stats.toString()));
        ws.close();
      } catch (error) {
        console.error(error);
      }
    }
  }
  /**
   * Load Toxen's statistics from `filePath`.
   */
  public static async load(): Promise<IStatistics> {
    return Promise.resolve().then(async () => {
      if (Settings.isRemote()) {
        // Remote server
        throw "Loading remotely not yet implemented";
      }
      else {
        // Local
        if (!(await fsp.stat(Stats.filePath).then(() => true).catch(() => false))) {
          // Backwards compatibility.
          let oldStats = Legacy.toxen2StatisticsPath();
          debugger;
          if (oldStats) {
            try {
              let raw = await fsp.readFile(oldStats, "utf8");
              let data = JSON.parse(raw) as Toxen2Stats;
              Stats.data = {} as any;
              Stats.apply(await Legacy.toxen2StatsToStatistics(data));
            } catch (error) {
              console.error(error);
              Stats.data = {} as any;
            }
          }
          await Stats.save();
        }
        try {
          let data = await fsp.readFile(Stats.filePath, "utf8");
          return (Stats.data = JSON.parse(data));
        } catch (error) {
          throw "Unable to parse statistics file.";
        }
      }
    })
  }

  public static data: IStatistics;

  /**
   * Returns a stringified version of `IStatistics`.
   */
  public static toString() {
    return JSON.stringify(Stats.data ?? {}, null, 2);
  }

  /**
   * Applies the defined data to the IStatistics.
   */
  public static apply(data: Partial<IStatistics>) {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = (data as any)[key];
        JSONX.setObjectValue(Stats.data, key, value);
      }
    }
  }


  public static get<T extends keyof IStatistics>(key: T): IStatistics[T];
  public static get<T extends string, ValueType = any>(key: T): ValueType;
  public static get<T extends keyof IStatistics>(key: T): IStatistics[T] {
    return JSONX.getObjectValue(Stats.data, key);
  }

  public static set<T extends keyof IStatistics>(key: T, value: IStatistics[T]): IStatistics[T];
  public static set<T extends string, ValueType = any>(key: T, value: ValueType): ValueType;
  public static set<T extends keyof IStatistics>(key: T, value: IStatistics[T]): IStatistics[T] {
    JSONX.setObjectValue(Stats.data, key, value);
    return value;
  }
}

export interface IStatistics {
  secondsPlayed: number,
  songsPlayed: number;
}