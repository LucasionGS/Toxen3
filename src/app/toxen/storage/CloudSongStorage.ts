import type Song from "../Song";
import type { ISong } from "../Song";
import { SongStorage } from "./SongStorage";
import type { SyncV2 } from "../sync/SyncApi";

/**
 * Song files on the server. Works on web and desktop (`fetch`, plus `toxenapi.uploadFile` for `DiskFile` on desktop).
 *
 * Phase 1: today's v1 endpoints (`User.getCollectionPath()`, `?token=` media URLs), with every promise settling.
 * Phase 4: `/v2` through `SyncApi`. Writes become blob PUT + commit against the rev from `setManifestProvider`,
 * media URLs use signed tokens from `ensureMediaTokens`.
 * Must not import `SyncEngine` or `Toxen` (UI). May import `sync/SyncApi` (a leaf).
 */
export class CloudSongStorage implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new CloudSongStorage();

  public readonly kind = SongStorage.Kind.Cloud;

  /**
   * Cached media tokens by uid (Phase 4).
   */
  private _mediaTokens = new Map<string, SyncV2.MediaToken>();

  /**
   * Where to get a song's current server manifest (Phase 4). Set by `SyncEngine.init` (desktop) or `SongLibrary` (web).
   */
  private _manifestProvider: ((uid: string) => SyncV2.TrackManifest | null) | null = null;

  /**
   * Base URL of the song on the server (`<server>/track/<uid>` in Phase 1).
   */
  public songUrl(song: Song): string {
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

  public async saveInfo(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  public async deleteSong(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Today's `Song.loadRemoteSongs` (v1 `GET /track`). Phase 4 on web: `changes?since=0`.
   */
  public async listSongs(onEach?: (info: ISong) => void): Promise<ISong[]> {
    throw new Error("Not implemented.");
  }

  public async countSongs(): Promise<number> {
    throw new Error("Not implemented.");
  }

  /**
   * Fetch media tokens for songs that have none or whose token expires within the hour (Phase 4).
   */
  public async ensureMediaTokens(uids: string[]): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Set where the current server manifest of a song comes from (Phase 4).
   */
  public setManifestProvider(provider: (uid: string) => SyncV2.TrackManifest | null): void {
    this._manifestProvider = provider;
  }
}

export default CloudSongStorage;
