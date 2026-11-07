import type Song from "../Song";
import type { ISong } from "../Song";
import User from "../User";
import { SongStorage } from "./SongStorage";
import { SyncApi, SyncV2 } from "../sync/SyncApi";
import { Merge } from "../sync/Merge";
import type ToxenController from "../../../ToxenControllers/ToxenController";

/**
 * Song files on the server, through the `/v2` API (`SyncApi`). Works on web and desktop.
 *
 * Reads go to `GET /tracks/:uid/files/:path`. Writes upload the blob and commit it against the rev of the song's
 * current manifest (kept by the `ManifestStore`: `SyncState` through `SyncEngine`), re-merging the info and retrying on
 * a stale base. URLs the renderer loads directly (`<audio>`, images) carry short-lived signed media tokens.
 * Must not import `SyncEngine` or `Toxen` (UI). May import the leaves `sync/SyncApi` and `sync/Merge`.
 */
export class CloudSongStorage implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new CloudSongStorage();

  public readonly kind = SongStorage.Kind.Cloud;

  /**
   * Commit attempts for one write before a stale base is reported as an error.
   */
  public static readonly MAX_COMMIT_ATTEMPTS = 3;

  /**
   * Media tokens are fetched again when they expire within this window. Unit is in ms.
   */
  public static readonly TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000;

  /**
   * A token this close to expiry is not handed out anymore. Unit is in ms.
   */
  public static readonly TOKEN_MIN_LIFETIME_MS = 5 * 60 * 1000;

  /**
   * How long a `listSongs` result is reused (the loading screen counts, then lists). Unit is in ms.
   */
  public static readonly LISTING_CACHE_MS = 10 * 1000;

  /**
   * Cached media tokens by uid.
   */
  private _mediaTokens = new Map<string, SyncV2.MediaToken>();
  private _tokenUserId: number | null = null;
  private _tokenRequest: Promise<void> | null = null;
  private _tokenTimer: ReturnType<typeof setInterval> | null = null;
  private _listing: { at: number; result: Promise<ISong[]> } | null = null;

  /**
   * Where the songs' current server manifests live. Defaults to an in-memory map until `SyncEngine` sets its store.
   */
  private _store: CloudSongStorage.ManifestStore = CloudSongStorage._memoryStore();

  /**
   * Set where the current server manifest of a song comes from and goes to. Set by `SyncEngine.configure`.
   */
  public setManifestStore(store: CloudSongStorage.ManifestStore): void {
    this._store = store;
  }

  /**
   * The latest server manifest of a song, or `null` if it has none (or it is a tombstone).
   */
  public getManifest(uid: string): SyncV2.TrackManifest | null {
    const manifest = this._store.get(uid);
    return manifest && !manifest.deleted ? manifest : null;
  }

  public fileUrl(song: Song, relPath: string): string {
    if (!relPath) return "";
    const user = User.getCurrentUser();
    if (user && this._tokenUserId !== user.id) this._resetTokens(user.id);
    const token = this._mediaTokens.get(song.uid);
    if (user && token && token.exp * 1000 - Date.now() > CloudSongStorage.TOKEN_MIN_LIFETIME_MS) {
      return SyncApi.fileUrl(song.uid, relPath, token, user.id);
    }
    // No token yet: fetch one for next time, and use the session token meanwhile (the v2 file route accepts it)
    if (user) this.ensureMediaTokens([song.uid]).catch(error => console.warn("Unable to get media tokens.", error));
    return User.appendAuth(this.fileLocation(song, relPath));
  }

  public fileLocation(song: Song, relPath?: string): string {
    if (relPath) return SyncApi.fileUrl(song.uid, relPath);
    return `${SyncApi.getBaseUrl()}/tracks/${encodeURIComponent(song.uid)}`;
  }

  public async readText(song: Song, relPath: string): Promise<string | null> {
    const res = await this._get(song, relPath);
    return res ? res.text() : null;
  }

  public async readBlob(song: Song, relPath: string): Promise<Blob | null> {
    const res = await this._get(song, relPath);
    return res ? res.blob() : null;
  }

  /**
   * Upload a file and commit it into the song's manifest. `DiskFile` streams from disk (desktop only).
   */
  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    CloudSongStorage._requireUser();
    CloudSongStorage._requireSyncablePath(relPath);
    const entry = await this._uploadBlob(data);
    await this._commit(song, () => ({ files: { [relPath]: entry } }));
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    CloudSongStorage._requireUser();
    await this._commit(song, manifest => {
      if (!manifest || !Object.prototype.hasOwnProperty.call(manifest.files, relPath)) return null;
      return { deletes: [relPath] };
    });
  }

  /**
   * Files of the song from its manifest.
   */
  public async list(song: Song): Promise<SongStorage.FileEntry[]> {
    const manifest = this.getManifest(song.uid);
    if (!manifest) return [];
    return Object.entries(manifest.files).map(([relPath, file]) => ({
      relPath,
      size: file.size,
      mtimeMs: file.receivedAt,
      sha256: file.sha256,
    }));
  }

  /**
   * Commit `song.toISong()` as the song's info. On a stale base the info is merged per field against the version
   * this device last saw, so a concurrent edit of another field on another device is kept.
   */
  public async saveInfo(song: Song): Promise<void> {
    CloudSongStorage._requireUser();
    const ours = CloudSongStorage.toCloudInfo(song.toISong());
    const now = Date.now();
    const seen = this.getManifest(song.uid);
    await this._commit(song, current => {
      let info = ours;
      if (current && seen && current.rev !== seen.rev) {
        info = Merge.mergeInfo(CloudSongStorage.toCloudInfo(seen.info), ours, now, CloudSongStorage.toCloudInfo(current.info), current.infoUpdatedAt).merged;
      }
      return { info, infoUpdatedAt: now };
    });
  }

  /**
   * Tombstone the track. A change made in between by another device doesn't stop the delete: the user asked for it.
   */
  public async deleteSong(song: Song): Promise<void> {
    CloudSongStorage._requireUser();
    let baseRev = this.getManifest(song.uid)?.rev;
    for (let attempt = 0; attempt < CloudSongStorage.MAX_COMMIT_ATTEMPTS; attempt++) {
      const result = await SyncApi.deleteTrack(song.uid, baseRev);
      if (result.ok === true) {
        const previous = this._store.get(song.uid);
        if (previous) this._store.set({ ...previous, rev: result.value.rev, files: {}, deleted: true, deletedAt: Date.now() });
        return;
      }
      if (!result.body.current || result.body.current.deleted) return;
      this._store.set(result.body.current);
      baseRev = result.body.current.rev;
    }
    throw new Error(`Deleting "${song.getDisplayName()}" from the cloud kept conflicting with changes from another device. Try again.`);
  }

  /**
   * Every live track (`changes?since=0`, all pages), stored in the manifest store. Web uses this as its library.
   * @returns `[]` when nobody is logged in.
   * @throws If the server can't be reached or answers with an error (`Toxen.loadSongs` falls back to the local library).
   */
  public async listSongs(onEach?: (info: ISong) => void): Promise<ISong[]> {
    if (!User.getCurrentUser()) return [];
    const cached = this._listing && Date.now() - this._listing.at < CloudSongStorage.LISTING_CACHE_MS ? this._listing : null;
    const listing = cached?.result ?? this._fetchListing();
    if (!cached) this._listing = { at: Date.now(), result: listing };
    listing.catch(() => { this._listing = null; });
    const infos = await listing;
    if (onEach) infos.forEach(info => onEach(info));
    return infos;
  }

  public async countSongs(): Promise<number> {
    return (await this.listSongs()).length;
  }

  /**
   * Fetch media tokens for songs that have none or whose token expires within `TOKEN_REFRESH_MARGIN_MS`, and keep
   * them fresh from then on. Concurrent calls share one request per batch.
   */
  public async ensureMediaTokens(uids: string[]): Promise<void> {
    const user = User.getCurrentUser();
    if (!user) return;
    if (this._tokenUserId !== user.id) this._resetTokens(user.id);
    const due = (uid: string) => {
      const token = this._mediaTokens.get(uid);
      return !token || token.exp * 1000 - Date.now() < CloudSongStorage.TOKEN_REFRESH_MARGIN_MS;
    };
    // Join the running request first, then ask for whatever it didn't cover
    if (this._tokenRequest) await this._tokenRequest.catch(() => { });
    const needed = [...new Set(uids)].filter(due);
    if (needed.length > 0) {
      const request = SyncApi.getMediaTokens(needed).then(tokens => {
        for (const [uid, token] of Object.entries(tokens)) this._mediaTokens.set(uid, token);
      });
      this._tokenRequest = request.finally(() => {
        if (this._tokenRequest === request) this._tokenRequest = null;
      });
      await request;
    }
    this._tokenTimer ??= setInterval(() => {
      this.ensureMediaTokens([...this._mediaTokens.keys()]).catch(error => console.warn("Unable to refresh media tokens.", error));
    }, CloudSongStorage.TOKEN_REFRESH_MARGIN_MS / 4);
  }

  /**
   * Info as the server keeps it: without `IGNORED_INFO_FIELDS` and without `paths.dirname`, which names this device's
   * folder and differs between devices.
   */
  public static toCloudInfo(info: Partial<ISong> | SyncV2.SongInfo): SyncV2.SongInfo {
    const stripped = Merge.stripInfo(info as SyncV2.SongInfo);
    const paths = stripped.paths;
    if (paths && typeof paths === "object" && !Array.isArray(paths) && "dirname" in paths) {
      const rest = { ...(paths as Record<string, unknown>) };
      delete rest.dirname;
      stripped.paths = rest;
    }
    return stripped;
  }

  /**
   * A server manifest as a song info for the library (`uid` from the manifest, `paths` always present, the rev as the
   * cache-busting `hash`, so images reload when the track changes).
   */
  public static toSongInfo(manifest: SyncV2.TrackManifest): ISong {
    const info = { ...(manifest.info as Partial<ISong>), uid: manifest.uid, hash: `r${manifest.rev}` } as ISong;
    const paths = (info.paths && typeof info.paths === "object" ? info.paths : {}) as ISong["paths"];
    info.paths = { media: null, background: null, subtitles: null, storyboard: null, ...paths, dirname: manifest.uid };
    return info;
  }

  private async _fetchListing(): Promise<ISong[]> {
    const live = new Map<string, SyncV2.TrackManifest>();
    let since = 0;
    for (;;) {
      const page = await SyncApi.getChanges({ since });
      for (const change of page.changes) {
        if (change.kind !== "track") {
          this._store.item?.(change);
          continue;
        }
        this._store.set(change.manifest);
        if (change.manifest.deleted) live.delete(change.uid);
        else live.set(change.uid, change.manifest);
      }
      since = page.nextSince;
      if (!page.hasMore) break;
    }
    this._store.listed(since);
    return [...live.values()].map(manifest => CloudSongStorage.toSongInfo(manifest));
  }

  /**
   * Commit a change built from the song's current manifest, re-building it from the server's manifest on a stale
   * base. `build` returns `null` when there is nothing to commit.
   */
  private async _commit(song: Song, build: (manifest: SyncV2.TrackManifest | null) => Omit<SyncV2.CommitRequest, "baseRev"> | null): Promise<void> {
    let manifest = this.getManifest(song.uid);
    for (let attempt = 0; attempt < CloudSongStorage.MAX_COMMIT_ATTEMPTS; attempt++) {
      const change = build(manifest);
      if (!change) return;
      const result = await SyncApi.commit(song.uid, { baseRev: manifest?.rev ?? null, ...change });
      if (result.ok === true) {
        this._store.set(result.value.manifest);
        return;
      }
      const failure = result.body;
      switch (failure.code) {
        case SyncV2.ErrorCode.StaleBase:
          manifest = failure.current && !failure.current.deleted ? failure.current : null;
          if (failure.current) this._store.set(failure.current);
          break;
        case SyncV2.ErrorCode.QuotaExceeded:
          throw new Error(`Your cloud storage is full (${CloudSongStorage._formatBytes(failure.storageUsed)} of ${CloudSongStorage._formatBytes(failure.storageQuota)}). Free up space or upgrade to save this change.`);
        case SyncV2.ErrorCode.MissingBlobs:
          throw new Error("The server lost an uploaded file before it was saved. Try again.");
        default:
          throw new Error((failure as SyncV2.ErrorResponse).error); // A code newer than this client
      }
    }
    throw new Error(`Saving "${song.getDisplayName()}" kept conflicting with changes from another device. Try again.`);
  }

  /**
   * Hash and upload one file's content unless the server already has it.
   */
  private async _uploadBlob(data: SongStorage.WriteData): Promise<SyncV2.FileEntry> {
    if (SongStorage.isDiskFile(data)) {
      if (!toxenapi.isDesktop()) return (toxenapi as ToxenController).throwDesktopOnly("Uploading a file from disk");
      const { sha256, size } = await toxenapi.hashFile(data.diskPath);
      if (await SyncApi.headBlob(sha256) === null) {
        const res = await toxenapi.uploadFile({ url: SyncApi.blobUrl(sha256), filePath: data.diskPath, headers: SyncApi.getHeaders() })
          .catch(error => { throw new SyncApi.HttpError(`Can't reach the sync server: ${error?.message ?? error}`, 0); });
        CloudSongStorage._ensureUploaded(res.status, res.body);
      }
      return { sha256, size };
    }

    const blob = typeof data === "string"
      ? new Blob([data], { type: "text/plain" })
      : data instanceof Blob ? data : new Blob([new Uint8Array(data)]);
    const sha256 = await CloudSongStorage._sha256(blob);
    if (await SyncApi.headBlob(sha256) === null) {
      const result = await SyncApi.putBlob(sha256, blob);
      if (result.ok === false) CloudSongStorage._ensureUploaded(result.status, result.body);
    }
    return { sha256, size: blob.size };
  }

  private async _get(song: Song, relPath: string): Promise<Response | null> {
    let res: Response;
    try {
      res = await fetch(SyncApi.fileUrl(song.uid, relPath), { headers: SyncApi.getHeaders() });
    } catch (error) {
      throw new Error(`Reading ${relPath} failed: can't reach the server (${error?.message ?? error}).`);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch((): null => null) as { error?: string } | null;
      throw new Error(`Reading ${relPath} failed: ${body?.error ?? `${res.status} ${res.statusText}`}`);
    }
    return res;
  }

  private _resetTokens(userId: number): void {
    this._mediaTokens.clear();
    this._tokenUserId = userId;
  }

  private static _ensureUploaded(status: number, body: unknown): void {
    if (status >= 200 && status < 300) return;
    const error = body as SyncV2.ErrorResponse | SyncV2.QuotaExceededErrorResponse | null;
    if (error?.code === SyncV2.ErrorCode.QuotaExceeded) {
      const quota = error as SyncV2.QuotaExceededErrorResponse;
      throw new Error(`Your cloud storage is full (${CloudSongStorage._formatBytes(quota.storageUsed)} of ${CloudSongStorage._formatBytes(quota.storageQuota)}). Free up space or upgrade to upload this file.`);
    }
    throw new Error(`Uploading the file failed: ${error?.error ?? `status ${status}`}`);
  }

  private static async _sha256(blob: Blob): Promise<string> {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      throw new Error("This browser can't hash files here. Open Toxen over HTTPS to upload files.");
    }
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  private static _formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  private static _requireUser(): void {
    if (!User.getCurrentUser()) throw new Error("You are not logged in. Log in to change songs in your cloud library.");
  }

  private static _requireSyncablePath(relPath: string): void {
    const lower = relPath.toLowerCase();
    if (!relPath || relPath.length > SyncV2.PATH_MAX_LENGTH || relPath.includes("\\") || relPath.split("/").some(s => s === "" || s === "." || s === ".." || s === "__proto__" || s === "constructor" || s === "prototype")
      || (SyncV2.RESERVED_PATHS as readonly string[]).includes(lower) || SyncV2.RESERVED_PREFIXES.some(prefix => lower.startsWith(prefix))) {
      throw new Error(`"${relPath}" can't be stored in the cloud. Use a relative path with "/" separators, at most ${SyncV2.PATH_MAX_LENGTH} characters.`);
    }
  }

  private static _memoryStore(): CloudSongStorage.ManifestStore {
    const manifests = new Map<string, SyncV2.TrackManifest>();
    return {
      get: uid => manifests.get(uid) ?? null,
      set: manifest => {
        const previous = manifests.get(manifest.uid);
        if (!previous || previous.rev <= manifest.rev) manifests.set(manifest.uid, manifest);
      },
      listed: () => { },
    };
  }
}

export namespace CloudSongStorage {
  /**
   * Where `CloudSongStorage` reads and writes the songs' server manifests.
   */
  export interface ManifestStore {
    /**
     * The newest manifest seen for `uid` (tombstones included), or `null`.
     */
    get(uid: string): SyncV2.TrackManifest | null;
    /**
     * A manifest from the server (commit response, stale-base answer, listing). Older revs than the stored one are ignored.
     */
    set(manifest: SyncV2.TrackManifest): void;
    /**
     * A full listing was read up to `rev` (web uses it as its pull cursor, so the engine doesn't list everything twice).
     */
    listed(rev: number): void;
    /**
     * A changelog entry of another kind (playlists, settings…) seen while listing, so it isn't skipped by the cursor.
     */
    item?(change: SyncV2.Change): void;
  }
}

export default CloudSongStorage;
