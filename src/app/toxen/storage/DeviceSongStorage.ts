import { EventEmitter } from "events";
import type Song from "../Song";
import type { ISong } from "../Song";
import { SongStorage } from "./SongStorage";
import { DeviceFs } from "./device/DeviceFs";

/**
 * How many song folders `listSongs` reads at the same time.
 */
const LIST_CONCURRENCY = 16;

/**
 * Songs kept on this device by the web app, in the browser's Origin Private File System (see `DeviceFs`). Web only.
 *
 * Each song folder is named after the song's uid, so `paths.dirname` is always the uid. Files are reached through
 * same-origin `/__device/<uid>/<path>` URLs that the service worker answers from OPFS; media plays from an object URL
 * of the stored file instead (`mediaSource`), so playback works even before the service worker is in control.
 *
 * Every write emits `change`, like `LocalSongStorage`. Must not import `SyncEngine` or `Toxen` (UI); errors are
 * thrown, callers notify.
 */
export class DeviceSongStorage extends EventEmitter implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new DeviceSongStorage();

  public readonly kind = SongStorage.Kind.Device;

  /**
   * Set by `SongLibrary`. See `DeviceSongStorage.LibraryRules`.
   */
  private _rules: DeviceSongStorage.LibraryRules | null = null;

  /**
   * Whether this browser can keep songs on the device.
   */
  public static isAvailable(): boolean {
    return !toxenapi.isDesktop() && DeviceFs.isSupported();
  }

  /**
   * Set the library rules `listSongs` needs to repair song folders.
   */
  public setLibraryRules(rules: DeviceSongStorage.LibraryRules): void {
    this._rules = rules;
  }

  public fileUrl(song: Song, relPath: string): string {
    if (!relPath) return "";
    return this.fileLocation(song, relPath);
  }

  /**
   * The `/__device/<uid>/<path>` URL. Absolute paths (old playlist backgrounds) and full URLs are returned unchanged.
   */
  public fileLocation(song: Song, relPath?: string): string {
    const base = DeviceFs.URL_PREFIX + encodeURIComponent(song.uid);
    if (!relPath) return base;
    if (/^([a-z]+:)?\/\//i.test(relPath) || relPath.startsWith("/")) return relPath;
    return `${base}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  /**
   * An object URL of the stored file, for the audio element. Seeking works because the browser reads the file
   * directly.
   * @returns `null` if the file doesn't exist.
   */
  public async mediaSource(song: Song, relPath: string): Promise<{ url: string; revoke: () => void } | null> {
    const file = await DeviceFs.readFile(song.uid, relPath);
    if (!file) return null;
    const url = URL.createObjectURL(file);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }

  public async readText(song: Song, relPath: string): Promise<string | null> {
    const file = await DeviceFs.readFile(song.uid, relPath);
    return file ? file.text() : null;
  }

  public async readBlob(song: Song, relPath: string): Promise<Blob | null> {
    return DeviceFs.readFile(song.uid, relPath);
  }

  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    if (SongStorage.isDiskFile(data)) throw new Error("Files on disk can only be stored in the desktop library.");
    await DeviceFs.writeFile(song.uid, relPath, data);
    this.emit("change", { uid: song.uid, relPath, action: "write" });
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    await DeviceFs.deleteFile(song.uid, relPath);
    this.emit("change", { uid: song.uid, relPath, action: "delete" });
  }

  public async list(song: Song): Promise<SongStorage.FileEntry[]> {
    const files = await DeviceFs.list(song.uid);
    return files
      .filter(file => file.relPath !== SongStorage.INFO_FILE)
      .map(file => ({ relPath: file.relPath, size: file.size, mtimeMs: file.mtimeMs }));
  }

  public async saveInfo(song: Song): Promise<void> {
    const info = song.toISong();
    info.paths = { ...info.paths, dirname: song.uid };
    await DeviceFs.writeFile(song.uid, SongStorage.INFO_FILE, JSON.stringify(info));
    this.emit("change", { uid: song.uid, relPath: null, action: "info" });
  }

  public async deleteSong(song: Song): Promise<void> {
    await DeviceFs.deleteSong(song.uid);
    this.emit("change", { uid: song.uid, relPath: null, action: "song-deleted" });
  }

  /**
   * Whether a song has a folder on this device.
   */
  public async has(uid: string): Promise<boolean> {
    return Boolean(await DeviceFs.songDir(uid).catch((): null => null));
  }

  /**
   * Every song stored on this device. A folder without a readable `info.json` gets a new info built from its first
   * audio file; a folder with neither is left out and reported to `onSkip`.
   * @returns `[]` when the browser can't store songs.
   */
  public async listSongs(onEach?: (info: ISong) => void, onSkip?: (skipped: SongStorage.SkippedEntry) => void): Promise<ISong[]> {
    if (!DeviceSongStorage.isAvailable()) return [];
    const uids = await DeviceFs.listSongUids();
    const infos = await DeviceSongStorage._mapLimit(uids, LIST_CONCURRENCY, async (uid): Promise<ISong | null> => {
      let info: ISong;
      try {
        info = await this._loadFolder(uid);
      } catch (error) {
        console.error(`Skipped the device song "${uid}" because it can't be read.`, error);
        onSkip?.({ name: uid, error: error instanceof Error ? error : new Error(String(error)) });
        return null;
      }
      onEach?.(info);
      return info;
    });
    return infos.filter((info): info is ISong => info !== null);
  }

  public async countSongs(): Promise<number> {
    if (!DeviceSongStorage.isAvailable()) return 0;
    return (await DeviceFs.listSongUids()).length;
  }

  /**
   * Read (and if needed repair) the info of one song folder.
   * @throws If the folder has no usable info and no audio file to build one from.
   */
  private async _loadFolder(uid: string): Promise<ISong> {
    const rules = this._rules;
    if (!rules) throw new Error("DeviceSongStorage has no library rules. `SongLibrary` sets them when it is imported, so list songs through `SongLibrary`.");

    let info: ISong | null = null;
    let changed = false;
    const file = await DeviceFs.readFile(uid, SongStorage.INFO_FILE);
    if (file) {
      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) info = parsed as ISong;
      } catch {
        // Handled below like a missing info
      }
    }

    if (!info || !info.paths?.media) {
      const media = (await DeviceFs.list(uid)).find(stat => rules.isAudioFile(stat.relPath));
      if (!info) {
        if (!media) throw new Error("The song folder has no info and no audio file.");
        info = rules.buildInfo(uid, media.relPath);
        changed = true;
      }
      else if (media && !info.provider?.id) {
        info.paths = { ...info.paths, media: media.relPath };
        changed = true;
      }
    }

    if (info.uid !== uid || info.paths?.dirname !== uid) {
      info.uid = uid;
      info.paths = { ...info.paths, dirname: uid };
      changed = true;
    }
    if (changed) {
      info.hash = rules.newHash();
      await DeviceFs.writeFile(uid, SongStorage.INFO_FILE, JSON.stringify(info)).catch(error => {
        console.error(`Failed to save the repaired info of the device song "${uid}".`, error);
      });
    }
    return info;
  }

  /**
   * `Promise.all(items.map(fn))` with at most `limit` calls running at once. Results keep the order of `items`.
   */
  private static async _mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }
}

export interface DeviceSongStorage {
  // Device change (write, delete, info save, song delete)
  emit(event: "change", change: SongStorage.ChangeEvent): boolean;
  on(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  once(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  off(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
}

export namespace DeviceSongStorage {
  /**
   * Library knowledge `listSongs` needs but can't import (media formats and uid generation live in `Song` and `Toxen`).
   * `SongLibrary` sets them once, like `LocalSongStorage.LibraryRules`.
   */
  export interface LibraryRules {
    /**
     * A new info for a song folder that lost its `info.json`.
     * @param mediaPath Relative path of the audio file the song plays.
     */
    buildInfo(uid: string, mediaPath: string): ISong;
    /**
     * Whether a file can be picked as the media of a song that lost it. Matches extensions case-insensitively.
     */
    isAudioFile(relPath: string): boolean;
    /**
     * A fresh cache-busting hash for a repaired `info.json`.
     */
    newHash(): string;
  }
}

export default DeviceSongStorage;
