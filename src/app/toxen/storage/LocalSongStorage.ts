import { EventEmitter } from "events";
import type Song from "../Song";
import type { ISong } from "../Song";
import { SongStorage } from "./SongStorage";

/**
 * Song files in the local library directory. Desktop only: every method guards with `toxenapi.isDesktop()` and uses
 * `toxenapi.fs` / `toxenapi.path` / `toxenapi.atomicWriteFile`, never `node:` imports.
 *
 * Every write goes through here, so this is where the sync engine learns that a song changed: each write, delete and
 * info save emits `change`. That replaces the hand-kept `Song.setFile` / `song.files` bookkeeping.
 * Must not import `SyncEngine` or `Toxen` (UI); errors are thrown, callers notify.
 */
export class LocalSongStorage extends EventEmitter implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new LocalSongStorage();

  public readonly kind = SongStorage.Kind.Local;

  /**
   * Absolute path of the song folder: `<libraryDirectory>/<song.paths.dirname>`.
   * @throws If the song has no `paths.dirname`.
   */
  public songDir(song: Song): string {
    throw new Error("Not implemented.");
  }

  /**
   * Absolute path of a file in the song folder. Rejects paths that would leave the folder.
   */
  public filePath(song: Song, relPath: string): string {
    throw new Error("Not implemented.");
  }

  public fileUrl(song: Song, relPath: string): string {
    throw new Error("Not implemented.");
  }

  public async readText(song: Song, relPath: string): Promise<string | null> {
    throw new Error("Not implemented.");
  }

  public async readBlob(song: Song, relPath: string): Promise<Blob | null> {
    throw new Error("Not implemented.");
  }

  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    throw new Error("Not implemented.");
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    throw new Error("Not implemented.");
  }

  public async list(song: Song): Promise<SongStorage.FileEntry[]> {
    throw new Error("Not implemented.");
  }

  /**
   * Atomic write of `info.json`.
   */
  public async saveInfo(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Remove the song folder (retries once, as `Song.delete` does today).
   */
  public async deleteSong(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Today's `DesktopController.loadLocalSongs` (parallel with a concurrency limit, plan P4).
   */
  public async listSongs(onEach?: (info: ISong) => void): Promise<ISong[]> {
    throw new Error("Not implemented.");
  }

  public async countSongs(): Promise<number> {
    throw new Error("Not implemented.");
  }
}

export interface LocalSongStorage {
  // Local change (write, delete, info save, song delete)
  emit(event: "change", change: SongStorage.ChangeEvent): boolean;
  on(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  once(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
  off(event: "change", listener: (change: SongStorage.ChangeEvent) => void): this;
}

export default LocalSongStorage;
