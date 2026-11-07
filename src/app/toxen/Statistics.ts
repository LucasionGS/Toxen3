import JSONX from "./JSONX";
import { Toxen } from "../ToxenApp";
import EventEmitter from "events";

export class StatsEventEmitter extends EventEmitter { }

export default class Stats {
  /**
   * Save Toxen's current statistics.
   */
  public static async save() {
    localStorage.setItem("statistics-backup", Stats.toString());
    try {
      await toxenapi.saveStats(Stats);
      Stats.events.emit("saved", {
        savedAt: Date.now()
      });
    } catch (error) {
      Toxen.error(error);
    }
  }
  /**
   * Load Toxen's statistics from the statistics's filepath. Never throws: if the file can't be read or is damaged, the
   * last backup (kept in `localStorage` on every save) is used, or the statistics start over, and the user is warned.
   * Unreadable statistics must not block startup.
   */
  public static async load(): Promise<IStatistics> {
    try {
      return await toxenapi.loadStats(Stats);
    } catch (error) {
      console.error("Unable to load the statistics file.", error);
      const reason = error?.message ?? String(error);
      const backup = Stats._parseBackup();
      if (backup) {
        Toxen.warn(`${reason} Your statistics were restored from the last backup.`, 10000);
        return Stats.data = backup;
      }
      Toxen.warn(`${reason} Your statistics start over.`, 10000);
      return Stats.data = {} as IStatistics;
    }
  }

  /**
   * The `localStorage` backup written by `save()`, or `null` if there is none or it can't be parsed.
   */
  private static _parseBackup(): IStatistics | null {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem("statistics-backup") ?? "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as IStatistics : null;
    } catch {
      return null;
    }
  }

  public static data: IStatistics;

  public static events: StatsEventEmitter = new StatsEventEmitter({});

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
    Stats.events.emit("changed", {});
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
    Stats.events.emit("changed", {});
    return value;
  }
}

export interface StatsEventEmitter extends EventEmitter {
  addListener<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  on<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  once<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  removeListener<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  off<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  removeAllListeners<TEvent extends keyof StatsEvents>(event?: TEvent): this;
  listeners<TEvent extends keyof StatsEvents>(event: TEvent): Function[];
  rawListeners<TEvent extends keyof StatsEvents>(event: TEvent): Function[];
  emit<TEvent extends keyof StatsEvents>(event: TEvent, args: StatsEvents[TEvent]): boolean;
  listenerCount<TEvent extends keyof StatsEvents>(event: TEvent): number;
  prependListener<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
  prependOnceListener<TEvent extends keyof StatsEvents>(event: TEvent, listener: (args: StatsEvents[TEvent]) => void): this;
}

interface StatsEvents {
  "changed": {};
  "saved": { savedAt: number };
  "loaded": [number, string];
}

export interface IStatistics {
  secondsPlayed: number,
  songsPlayed: number;
  timesOpened: number;
  totalDuration: number;
}