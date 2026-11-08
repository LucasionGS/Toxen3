import type Song from "../Song";
import type { ISong } from "../Song";

/**
 * Where a song's files live and how to reach them. Replaces the `Settings.isRemote()` branches in `Song` and friends
 * (plan §2.2). The implementations are stateless singletons that take the song as an argument:
 * - `LocalSongStorage` (desktop only): the song folder in the library directory, through `toxenapi`.
 * - `CloudSongStorage` (web and desktop): the server. v1 endpoints in Phase 1, `/v2` (`SyncApi`) from Phase 4.
 * - `DeviceSongStorage` (web only): songs kept on the phone or computer in the browser's private storage.
 *
 * Pick one with `StorageSelector.forSong(song)` (exposed as `song.storage`), never by checking settings yourself.
 * Paths are relative to the song folder and use `/`.
 */
export interface SongStorage {
  readonly kind: SongStorage.Kind;

  //#region Per song

  /**
   * A source the renderer can load directly (`<audio src>`, `<img src>`, `new Image()`), or `""` when `relPath` is empty.
   * Local: the absolute disk path, as `Song.mediaFile()` returns today (wrap with `file://` for CSS `url()`).
   * Cloud: the authenticated URL (`?token=` in Phase 1, a signed `?u=&exp=&sig=` URL from Phase 4), so callers no longer
   * call `User.appendAuth` themselves.
   */
  fileUrl(song: Song, relPath: string): string;

  /**
   * Where a file lives, without authentication: the absolute disk path (local) or the plain server URL (cloud).
   * This is what `Song.dirname()`, `mediaFile()`, `backgroundFile()` and friends return, so it is safe to compare,
   * append `?h=` to and read extensions from. Load files through `fileUrl` instead.
   * @param relPath Relative path, or nothing for the song folder itself. Not checked for containment (playlist backgrounds
   * may be absolute paths).
   * @returns `null` if the song has no folder (local song without `paths.dirname`).
   */
  fileLocation(song: Song, relPath?: string): string | null;

  /**
   * Read a text file (subtitles, storyboard).
   * @returns The text, or `null` if the file doesn't exist. Never hangs: network and disk errors reject.
   */
  readText(song: Song, relPath: string): Promise<string | null>;

  /**
   * Read a binary file (copying images between songs, exporting).
   * @returns The bytes, or `null` if the file doesn't exist.
   */
  readBlob(song: Song, relPath: string): Promise<Blob | null>;

  /**
   * A media source the storage hands out itself instead of `fileUrl` (device storage: an object URL of the stored
   * file). Call `revoke` once the player is done with it.
   * @returns `null` if the file doesn't exist. Storages without it use `fileUrl`.
   */
  mediaSource?(song: Song, relPath: string): Promise<{ url: string; revoke: () => void } | null>;

  /**
   * Create or replace a file. Local writes are atomic for strings and bytes, and copy from disk for `DiskFile`.
   * Local writes emit a `change` event so the sync engine picks them up (this replaces `Song.setFile`).
   */
  writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void>;

  /**
   * Delete a file. Missing files are not an error.
   */
  deleteFile(song: Song, relPath: string): Promise<void>;

  /**
   * Every file of the song except `info.json`.
   */
  list(song: Song): Promise<SongStorage.FileEntry[]>;

  /**
   * Persist `song.toISong()` as the song's info (local `info.json`, cloud info).
   * @throws If it couldn't be saved. Callers decide how to notify (`Toxen.error`).
   */
  saveInfo(song: Song): Promise<void>;

  /**
   * Delete the song's copy in this storage only. "Delete everywhere" is `SongLibrary.delete(song, "everywhere")`.
   */
  deleteSong(song: Song): Promise<void>;

  //#endregion

  //#region Library

  /**
   * Every song info in this storage. Local: the library directory (today `toxenapi.loadLocalSongs`). Cloud: the
   * server's track list. Infos without playable media are included; `SongLibrary` decides what to do with them.
   * @param onEach Called exactly once for every info in the result, as it loads (loading screen progress).
   * @param onSkip Called once for every entry that couldn't be read and is left out of the result (local: an
   * unreadable song folder or a broken `info.json` that can't be rebuilt). One bad entry never fails the whole listing.
   * @throws If the library itself can't be listed.
   */
  listSongs(onEach?: (info: ISong) => void, onSkip?: (skipped: SongStorage.SkippedEntry) => void): Promise<ISong[]>;

  /**
   * Number of songs, cheaper than `listSongs` where possible (loading screen total).
   */
  countSongs(): Promise<number>;

  //#endregion
}

export namespace SongStorage {
  export enum Kind {
    Local = "local",
    Cloud = "cloud",
    /**
     * Web only: stored in the browser on this device.
     */
    Device = "device",
  }

  /**
   * The song's info file. Never part of `list()` or a sync manifest; it travels as `info`.
   */
  export const INFO_FILE = "info.json";

  export interface FileEntry {
    /**
     * Relative path with `/` separators.
     */
    relPath: string;
    /**
     * Unit is in bytes. `0` when unknown (the v1 server listing only has names).
     */
    size: number;
    /**
     * Local: file mtime. Cloud: server `receivedAt`. Unix ms. `0` when unknown.
     */
    mtimeMs: number;
    /**
     * Known for cloud files (from the manifest) and for local files with a cached hash.
     */
    sha256?: string;
  }

  /**
   * A file already on disk, copied (local) or streamed (cloud) without reading it into memory. Desktop only.
   */
  export interface DiskFile {
    diskPath: string;
  }

  /**
   * A library entry `listSongs` left out because it couldn't be read.
   */
  export interface SkippedEntry {
    /**
     * Local: the song folder name. Cloud: the track uid.
     */
    name: string;
    error: Error;
  }

  /**
   * What `writeFile` accepts.
   */
  export type WriteData = string | Uint8Array | Blob | DiskFile;

  /**
   * Which copies of a song exist (Phase 4). `local` = a copy on this device (a folder in the library directory on
   * desktop, device storage on the web), `cloud` = a live server track.
   * Set by `SongLibrary` when it merges both listings.
   */
  export interface Location {
    local: boolean;
    cloud: boolean;
  }

  /**
   * A local write, delete or info save, emitted by `LocalSongStorage` and `DeviceSongStorage`.
   */
  export interface ChangeEvent {
    uid: string;
    /**
     * `null` for info saves and whole-song deletes.
     */
    relPath: string | null;
    action: "write" | "delete" | "info" | "song-deleted";
  }

  /**
   * Type guard for `DiskFile`.
   */
  export function isDiskFile(data: WriteData): data is DiskFile {
    return typeof data === "object"
      && data !== null
      && !(data instanceof Uint8Array)
      && !(typeof Blob !== "undefined" && data instanceof Blob)
      && typeof (data as DiskFile).diskPath === "string";
  }
}

export default SongStorage;
