import type Song from "../Song";
import type { ISong } from "../Song";
import Settings from "../Settings";
import User from "../User";
import { SongStorage } from "./SongStorage";
import type { SyncV2 } from "../sync/SyncApi";
import type ToxenController from "../../../ToxenControllers/ToxenController";

/**
 * Song files on the server. Works on web and desktop (`fetch`, plus `toxenapi.uploadFile` for `DiskFile` on desktop).
 *
 * Phase 1: today's v1 endpoints (`User.getCollectionPath()`, `?token=` media URLs), with every promise settling.
 * Phase 4: `/v2` through `SyncApi`. Writes become blob PUT + commit against the rev from `setManifestProvider`,
 * media URLs use signed tokens from `ensureMediaTokens`.
 * Until the old sync is removed (Phase 4), writes and deletes also call `song.setFile()`, as the remote code paths did.
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
   * Base URL of the server's track collection, as `User.getCollectionPath()` returns it.
   */
  public collectionUrl(): string {
    return `${Settings.getServer()}/track`;
  }

  /**
   * Base URL of the song on the server (`<server>/track/<uid>` in Phase 1).
   */
  public songUrl(song: Song): string {
    return `${this.collectionUrl()}/${song.uid}`;
  }

  public fileUrl(song: Song, relPath: string): string {
    if (!relPath) return "";
    return User.appendAuth(this.fileLocation(song, relPath));
  }

  public fileLocation(song: Song, relPath?: string): string {
    return relPath ? `${this.songUrl(song)}/${relPath}` : this.songUrl(song);
  }

  public async readText(song: Song, relPath: string): Promise<string | null> {
    const res = await CloudSongStorage._fetch(this.fileLocation(song, relPath));
    if (res.status === 404) return null;
    await CloudSongStorage._ensureOk(res, `Reading ${relPath}`);
    return res.text();
  }

  public async readBlob(song: Song, relPath: string): Promise<Blob | null> {
    const res = await CloudSongStorage._fetch(this.fileLocation(song, relPath));
    if (res.status === 404) return null;
    await CloudSongStorage._ensureOk(res, `Reading ${relPath}`);
    return res.blob();
  }

  /**
   * Upload a file (v1 `PUT /track/<uid>/<relPath>`). `DiskFile` is read into memory first in Phase 1 (desktop only);
   * Phase 4 streams it with `toxenapi.uploadFile`.
   */
  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    CloudSongStorage._requireUser();
    const body = await CloudSongStorage._toBody(data);
    const res = await CloudSongStorage._fetch(this.fileLocation(song, relPath), { method: "PUT", body });
    await CloudSongStorage._ensureOk(res, `Uploading ${relPath}`);
    song.setFile(relPath, "u");
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    CloudSongStorage._requireUser();
    const res = await CloudSongStorage._fetch(this.fileLocation(song, relPath), { method: "DELETE" });
    if (res.status !== 404) await CloudSongStorage._ensureOk(res, `Deleting ${relPath}`);
    song.setFile(relPath, "d");
  }

  /**
   * Files of the song from the v1 listing (`GET /track/<uid>`), which only has names: `size` and `mtimeMs` are `0`.
   */
  public async list(song: Song): Promise<SongStorage.FileEntry[]> {
    const res = await CloudSongStorage._fetch(this.songUrl(song));
    if (res.status === 404) return [];
    await CloudSongStorage._ensureOk(res, "Listing the song's files");
    const raw = await res.json() as (string | { name: string })[];
    return raw
      .map(file => typeof file === "string" ? file : file?.name)
      .filter(relPath => relPath && relPath !== SongStorage.INFO_FILE)
      .map(relPath => ({ relPath, size: 0, mtimeMs: 0 }));
  }

  public async saveInfo(song: Song): Promise<void> {
    CloudSongStorage._requireUser();
    const res = await CloudSongStorage._fetch(`${this.songUrl(song)}/${SongStorage.INFO_FILE}`, {
      method: "PUT",
      body: JSON.stringify(song.toISong()),
      headers: { "Content-Type": "application/json" },
    });
    await CloudSongStorage._ensureOk(res, "Saving the song info");
  }

  public async deleteSong(song: Song): Promise<void> {
    CloudSongStorage._requireUser();
    const res = await CloudSongStorage._fetch(this.songUrl(song), { method: "DELETE" });
    await CloudSongStorage._ensureOk(res, "Deleting the song");
  }

  /**
   * Today's `Song.loadRemoteSongs` (v1 `GET /track`). Phase 4 on web: `changes?since=0`.
   * @returns `[]` when nobody is logged in.
   * @throws If the server can't be reached or answers with an error (`Toxen.loadSongs` falls back to the local library).
   */
  public async listSongs(onEach?: (info: ISong) => void): Promise<ISong[]> {
    if (!Settings.getUser()) return [];
    const res = await CloudSongStorage._fetch(this.collectionUrl());
    await CloudSongStorage._ensureOk(res, "Loading the cloud library");
    const infos = await res.json() as ISong[];
    if (!Array.isArray(infos)) throw new Error("The server sent an invalid track list.");
    if (onEach) infos.forEach(info => onEach(info));
    return infos;
  }

  public async countSongs(): Promise<number> {
    return (await this.listSongs()).length;
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

  /**
   * `fetch` with the logged-in user's bearer token, like `Toxen.fetch` (which storage can't import).
   */
  private static _fetch(url: string, init?: RequestInit): Promise<Response> {
    const token = User.getCurrentUser()?.token;
    return fetch(url.replace(/^tx(s)?:\/\//, (_: string, $1: string) => `http${$1 || ""}://`), {
      credentials: "include",
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers as Record<string, string> ?? {}),
      },
    });
  }

  /**
   * Throw a readable error for a non-2xx response, using the server's `{ error }` body when there is one.
   */
  private static async _ensureOk(res: Response, action: string): Promise<void> {
    if (res.ok) return;
    const body = await res.json().catch((): null => null) as { error?: string } | null;
    throw new Error(`${action} failed: ${body?.error ?? `${res.status} ${res.statusText}`}`);
  }

  private static _requireUser(): void {
    if (!Settings.getUser()) throw new Error("You are not logged in. Log in to change songs in your cloud library.");
  }

  /**
   * Turn `WriteData` into a request body. Strings are sent as `text/plain` so the server never parses them as JSON.
   */
  private static async _toBody(data: SongStorage.WriteData): Promise<BodyInit> {
    if (data instanceof Uint8Array) return new Uint8Array(data);
    if (!SongStorage.isDiskFile(data)) return data;
    if (toxenapi.isDesktop()) return new Blob([new Uint8Array(await toxenapi.fs.promises.readFile(data.diskPath))]);
    return (toxenapi as ToxenController).throwDesktopOnly("Uploading a file from disk");
  }
}

export default CloudSongStorage;
