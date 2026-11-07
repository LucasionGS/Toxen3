import { EventEmitter } from "events";
import type Song from "../Song";
import type { ISong } from "../Song";
import Settings from "../Settings";
import { SongStorage } from "./SongStorage";
import type ToxenController from "../../../ToxenControllers/ToxenController";
import type DesktopController from "../../../ToxenControllers/DesktopController";
import type { DesktopIO } from "../../../ToxenControllers/DesktopIO";

/**
 * How many song folders `listSongs` reads at the same time (plan P4).
 */
const LIST_CONCURRENCY = 24;

/**
 * Song files in the local library directory. Desktop only: every method guards with `toxenapi.isDesktop()` and uses
 * `toxenapi.fs` / `toxenapi.path` / `toxenapi.atomicWriteFile`, never `node:` imports.
 *
 * Every write goes through here, so this is where the sync engine learns that a song changed: each write, delete and
 * info save emits `change`. That replaces the hand-kept `Song.setFile` / `song.files` bookkeeping.
 * Until the old sync is removed (Phase 4), writes and deletes also call `song.setFile()` so `song.files` stays correct.
 * Must not import `SyncEngine` or `Toxen` (UI); errors are thrown, callers notify.
 */
export class LocalSongStorage extends EventEmitter implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new LocalSongStorage();

  public readonly kind = SongStorage.Kind.Local;

  /**
   * Set by `SongLibrary`. See `LocalSongStorage.LibraryRules`.
   */
  private _rules: LocalSongStorage.LibraryRules | null = null;

  /**
   * Set the library rules `listSongs` needs to repair song folders.
   */
  public setLibraryRules(rules: LocalSongStorage.LibraryRules): void {
    this._rules = rules;
  }

  /**
   * Absolute path of the song folder: `<libraryDirectory>/<song.paths.dirname>`.
   * @throws If the song has no `paths.dirname`.
   */
  public songDir(song: Song): string {
    const api = LocalSongStorage._api("songDir");
    if (!song.paths?.dirname) throw new Error(`The song "${song.uid}" has no folder. Set \`paths.dirname\` before reading or writing its files.`);
    return api.path.resolve(Settings.get("libraryDirectory"), song.paths.dirname);
  }

  /**
   * Absolute path of a file in the song folder. Rejects paths that would leave the folder.
   */
  public filePath(song: Song, relPath: string): string {
    const api = LocalSongStorage._api("filePath");
    const dir = this.songDir(song);
    const full = api.path.resolve(dir, relPath);
    if (!full.startsWith(dir + api.path.sep)) {
      throw new Error(`"${relPath}" is not a file inside the folder of "${song.uid}". Use a path relative to the song folder.`);
    }
    return full;
  }

  public fileUrl(song: Song, relPath: string): string {
    if (!relPath) return "";
    return this.fileLocation(song, relPath) ?? "";
  }

  public fileLocation(song: Song, relPath?: string): string | null {
    const api = LocalSongStorage._api("fileLocation");
    if (!song.paths?.dirname) return null;
    return api.path.resolve(Settings.get("libraryDirectory"), song.paths.dirname, relPath ?? ".");
  }

  public async readText(song: Song, relPath: string): Promise<string | null> {
    const api = LocalSongStorage._api("readText");
    return api.fs.promises.readFile(this.filePath(song, relPath), "utf8").catch(LocalSongStorage._nullIfMissing);
  }

  public async readBlob(song: Song, relPath: string): Promise<Blob | null> {
    const api = LocalSongStorage._api("readBlob");
    const data = await api.fs.promises.readFile(this.filePath(song, relPath)).catch(LocalSongStorage._nullIfMissing);
    return data ? new Blob([new Uint8Array(data)]) : null;
  }

  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    const api = LocalSongStorage._api("writeFile");
    const target = this.filePath(song, relPath);
    await api.fs.promises.mkdir(api.path.dirname(target), { recursive: true });
    if (SongStorage.isDiskFile(data)) {
      if (api.path.resolve(data.diskPath) !== target) await api.fs.promises.copyFile(data.diskPath, target);
    }
    else {
      const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
      await api.atomicWriteFile(target, bytes);
    }
    song.setFile(relPath, "u");
    this.emit("change", { uid: song.uid, relPath, action: "write" });
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    const api = LocalSongStorage._api("deleteFile");
    await api.fs.promises.rm(this.filePath(song, relPath), { force: true });
    song.setFile(relPath, "d");
    this.emit("change", { uid: song.uid, relPath, action: "delete" });
  }

  public async list(song: Song): Promise<SongStorage.FileEntry[]> {
    const api = LocalSongStorage._api("list");
    const files = await api.listFilesRecursive(this.songDir(song)).catch((error): DesktopIO.FileStat[] => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
    return files
      .filter(file => file.relPath !== SongStorage.INFO_FILE)
      .map(file => ({ relPath: file.relPath, size: file.size, mtimeMs: file.mtimeMs }));
  }

  /**
   * Atomic write of `info.json`.
   */
  public async saveInfo(song: Song): Promise<void> {
    const api = LocalSongStorage._api("saveInfo");
    await api.atomicWriteFile(api.path.resolve(this.songDir(song), SongStorage.INFO_FILE), JSON.stringify(song.toISong()));
    this.emit("change", { uid: song.uid, relPath: null, action: "info" });
  }

  /**
   * Remove the song folder (retries once, as `Song.delete` did).
   */
  public async deleteSong(song: Song): Promise<void> {
    const api = LocalSongStorage._api("deleteSong");
    const dir = this.songDir(song);
    await api.fs.promises.rm(dir, { recursive: true, force: true })
      .catch(() => api.fs.promises.rm(dir, { recursive: true, force: true }));
    this.emit("change", { uid: song.uid, relPath: null, action: "song-deleted" });
  }

  /**
   * Every song folder in the library directory (folders starting with `.` are skipped), read in parallel.
   * Repairs folders on the way and writes the fixed `info.json` back:
   * - no readable `info.json`: a new info is built (`LibraryRules.buildInfo`),
   * - `paths.dirname` differs from the folder name (folder renamed or copied): it is corrected,
   * - no media and no provider: the first audio file found anywhere in the folder becomes the media.
   *
   * A folder that can't be read (permissions, or an `info.json` that can't be rebuilt) is left out and reported to
   * `onSkip`; it never fails the rest of the library.
   * @returns `[]` if no library directory is set.
   * @throws If the library directory can't be read.
   */
  public async listSongs(onEach?: (info: ISong) => void, onSkip?: (skipped: SongStorage.SkippedEntry) => void): Promise<ISong[]> {
    const api = LocalSongStorage._api("listSongs");
    const libraryDirectory = Settings.get("libraryDirectory");
    if (!libraryDirectory) return [];

    // `opendir` keeps the directory's own order (`readdir` sorts by name), which the song list order has always followed
    const folders: string[] = [];
    for await (const ent of await api.fs.promises.opendir(libraryDirectory)) {
      if (ent.isDirectory() && !ent.name.startsWith(".")) folders.push(ent.name);
    }
    const infos = await LocalSongStorage._mapLimit(folders, LIST_CONCURRENCY, async (folder): Promise<ISong | null> => {
      let info: ISong;
      try {
        info = await this._loadFolder(libraryDirectory, folder);
      } catch (error) {
        console.error(`Skipped the song folder "${folder}" because it can't be read.`, error);
        onSkip?.({ name: folder, error: error instanceof Error ? error : new Error(String(error)) });
        return null;
      }
      onEach?.(info);
      return info;
    });
    return infos.filter((info): info is ISong => info !== null);
  }

  /**
   * Number of song folders, without reading them.
   */
  public async countSongs(): Promise<number> {
    const api = LocalSongStorage._api("countSongs");
    const libraryDirectory = Settings.get("libraryDirectory");
    if (!libraryDirectory) return 0;
    const entries = await api.fs.promises.readdir(libraryDirectory, { withFileTypes: true });
    return entries.filter(ent => ent.isDirectory() && !ent.name.startsWith(".")).length;
  }

  /**
   * Read (and if needed repair) the info of one song folder.
   * @throws If the folder can't be read or its info can't be rebuilt.
   */
  private async _loadFolder(libraryDirectory: string, folder: string): Promise<ISong> {
    const api = LocalSongStorage._api("listSongs");
    const rules = this._rules;
    if (!rules) throw new Error("LocalSongStorage has no library rules. `SongLibrary` sets them when it is imported, so list songs through `SongLibrary`.");

    const dir = api.path.resolve(libraryDirectory, folder);
    const infoPath = api.path.resolve(dir, SongStorage.INFO_FILE);
    let info: ISong | null = null;
    let changed = false;
    try {
      const parsed: unknown = JSON.parse(await api.fs.promises.readFile(infoPath, "utf8"));
      // Valid JSON that isn't an info object (`null`, a number, an array) is as broken as invalid JSON
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) info = parsed as ISong;
    } catch {
      // Handled below like a missing info
    }
    if (!info) {
      console.error("Failed to load info.json file in song: " + dir);
      info = await rules.buildInfo(dir);
      changed = true;
    }

    if (!info.paths || typeof info.paths !== "object") info.paths = {} as ISong["paths"];
    if (info.paths.dirname !== folder) {
      info.paths.dirname = folder;
      changed = true;
    }

    if (!info.paths.media && !info.provider?.id) {
      const files = await api.listFilesRecursive(dir).catch((): { relPath: string }[] => []);
      const media = files.find(file => rules.isAudioFile(file.relPath));
      if (media) {
        info.paths.media = media.relPath;
        changed = true;
      }
    }

    if (changed) {
      await api.atomicWriteFile(infoPath, JSON.stringify(info)).catch(error => {
        console.error(`Failed to save repaired info.json in song: ${dir}`, error);
      });
    }
    return info;
  }

  /**
   * `toxenapi` narrowed to the desktop controller, or a desktop-only error.
   */
  private static _api(operation: string): DesktopController {
    if (toxenapi.isDesktop()) return toxenapi;
    return (toxenapi as ToxenController).throwDesktopOnly(`LocalSongStorage.${operation}`);
  }

  /**
   * `catch` handler: missing files become `null`, other errors are rethrown.
   */
  private static _nullIfMissing(error: NodeJS.ErrnoException): null {
    if (error?.code === "ENOENT") return null;
    throw error;
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

export interface LocalSongStorage {
  // Local change (write, delete, info save, song delete)
  emit(event: "change", change: SongStorage.ChangeEvent): boolean;
  on(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  once(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  off(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
}

export namespace LocalSongStorage {
  /**
   * Library knowledge `listSongs` needs but can't import, because media formats and uid generation live in `Song` and
   * `Toxen` (the UI layer). `SongLibrary` sets them once, the same way `CloudSongStorage.setManifestProvider` works.
   */
  export interface LibraryRules {
    /**
     * Build a new info for a song folder without a readable `info.json` (today `Song.buildInfo`).
     * @param folderPath Absolute path of the song folder.
     */
    buildInfo(folderPath: string): Promise<ISong>;
    /**
     * Whether a file can be picked as the media of a song that lost it. Matches extensions case-insensitively.
     */
    isAudioFile(relPath: string): boolean;
  }
}

export default LocalSongStorage;
