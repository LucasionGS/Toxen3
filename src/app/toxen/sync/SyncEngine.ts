import { EventEmitter } from "events";
import type Song from "../Song";
import type { ISong } from "../Song";
import Settings from "../Settings";
import User from "../User";
import { SyncApi, SyncV2 } from "./SyncApi";
import { Merge } from "./Merge";
import { SyncState } from "./SyncState";
import { Manifest } from "./Manifest";
import { Transfer } from "./Transfer";
import { SongStorage } from "../storage/SongStorage";
import { LocalSongStorage } from "../storage/LocalSongStorage";
import { CloudSongStorage } from "../storage/CloudSongStorage";

/**
 * Event emitter behind `SyncEngine.events`.
 */
export class SyncEngineEmitter extends EventEmitter { }

export interface SyncEngineEmitter {
  // Song status changed
  emit(event: "status", uid: string, status: SyncEngine.SongStatus): boolean;
  on(event: "status", listener: (uid: string, status: SyncEngine.SongStatus) => void): this;
  once(event: "status", listener: (uid: string, status: SyncEngine.SongStatus) => void): this;
  off(event: "status", listener: (uid: string, status: SyncEngine.SongStatus) => void): this;

  // Engine summary changed
  emit(event: "summary", summary: SyncEngine.Summary): boolean;
  on(event: "summary", listener: (summary: SyncEngine.Summary) => void): this;
  once(event: "summary", listener: (summary: SyncEngine.Summary) => void): this;
  off(event: "summary", listener: (summary: SyncEngine.Summary) => void): this;

  // Transfer progress
  emit(event: "progress", progress: Transfer.Progress): boolean;
  on(event: "progress", listener: (progress: Transfer.Progress) => void): this;
  once(event: "progress", listener: (progress: Transfer.Progress) => void): this;
  off(event: "progress", listener: (progress: Transfer.Progress) => void): this;

  // Conflict auto-resolved, waiting for review
  emit(event: "conflict", record: Merge.ConflictRecord): boolean;
  on(event: "conflict", listener: (record: Merge.ConflictRecord) => void): this;
  once(event: "conflict", listener: (record: Merge.ConflictRecord) => void): this;
  off(event: "conflict", listener: (record: Merge.ConflictRecord) => void): this;

  // Open conflicts changed (added, resolved or expired)
  emit(event: "conflicts", records: Merge.ConflictRecord[]): boolean;
  on(event: "conflicts", listener: (records: Merge.ConflictRecord[]) => void): this;
  once(event: "conflicts", listener: (records: Merge.ConflictRecord[]) => void): this;
  off(event: "conflicts", listener: (records: Merge.ConflictRecord[]) => void): this;

  // Delete-vs-modify: the modification was kept (no conflict record)
  emit(event: "kept", kept: SyncEngine.Kept): boolean;
  on(event: "kept", listener: (kept: SyncEngine.Kept) => void): this;
  once(event: "kept", listener: (kept: SyncEngine.Kept) => void): this;
  off(event: "kept", listener: (kept: SyncEngine.Kept) => void): this;

  // Sync failure
  emit(event: "error", failure: SyncEngine.Failure): boolean;
  on(event: "error", listener: (failure: SyncEngine.Failure) => void): this;
  once(event: "error", listener: (failure: SyncEngine.Failure) => void): this;
  off(event: "error", listener: (failure: SyncEngine.Failure) => void): this;

  // Remote changes written into a local song
  emit(event: "applied", applied: SyncEngine.Applied): boolean;
  on(event: "applied", listener: (applied: SyncEngine.Applied) => void): this;
  once(event: "applied", listener: (applied: SyncEngine.Applied) => void): this;
  off(event: "applied", listener: (applied: SyncEngine.Applied) => void): this;

  // Where a song lives changed (downloaded, removed, new or changed in the cloud, deleted)
  emit(event: "song", change: SyncEngine.SongChange): boolean;
  on(event: "song", listener: (change: SyncEngine.SongChange) => void): this;
  once(event: "song", listener: (change: SyncEngine.SongChange) => void): this;
  off(event: "song", listener: (change: SyncEngine.SongChange) => void): this;
}

/**
 * The plan was made against a server rev that is no longer current: re-pull, re-plan, retry.
 */
class StaleBaseError extends Error {
  constructor() {
    super("The song changed in the cloud while it was syncing.");
    this.name = "StaleBaseError";
  }
}

/**
 * Background sync between the local library and the cloud (plan §2.6). Static manager: `configure()` at startup,
 * `prepare()` before the library loads, `init()` after it.
 *
 * Triggers (only while `autoSync` is on): startup (scan changed folders, then `changes?since`), `LocalSongStorage`
 * `change` (debounced `DEBOUNCE_MS` per song), a `track:changed` socket event (`handleRemoteEvent`, wired by bootstrap),
 * every `POLL_INTERVAL_MS`, a socket reconnect and the window `online` event. Explicit actions (`syncNow`,
 * `makeAvailableOffline`, `uploadToCloud`…) work with auto-sync off too.
 *
 * Per song: Manifest.scanLocal -> Merge.planSong -> quota pre-check -> Transfer uploads -> commit -> on 409 re-pull and
 * re-plan, up to `MAX_COMMIT_RETRIES` -> local moves and deletes -> downloads -> write info -> update SyncState.
 * `CONCURRENCY` songs run at a time. Failures back off exponentially and stay in `SyncState.pending`. Quota errors stop
 * uploads only; downloads continue.
 *
 * Web has no local copies: the engine only pulls, so the library and the playing song update live.
 *
 * Boundaries: imports storage/, sync/, `Settings`, `User` and `toxenapi` only. Never React components or `Toxen` UI
 * helpers: everything user-facing goes out as events, and bootstrap turns them into notifications and panel updates.
 */
export class SyncEngine {
  private constructor() { }

  /**
   * Typed events. Subscribe with `SyncEngine.events.on(...)`.
   */
  public static readonly events = new SyncEngineEmitter();

  /**
   * Songs synced in parallel.
   */
  public static readonly CONCURRENCY = 3;

  /**
   * Wait after the last local change to a song before syncing it. Unit is in ms.
   */
  public static readonly DEBOUNCE_MS = 3000;

  /**
   * Coalesce socket events arriving together into one pull. Unit is in ms.
   */
  public static readonly REMOTE_EVENT_DELAY_MS = 300;

  /**
   * Fallback pull interval. Unit is in ms.
   */
  public static readonly POLL_INTERVAL_MS = 10 * 60 * 1000;

  /**
   * Re-merge attempts after a 409 before the song is marked with an error.
   */
  public static readonly MAX_COMMIT_RETRIES = 3;

  /**
   * Backoff for failed jobs: `BACKOFF_BASE_MS * 2^attempts`, capped at `BACKOFF_MAX_MS`. Unit is in ms.
   */
  public static readonly BACKOFF_BASE_MS = 5000;
  public static readonly BACKOFF_MAX_MS = 30 * 60 * 1000;

  /**
   * If more synced songs than this (and more than `MISSING_RATIO_LIMIT` of them) are missing from the library folder
   * at once, sync doesn't delete them from the cloud until `confirmMissingDeletes()`: an unmounted drive or a moved
   * library must not empty the cloud.
   */
  public static readonly MISSING_COUNT_LIMIT = 5;
  public static readonly MISSING_RATIO_LIMIT = 0.25;

  /**
   * Folder below `SyncState.DIR_NAME` where new downloads are assembled before they move into the library.
   */
  public static readonly INCOMING_DIR = "incoming";

  //#region State

  private static _library: SyncEngine.Library | null = null;
  private static _prepared: { userId: number; server: string } | null = null;
  private static _running = false;
  /**
   * `init` ran at least once (bootstrap got to it), so user changes may start the engine.
   */
  private static _initialized = false;
  private static _auto = false;
  private static _disabledReason: string | null = null;
  private static _outdatedNotified = false;
  private static _offline = false;
  private static _me: SyncV2.MeResponse | null = null;
  private static _uploadsBlocked: SyncV2.QuotaExceededErrorResponse | null = null;
  private static _deletesBlocked: number = 0;
  private static _deletesConfirmed = false;
  private static _inFlight = new Set<string>();
  private static _rerun = new Set<string>();
  private static _locks = new Map<string, Promise<void>>();
  private static _waiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }[]>();
  private static _active = new Map<string, { direction: "up" | "down"; done: number; total: number; current: number }>();
  private static _debounce = new Map<string, ReturnType<typeof setTimeout>>();
  private static _pumpTimer: ReturnType<typeof setTimeout> | null = null;
  private static _pollTimer: ReturnType<typeof setInterval> | null = null;
  private static _remoteTimer: ReturnType<typeof setTimeout> | null = null;
  private static _summaryTimer: ReturnType<typeof setTimeout> | null = null;
  private static _pulling: Promise<void> | null = null;
  private static _pullAgain = false;
  private static _abort = new AbortController();
  private static _idleWaiters: (() => void)[] = [];

  //#endregion

  //#region Lifecycle

  /**
   * Set where the library's songs come from. Called once by `SongLibrary` (which the engine can't import).
   */
  public static setLibrary(library: SyncEngine.Library): void {
    SyncEngine._library = library;
  }

  /**
   * Configure `SyncApi` and the cloud storage's manifest store. Cheap and idempotent; bootstrap calls it right after
   * the settings load, before anything talks to the server.
   */
  public static configure(): void {
    SyncApi.configure({
      getServer: () => Settings.getServer(),
      getToken: () => User.getCurrentUser()?.token ?? null,
      getDeviceId: () => SyncState.machine.deviceId || null,
    });
    CloudSongStorage.instance.setManifestStore({
      get: uid => SyncState.peekSong(uid)?.remote ?? null,
      set: manifest => SyncEngine._storeRemote(manifest),
      listed: rev => {
        // Web has no local copies to apply changes to, so a full listing is as good as a pull
        if (!toxenapi.isDesktop()) SyncState.data.lastPulledRev = Math.max(SyncState.data.lastPulledRev, rev);
      },
    });
  }

  /**
   * Load this machine's settings and the library's sync state for the logged-in user, so the library can list
   * cloud-only songs. Bootstrap calls it before the songs load; `init` calls it again (no-op when nothing changed).
   * @returns Whether a user is logged in.
   */
  public static async prepare(): Promise<boolean> {
    SyncEngine.configure();
    if (!SyncState.machine.deviceId) await SyncState.loadMachine();
    const user = User.getCurrentUser();
    if (!user) {
      if (SyncEngine._prepared) await SyncState.unload();
      SyncEngine._prepared = null;
      return false;
    }
    const server = Settings.getServer();
    if (SyncEngine._prepared?.userId === user.id && SyncEngine._prepared.server === server && SyncState.isLoaded()) return true;
    await SyncState.load(user.id, server);
    SyncEngine._prepared = { userId: user.id, server };
    return true;
  }

  /**
   * Start syncing for the logged-in user: check the server, run the startup pass, start timers. When logged out the
   * engine stays disabled. When the server has no sync v2 (`GET /v2/me` is 404) it stays disabled and says so once.
   */
  public static async init(): Promise<void> {
    SyncEngine._initialized = true;
    if (SyncEngine._running) return;
    if (!await SyncEngine.prepare()) {
      SyncEngine._disable("Log in to sync your library.");
      return;
    }

    try {
      SyncEngine._me = await SyncApi.getMe();
      SyncEngine._offline = false;
    } catch (error) {
      if (error instanceof SyncApi.HttpError && error.status === 404) {
        SyncEngine._disable("Your server needs an update to sync. Ask its admin to update Toxen's server, or keep using this device without sync.");
        if (!SyncEngine._outdatedNotified) {
          SyncEngine._outdatedNotified = true;
          SyncEngine.events.emit("error", { uid: null, message: "Your server needs an update to sync.", code: "server-outdated" });
        }
        return;
      }
      if (error instanceof SyncApi.HttpError && error.status === 401) {
        SyncEngine._disable("Your session has expired. Log in again to sync.");
        SyncEngine.events.emit("error", { uid: null, message: "Your session has expired. Log in again to sync.", code: SyncV2.ErrorCode.Unauthorized });
        return;
      }
      // Offline or a server fault: start anyway, the queue waits and retries
      SyncEngine._offline = true;
      console.warn("Sync starts offline.", error);
    }

    SyncEngine._running = true;
    SyncEngine._disabledReason = null;
    SyncEngine._abort = new AbortController();
    SyncEngine._auto = Settings.get("autoSync") !== false;
    SyncEngine._addListeners();
    SyncEngine._pruneConflicts();
    SyncEngine._emitSummary();

    if (SyncEngine._auto) {
      SyncEngine._startPolling();
      await SyncEngine._startupPass();
    }
    if (!toxenapi.isDesktop()) SyncEngine._refreshCloudSongs();
    SyncEngine._pump();
  }

  /**
   * Stop timers and in-flight transfers, flush `SyncState` (logout, quit). Pending jobs stay queued for next time.
   */
  public static async stop(): Promise<void> {
    if (!SyncEngine._running) return;
    SyncEngine._running = false;
    SyncEngine._abort.abort();
    SyncEngine._removeListeners();
    SyncEngine._stopPolling();
    for (const timer of SyncEngine._debounce.values()) clearTimeout(timer);
    SyncEngine._debounce.clear();
    if (SyncEngine._pumpTimer) clearTimeout(SyncEngine._pumpTimer);
    SyncEngine._pumpTimer = null;
    if (SyncEngine._remoteTimer) clearTimeout(SyncEngine._remoteTimer);
    SyncEngine._remoteTimer = null;
    SyncEngine._active.clear();
    await Promise.all([...SyncEngine._locks.values()].map(lock => lock.catch(() => { })));
    await SyncState.flush();
    SyncEngine._emitSummary();
  }

  /**
   * The logged-in user changed (login, logout, another account). Restarts the engine for the new account.
   */
  public static async handleUserChanged(): Promise<void> {
    if (!SyncEngine._initialized) return;
    const user = User.getCurrentUser();
    if (SyncEngine._prepared && user?.id === SyncEngine._prepared.userId) return;
    await SyncEngine.stop();
    await SyncEngine.prepare();
    if (user) await SyncEngine.init();
    else SyncEngine._disable("Log in to sync your library.");
  }

  /**
   * Whether the engine is running.
   */
  public static isRunning(): boolean {
    return SyncEngine._running;
  }

  /**
   * Turn auto-sync on or off (saves `autoSync`). Turning it on runs the startup pass right away.
   */
  public static async setAutoSync(enabled: boolean): Promise<void> {
    await Settings.apply({ autoSync: enabled }, true);
    if (!SyncEngine._running) {
      if (enabled) await SyncEngine.init();
      return;
    }
    SyncEngine._auto = enabled;
    if (enabled) {
      SyncEngine._startPolling();
      await SyncEngine._startupPass();
      SyncEngine._pump();
    }
    else {
      SyncEngine._stopPolling();
    }
    SyncEngine._emitSummary();
  }

  /**
   * Pull changes, rescan the library and process every pending job now (Settings > Sync "Sync now").
   * Resolves once the queue is empty or only failed jobs waiting for their backoff are left.
   */
  public static async syncNow(): Promise<void> {
    if (!SyncEngine._running) await SyncEngine.init();
    if (!SyncEngine._running) throw new Error(SyncEngine._disabledReason ?? "Sync isn't available.");
    await SyncEngine._refreshMe();
    for (const job of SyncState.data.pending) job.notBefore = Date.now();
    await SyncEngine._startupPass();
    SyncEngine._pump();
    await SyncEngine._whenIdle();
  }

  /**
   * Queue a song (debounced). Ignored while auto-sync is off.
   */
  public static markDirty(uid: string, reason: SyncEngine.DirtyReason = "local-change"): void {
    if (!SyncEngine._running || !SyncEngine._auto) return;
    const previous = SyncEngine._debounce.get(uid);
    if (previous) clearTimeout(previous);
    SyncEngine._debounce.set(uid, setTimeout(() => {
      SyncEngine._debounce.delete(uid);
      SyncEngine._enqueue(uid, reason);
      SyncEngine._pump();
    }, SyncEngine.DEBOUNCE_MS));
  }

  /**
   * A `track:changed` event from the socket. Ignored when `origin` is this device.
   */
  public static handleRemoteEvent(event: SyncV2.TrackChangedEvent): void {
    if (!SyncEngine._running || !SyncEngine._auto) return;
    if (event.origin && event.origin === SyncState.machine.deviceId) return;
    const known = SyncState.peekSong(event.uid)?.remote;
    if (known && known.rev >= event.rev) return;
    SyncEngine._schedulePull();
  }

  /**
   * The socket reconnected: changes may have been missed while it was down.
   */
  public static handleReconnect(): void {
    if (!SyncEngine._running || !SyncEngine._auto) return;
    SyncEngine._schedulePull();
  }

  /**
   * Allow sync to delete songs from the cloud that are missing from the library folder, after the engine held back
   * because too many went missing at once (see `MISSING_COUNT_LIMIT`).
   */
  public static confirmMissingDeletes(): void {
    SyncEngine._deletesConfirmed = true;
    SyncEngine._deletesBlocked = 0;
    for (const [uid, state] of Object.entries(SyncState.data.songs)) {
      if (state.baseFiles !== null && !SyncEngine._localSong(uid)) SyncEngine._enqueue(uid, "local-change");
    }
    SyncEngine._pump();
  }

  //#endregion

  //#region Song actions (context menu)

  /**
   * Download a cloud-only song and pin it. Resolves when it is on disk.
   * @throws If the download fails (it stays queued and is retried).
   */
  public static async makeAvailableOffline(song: Song): Promise<void> {
    SyncEngine._requireDesktop("Making songs available offline");
    await SyncEngine._requireStarted();
    const state = SyncState.getSong(song.uid);
    state.pinned = true;
    state.keepInCloud = false;
    SyncState.save();
    await SyncEngine._runNow(song.uid, "download");
  }

  /**
   * Delete the local copy, keep the cloud copy, unpin.
   * @param force Delete even if the local copy has changes the cloud doesn't have yet.
   * @throws {SyncEngine.UnsyncedChangesError} If the song has unsynced local changes and `force` isn't set (the caller
   * asks the user first). Also throws if the song isn't in the cloud.
   */
  public static async removeDownload(song: Song, force?: boolean): Promise<void> {
    SyncEngine._requireDesktop("Removing downloads");
    await SyncEngine._requireStarted();
    const uid = song.uid;
    await SyncEngine._exclusive(uid, async () => {
      const state = SyncState.getSong(uid);
      const remote = state.remote && !state.remote.deleted ? state.remote : null;
      if (!remote) throw new Error(`"${song.getDisplayName()}" isn't in the cloud, so removing its download would delete it. Upload it first, or delete it.`);
      const local = SyncEngine._localSong(uid);
      if (!local) return;
      const dir = LocalSongStorage.instance.songDir(local);

      if (!force && await SyncEngine._hasUnsyncedChanges(uid, dir, state, remote)) {
        throw new SyncEngine.UnsyncedChangesError(song.getDisplayName());
      }

      // INVARIANT: the base must be gone (and on disk) before the folder is. A missing local copy with a base reads as
      // "deleted on this device", and the next sync would delete the cloud track. Clearing the base first means a
      // crash at any point leaves either both copies (merged again, nothing lost) or a cloud-only song.
      state.pinned = false;
      state.keepInCloud = true;
      SyncState.clearBase(uid);
      SyncState.dequeue(uid);
      await SyncState.flush();
      if (!toxenapi.isDesktop()) return;
      await toxenapi.fs.promises.rm(dir, { recursive: true, force: true });
      SyncEngine.events.emit("song", { uid, local: null, remote });
    });
    SyncEngine._emitStatus(uid);
  }

  /**
   * Upload a local-only song. Resolves once it is in the cloud.
   * @throws If the upload fails (it stays queued and is retried), or the cloud is full.
   */
  public static async uploadToCloud(song: Song): Promise<void> {
    SyncEngine._requireDesktop("Uploading songs");
    await SyncEngine._requireStarted();
    const state = SyncState.getSong(song.uid);
    state.upload = true;
    SyncState.save();
    await SyncEngine._runNow(song.uid, "upload");
  }

  /**
   * Upload a new local song once it settles (imports). Unlike `uploadToCloud` this doesn't wait: the flag is kept in
   * `SyncState`, so the upload also happens after a restart.
   */
  public static markForUpload(uid: string): void {
    if (!SyncState.isLoaded()) return;
    SyncState.getSong(uid).upload = true;
    SyncState.save();
    SyncEngine.markDirty(uid, "local-change");
  }

  /**
   * Sync one song now: merge it with the cloud, or upload it if it is local only.
   */
  public static async syncSong(song: Song): Promise<void> {
    await SyncEngine._requireStarted();
    const state = SyncState.getSong(song.uid);
    if (SyncEngine._localSong(song.uid) && state.baseFiles === null && !(state.remote && !state.remote.deleted)) {
      state.upload = true;
      SyncState.save();
    }
    await SyncEngine._runNow(song.uid, "local-change");
  }

  /**
   * Delete a song from this device, the cloud, or both (the Delete dialog, plan §2.1).
   * - `device`: the local copy only. A song that is also in the cloud becomes cloud only (local changes that haven't
   *   synced yet are pushed first when the cloud can be reached).
   * - `cloud`: the cloud copy only. A song with a local copy becomes local only and isn't uploaded again.
   * - `everywhere`: both. Offline, the cloud delete waits in the queue.
   */
  public static async deleteFrom(song: Song, scope: SyncEngine.DeleteScope): Promise<void> {
    const uid = song.uid;
    const state = SyncState.getSong(uid);
    const remote = state.remote && !state.remote.deleted ? state.remote : null;
    const local = toxenapi.isDesktop() ? SyncEngine._localSong(uid) : null;

    if (scope === "device") {
      if (!local) return;
      if (remote) {
        if (SyncEngine._running && state.baseFiles !== null) await SyncEngine._runNow(uid, "local-change").catch(error => console.warn("Unable to push local changes before removing the download.", error));
        await SyncEngine.removeDownload(song, true);
        return;
      }
      await SyncEngine._deleteLocalFolder(uid, local);
      SyncState.removeSong(uid);
      SyncEngine.events.emit("song", { uid, local: null, remote: null });
      return;
    }

    if (!remote) {
      // No manifest known (yet): delete in the cloud unconditionally, the server ignores tracks it doesn't have
      if (!toxenapi.isDesktop() || !local) await CloudSongStorage.instance.deleteSong(song).catch(error => console.warn("Unable to delete the song from the cloud.", error));
      if (scope === "everywhere" && local) await SyncEngine._deleteLocalFolder(uid, local);
      if (scope === "everywhere" || !local) {
        SyncState.removeSong(uid);
        SyncEngine.events.emit("song", { uid, local: null, remote: null });
      }
      return;
    }

    await SyncEngine.prepare();
    await SyncEngine._exclusive(uid, async () => {
      // The base goes first, so the local copy (kept or about to go) never reads as a deletion to push
      SyncState.clearBase(uid);
      state.upload = false;
      state.pinned = false;
      if (scope === "everywhere" && local) {
        await SyncState.flush();
        await SyncEngine._deleteLocalFolder(uid, local);
      }
      try {
        await SyncEngine._deleteRemote(uid, remote.rev);
      } catch (error) {
        if (!(error instanceof SyncApi.HttpError) || !error.isTransient()) throw error;
        SyncEngine._enqueue(uid, "delete-cloud");
      }
      const keepsLocal = scope === "cloud" && local;
      if (!keepsLocal && !SyncState.data.pending.some(job => job.uid === uid)) SyncState.removeSong(uid);
      SyncEngine.events.emit("song", { uid, local: keepsLocal ? { dirname: local.paths.dirname, info: local.toISong() } : null, remote: null });
    });
    SyncEngine._emitStatus(uid);
    SyncEngine._pump();
  }

  //#endregion

  //#region State for the UI

  public static getSongStatus(uid: string): SyncEngine.SongStatus {
    const state = SyncState.peekSong(uid);
    const conflicts = SyncState.data.conflicts.filter(conflict => conflict.uid === uid).length;
    const active = SyncEngine._active.get(uid);
    if (active) {
      const progress = active.total > 0 ? Math.min(1, (active.done + active.current) / active.total) : null;
      return { status: active.direction === "up" ? SyncEngine.Status.Uploading : SyncEngine.Status.Downloading, progress, error: null, conflicts };
    }
    const local = SyncEngine._isLocal(uid);
    const remoteLive = Boolean(state?.remote && !state.remote.deleted);
    if (state?.lastError) return { status: SyncEngine.Status.Error, progress: null, error: state.lastError.message, conflicts };
    if (SyncEngine._running && SyncState.data.pending.some(job => job.uid === uid)) return { status: SyncEngine.Status.Queued, progress: null, error: null, conflicts };
    if (conflicts > 0) return { status: SyncEngine.Status.Conflict, progress: null, error: null, conflicts };
    if (local && remoteLive && state.baseFiles !== null) return { status: SyncEngine.Status.Synced, progress: null, error: null, conflicts };
    if (!local && remoteLive) return { status: SyncEngine.Status.CloudOnly, progress: null, error: null, conflicts };
    return { status: SyncEngine.Status.LocalOnly, progress: null, error: null, conflicts };
  }

  public static getSummary(): SyncEngine.Summary {
    const me = SyncEngine._me;
    const errors = Object.values(SyncState.data.songs).filter(state => state.lastError).length;
    let state: SyncEngine.Summary["state"];
    if (!SyncEngine._running) state = "disabled";
    else if (SyncEngine._offline) state = "offline";
    else if (SyncEngine._inFlight.size > 0 || SyncEngine._pulling) state = "syncing";
    else if (errors > 0 || SyncEngine._uploadsBlocked) state = "error";
    else state = "idle";
    return {
      state,
      disabledReason: SyncEngine._running ? null : SyncEngine._disabledReason,
      autoSync: SyncEngine._auto,
      pending: SyncState.data.pending.length,
      lastSyncAt: SyncState.data.lastSyncAt,
      storageUsed: me?.storageUsed ?? null,
      storageQuota: me?.storageQuota ?? null,
      tier: me?.tier ?? null,
      readOnly: Boolean(me?.readOnly) || SyncEngine._uploadsBlocked !== null,
      uploadsBlockedReason: SyncEngine._uploadsBlocked ? SyncEngine._quotaMessage(SyncEngine._uploadsBlocked.storageUsed, SyncEngine._uploadsBlocked.storageQuota) : null,
      deletesBlocked: SyncEngine._deletesBlocked,
      conflicts: SyncState.data.conflicts.length,
      errors,
    };
  }

  public static getConflicts(uid?: string): Merge.ConflictRecord[] {
    return SyncState.data.conflicts.filter(conflict => uid === undefined || conflict.uid === uid);
  }

  /**
   * Apply the user's choices from the diff view as one ordinary commit, then drop the record and the copies that
   * are no longer wanted. Items without a choice keep the automatic outcome.
   * - File, keep the winner: the conflict copy is deleted. Keep the loser: the copy replaces the file. Keep both:
   *   nothing changes (the copy stays, e.g. as an alternate subtitle file).
   * - Info field: the chosen side's value is written.
   */
  public static async resolveConflict(conflictId: string, choices: Merge.ConflictChoice[]): Promise<void> {
    const record = SyncState.data.conflicts.find(conflict => conflict.id === conflictId);
    if (!record) throw new Error("This conflict was already resolved or has expired.");
    const uid = record.uid;
    const local = toxenapi.isDesktop() ? SyncEngine._localSong(uid) : null;

    await SyncEngine._exclusive(uid, async () => {
      if (local && toxenapi.isDesktop()) await SyncEngine._resolveLocally(record, choices, local);
      else await SyncEngine._resolveInCloud(record, choices);
      SyncState.removeConflict(conflictId);
    });
    SyncEngine.events.emit("conflicts", SyncEngine.getConflicts());
    SyncEngine._emitStatus(uid);
    if (local && SyncEngine._running) await SyncEngine._runNow(uid, "local-change");
  }

  /**
   * This machine's auto-download preference (stored in `SyncState.machine`, never synced).
   */
  public static getAutoDownload(): boolean {
    return SyncState.machine.autoDownload;
  }

  /**
   * Turn auto-download of new cloud songs on or off for this machine. Turning it on queues every cloud-only song
   * except the ones whose download the user removed.
   */
  public static setAutoDownload(enabled: boolean): void {
    SyncState.machine.autoDownload = enabled;
    SyncState.saveMachine().catch(error => console.error("Unable to save this machine's sync settings.", error));
    if (!enabled || !SyncEngine._running || !toxenapi.isDesktop()) return;
    for (const [uid, state] of Object.entries(SyncState.data.songs)) {
      if (state.remote && !state.remote.deleted && !state.keepInCloud && !SyncEngine._localSong(uid)) SyncEngine._enqueue(uid, "download");
    }
    SyncEngine._pump();
  }

  //#endregion

  //#region Queue

  /**
   * Queue a job, remembering that a running job for the same song has to run once more afterwards.
   */
  private static _enqueue(uid: string, reason: SyncState.PendingReason): void {
    SyncState.enqueue(uid, reason);
    if (SyncEngine._inFlight.has(uid)) SyncEngine._rerun.add(uid);
    SyncEngine._emitStatus(uid);
  }

  /**
   * Queue a job for now and wait for its outcome.
   */
  private static _runNow(uid: string, reason: SyncState.PendingReason): Promise<void> {
    const job = SyncState.enqueue(uid, reason);
    job.notBefore = Date.now();
    if (SyncEngine._inFlight.has(uid)) SyncEngine._rerun.add(uid);
    const done = new Promise<void>((resolve, reject) => {
      const list = SyncEngine._waiters.get(uid) ?? [];
      list.push({ resolve, reject });
      SyncEngine._waiters.set(uid, list);
    });
    SyncEngine._emitStatus(uid);
    SyncEngine._pump();
    return done;
  }

  /**
   * Start due jobs up to `CONCURRENCY`, and schedule the next look for jobs that are still backing off.
   */
  private static _pump(): void {
    if (SyncEngine._pumpTimer) {
      clearTimeout(SyncEngine._pumpTimer);
      SyncEngine._pumpTimer = null;
    }
    if (!SyncEngine._running) return;
    const now = Date.now();
    const waiting = SyncState.data.pending
      .filter(job => !SyncEngine._inFlight.has(job.uid))
      .sort((a, b) => a.notBefore - b.notBefore || a.enqueuedAt - b.enqueuedAt);

    for (const job of waiting) {
      if (SyncEngine._inFlight.size >= SyncEngine.CONCURRENCY) break;
      if (job.notBefore > now) continue;
      SyncEngine._inFlight.add(job.uid);
      SyncEngine._runJob(job).finally(() => {
        SyncEngine._inFlight.delete(job.uid);
        SyncEngine._pump();
      });
    }

    const next = SyncState.data.pending.filter(job => !SyncEngine._inFlight.has(job.uid)).reduce((min, job) => Math.min(min, job.notBefore), Infinity);
    if (Number.isFinite(next) && SyncEngine._inFlight.size < SyncEngine.CONCURRENCY) {
      SyncEngine._pumpTimer = setTimeout(() => SyncEngine._pump(), Math.max(50, next - now));
    }
    SyncEngine._emitSummary();
    if (SyncEngine._inFlight.size === 0 && !SyncState.data.pending.some(job => job.notBefore <= now)) {
      const waiters = SyncEngine._idleWaiters.splice(0);
      waiters.forEach(resolve => resolve());
    }
  }

  private static _whenIdle(): Promise<void> {
    if (SyncEngine._inFlight.size === 0 && !SyncState.data.pending.some(job => job.notBefore <= Date.now())) return Promise.resolve();
    return new Promise(resolve => SyncEngine._idleWaiters.push(resolve));
  }

  private static async _runJob(job: SyncState.PendingJob): Promise<void> {
    const uid = job.uid;
    SyncEngine._rerun.delete(uid);
    try {
      await SyncEngine._exclusive(uid, () => SyncEngine._processJob(job));
      if (SyncEngine._rerun.delete(uid)) {
        job.attempts = 0;
        job.notBefore = Date.now();
        SyncState.save();
      }
      else {
        SyncState.dequeue(uid);
      }
      SyncEngine._offline = false;
      SyncEngine._settleWaiters(uid, null);
    } catch (error) {
      if (!SyncEngine._running && (error as Error)?.name === "AbortError") {
        // Stopped mid-transfer: the job stays queued for the next start
        SyncEngine._settleWaiters(uid, new Error("Sync was stopped."));
        return;
      }
      SyncEngine._handleJobFailure(job, error);
    } finally {
      SyncEngine._active.delete(uid);
      SyncEngine._emitStatus(uid);
    }
  }

  private static _handleJobFailure(job: SyncState.PendingJob, error: unknown): void {
    const uid = job.uid;
    const failure = SyncEngine._toFailure(uid, error);
    if (error instanceof SyncApi.HttpError && error.status === 401) {
      SyncEngine._settleWaiters(uid, new Error(failure.message));
      SyncEngine.events.emit("error", failure);
      SyncEngine.stop().then(() => SyncEngine._disable("Your session has expired. Log in again to sync."));
      return;
    }
    if (failure.code === "network") SyncEngine._offline = true;

    job.attempts++;
    const retryAfter = error instanceof SyncApi.HttpError ? error.retryAfterMs ?? 0 : 0;
    job.notBefore = Date.now() + Math.max(retryAfter, Math.min(SyncEngine.BACKOFF_MAX_MS, SyncEngine.BACKOFF_BASE_MS * 2 ** (job.attempts - 1)));
    const state = SyncState.getSong(uid);
    state.lastError = { message: failure.message, code: failure.code === "server-outdated" || failure.code === "missing-songs" ? "unknown" : failure.code, at: Date.now(), attempts: job.attempts };
    SyncState.save();
    console.warn(`Sync of ${uid} failed (attempt ${job.attempts}).`, error);
    // Network trouble shows in the summary; only real failures are worth a notification, and only once per song
    if (failure.code !== "network" && job.attempts === 1) SyncEngine.events.emit("error", failure);
    SyncEngine._settleWaiters(uid, new Error(failure.message));
  }

  private static _settleWaiters(uid: string, error: Error | null): void {
    const waiters = SyncEngine._waiters.get(uid);
    if (!waiters) return;
    SyncEngine._waiters.delete(uid);
    for (const waiter of waiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
  }

  /**
   * Run `fn` after every earlier exclusive call for the same song.
   */
  private static _exclusive<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    const previous = SyncEngine._locks.get(uid) ?? Promise.resolve();
    const run = previous.catch(() => { }).then(fn);
    const lock = run.then(() => { }, () => { });
    SyncEngine._locks.set(uid, lock);
    lock.then(() => {
      if (SyncEngine._locks.get(uid) === lock) SyncEngine._locks.delete(uid);
    });
    return run;
  }

  private static async _processJob(job: SyncState.PendingJob): Promise<void> {
    // A failure of this run sets it again; a quota stop during the run (pull-only) sets it as well
    const state = SyncState.peekSong(job.uid);
    if (state?.lastError) {
      state.lastError = null;
      SyncState.save();
    }
    if (job.reason === "delete-cloud") {
      const remote = SyncState.peekSong(job.uid)?.remote;
      if (remote && !remote.deleted) await SyncEngine._deleteRemote(job.uid, remote.rev);
      if (!SyncEngine._localSong(job.uid)) SyncState.removeSong(job.uid);
      return;
    }
    if (!toxenapi.isDesktop()) return;
    await SyncEngine._syncSong(job.uid, job.reason);
  }

  //#endregion

  //#region Pull

  private static _schedulePull(): void {
    if (SyncEngine._remoteTimer) return;
    SyncEngine._remoteTimer = setTimeout(() => {
      SyncEngine._remoteTimer = null;
      SyncEngine._pull().catch(error => SyncEngine._reportBackgroundError(error));
    }, SyncEngine.REMOTE_EVENT_DELAY_MS);
  }

  /**
   * Fetch every change since `lastPulledRev` and queue the songs they touch. Concurrent calls share one pull; a call
   * during a pull runs one more afterwards.
   */
  private static _pull(): Promise<void> {
    if (SyncEngine._pulling) {
      SyncEngine._pullAgain = true;
      return SyncEngine._pulling;
    }
    SyncEngine._pulling = (async () => {
      do {
        SyncEngine._pullAgain = false;
        await SyncEngine._pullOnce();
      } while (SyncEngine._pullAgain && SyncEngine._running);
    })().finally(() => {
      SyncEngine._pulling = null;
      SyncEngine._emitSummary();
    });
    SyncEngine._emitSummary();
    return SyncEngine._pulling;
  }

  private static async _pullOnce(): Promise<void> {
    const data = SyncState.data;
    let since = data.lastPulledRev;
    let fullResync = false;
    const seen = new Set<string>();
    const touched = new Set<string>();
    for (;;) {
      const page = await SyncApi.getChanges({ since });
      SyncEngine._offline = false;
      fullResync ||= page.fullResync;
      for (const change of page.changes) {
        if (change.kind !== "track") continue; // Playlists move onto the changelog later; unknown kinds are ignored
        seen.add(change.uid);
        if (SyncEngine._storeRemote(change.manifest)) touched.add(change.uid);
      }
      since = page.nextSince;
      // During a full resync the cursor only moves once every page is in, so an interruption starts it over
      if (!fullResync) data.lastPulledRev = since;
      SyncState.save();
      if (!page.hasMore) break;
    }

    if (fullResync) {
      // Anything with a live manifest the full listing didn't mention was deleted while we weren't looking
      for (const [uid, state] of Object.entries(data.songs)) {
        if (!state.remote || state.remote.deleted || seen.has(uid)) continue;
        state.remote = { ...state.remote, files: {}, deleted: true, deletedAt: Date.now() };
        touched.add(uid);
      }
      data.lastPulledRev = since;
    }
    data.lastSyncAt = Date.now();
    SyncState.save();

    const newCloudSongs: string[] = [];
    for (const uid of touched) {
      if (SyncEngine._onRemoteChanged(uid)) newCloudSongs.push(uid);
    }
    if (newCloudSongs.length > 0) {
      CloudSongStorage.instance.ensureMediaTokens(newCloudSongs).catch(error => console.warn("Unable to get media tokens.", error));
    }
    SyncEngine._pump();
  }

  /**
   * Store a manifest from the server unless an equal or newer rev is already known.
   * @returns Whether it was stored.
   */
  private static _storeRemote(manifest: SyncV2.TrackManifest): boolean {
    const state = SyncState.getSong(manifest.uid);
    if (state.remote && state.remote.rev > manifest.rev) return false;
    if (state.remote && state.remote.rev === manifest.rev && state.remote.deleted === manifest.deleted) return false;
    state.remote = manifest;
    SyncState.save();
    return true;
  }

  /**
   * React to a new manifest: queue a merge for songs with a local copy or a base, tell the library about cloud-only
   * songs, and queue downloads this device wants.
   * @returns Whether the song is a live cloud-only song (needs a media token).
   */
  private static _onRemoteChanged(uid: string): boolean {
    const state = SyncState.getSong(uid);
    const remote = state.remote;
    const live = Boolean(remote && !remote.deleted);
    const local = toxenapi.isDesktop() ? SyncEngine._localSong(uid) : null;

    if (local || state.baseFiles !== null) {
      SyncEngine._enqueue(uid, "remote-change");
      return false;
    }
    SyncEngine.events.emit("song", { uid, local: null, remote: live ? remote : null });
    if (!live) {
      SyncState.removeSong(uid);
      return false;
    }
    if (toxenapi.isDesktop() && (state.pinned || (SyncState.machine.autoDownload && !state.keepInCloud))) SyncEngine._enqueue(uid, "download");
    SyncEngine._emitStatus(uid);
    return true;
  }

  /**
   * Startup (and "Sync now"): pull, then queue every local song that changed since its base, every local song that
   * also exists in the cloud but was never merged, synced songs whose folder is gone, and wanted downloads.
   */
  private static async _startupPass(): Promise<void> {
    try {
      await SyncEngine._pull();
    } catch (error) {
      SyncEngine._reportBackgroundError(error);
    }
    if (!toxenapi.isDesktop()) return;
    const library = SyncEngine._library;
    if (!library) return;

    const localUids = new Set<string>();
    for (const song of library.getSongs()) {
      if (!SyncEngine._hasLocalCopy(song)) continue;
      localUids.add(song.uid);
      const state = SyncState.peekSong(song.uid);
      if (!state) continue;
      if (state.upload) {
        SyncEngine._enqueue(song.uid, "upload");
        continue;
      }
      const remoteLive = Boolean(state.remote && !state.remote.deleted);
      if (state.baseFiles === null) {
        if (remoteLive) SyncEngine._enqueue(song.uid, "local-change"); // On both sides, never merged (first v2 sync)
        continue;
      }
      let dir: string;
      try {
        dir = LocalSongStorage.instance.songDir(song);
      } catch {
        continue;
      }
      const infoChanged = !SyncEngine._sameJson(CloudSongStorage.toCloudInfo(song.toISong()), state.baseInfo ?? {});
      if (infoChanged || await Manifest.hasLocalChanges(dir, state.hashCache) || (state.remote && state.remote.rev !== state.baseRev)) {
        SyncEngine._enqueue(song.uid, "local-change");
      }
    }

    // Synced songs whose folder is gone: deleted on this device, unless the library itself is missing
    const missing = Object.entries(SyncState.data.songs).filter(([uid, state]) => state.baseFiles !== null && !localUids.has(uid));
    const based = Object.values(SyncState.data.songs).filter(state => state.baseFiles !== null).length;
    if (missing.length > 0) {
      const tooMany = missing.length > SyncEngine.MISSING_COUNT_LIMIT && missing.length > based * SyncEngine.MISSING_RATIO_LIMIT;
      if (!library.isComplete() || !await SyncEngine._libraryDirExists() || (tooMany && !SyncEngine._deletesConfirmed)) {
        SyncEngine._deletesBlocked = missing.length;
        SyncEngine.events.emit("error", {
          uid: null,
          message: `${missing.length} synced songs are missing from your library folder. Sync won't delete them from the cloud until you confirm. If the folder moved or a drive isn't connected, fix that first.`,
          code: "missing-songs",
        });
      }
      else {
        for (const [uid] of missing) SyncEngine._enqueue(uid, "local-change");
      }
    }

    for (const [uid, state] of Object.entries(SyncState.data.songs)) {
      if (localUids.has(uid) || state.baseFiles !== null || !state.remote || state.remote.deleted) continue;
      if (state.pinned || (SyncState.machine.autoDownload && !state.keepInCloud)) SyncEngine._enqueue(uid, "download");
    }
    await SyncEngine._cleanIncoming();
  }

  /**
   * Web: keep media tokens for the whole cloud library.
   */
  private static _refreshCloudSongs(): void {
    const uids = Object.entries(SyncState.data.songs).filter(([, state]) => state.remote && !state.remote.deleted).map(([uid]) => uid);
    if (uids.length > 0) CloudSongStorage.instance.ensureMediaTokens(uids).catch(error => console.warn("Unable to get media tokens.", error));
  }

  private static async _refreshMe(): Promise<void> {
    try {
      SyncEngine._me = await SyncApi.getMe();
      SyncEngine._offline = false;
      if (SyncEngine._uploadsBlocked && !SyncEngine._me.readOnly && SyncEngine._me.storageUsed < SyncEngine._me.storageQuota) {
        SyncEngine._uploadsBlocked = null;
        for (const [uid, state] of Object.entries(SyncState.data.songs)) {
          if (state.lastError?.code === SyncV2.ErrorCode.QuotaExceeded) SyncEngine._enqueue(uid, "local-change");
        }
      }
    } catch (error) {
      if (error instanceof SyncApi.HttpError && error.status === 0) SyncEngine._offline = true;
      else console.warn("Unable to refresh the account's storage.", error);
    }
    SyncEngine._emitSummary();
  }

  //#endregion

  //#region Sync one song

  /**
   * Plan and apply one song, re-planning after a stale base up to `MAX_COMMIT_RETRIES` times.
   */
  private static async _syncSong(uid: string, reason: SyncState.PendingReason): Promise<void> {
    const state = SyncState.getSong(uid);
    for (let attempt = 0; ; attempt++) {
      try {
        await SyncEngine._syncSongOnce(uid, reason, state);
        return;
      } catch (error) {
        if (!(error instanceof StaleBaseError)) throw error;
        if (attempt >= SyncEngine.MAX_COMMIT_RETRIES) {
          throw new Error("This song kept changing in the cloud while it was syncing. It is tried again later.");
        }
      }
    }
  }

  private static async _syncSongOnce(uid: string, reason: SyncState.PendingReason, state: SyncState.SongState): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const song = SyncEngine._localSong(uid);
    const dir = song ? SyncEngine._songDirOrNull(song) : null;
    const hasFolder = dir !== null && await toxenapi.fs.promises.stat(dir).then(stat => stat.isDirectory()).catch(() => false);
    const remoteLive = state.remote && !state.remote.deleted ? state.remote : null;
    const hasBase = state.baseFiles !== null;

    // Cheap decisions before anything is hashed
    if (!hasFolder && !hasBase) {
      if (!remoteLive) {
        SyncState.removeSong(uid);
        SyncEngine.events.emit("song", { uid, local: null, remote: null });
        return;
      }
      const wanted = reason === "download" || state.pinned || (SyncState.machine.autoDownload && !state.keepInCloud);
      if (!wanted) return;
    }
    if (hasFolder && !hasBase && !remoteLive && !state.upload) return; // Local only, nobody asked to upload it
    if (!hasFolder && hasBase && !SyncEngine._deletesConfirmed && (SyncEngine._deletesBlocked > 0 || !SyncEngine._library?.isComplete() || !await SyncEngine._libraryDirExists())) {
      throw new Error("The song's folder is missing, but the library folder isn't fully available. Sync waits instead of deleting it from the cloud.");
    }

    // Local side
    let local: Merge.PlanInput["local"] = null;
    let localInfo: ISong | null = null;
    let hashCache = state.hashCache;
    if (hasFolder) {
      const read = await SyncEngine._readLocal(dir, state);
      local = read.local;
      localInfo = read.info;
      hashCache = read.hashCache;
    }

    const remote = state.remote ? { ...state.remote, info: CloudSongStorage.toCloudInfo(state.remote.info) } : null;
    const base = hasBase ? { rev: state.baseRev, info: state.baseInfo, infoUpdatedAt: state.baseInfoUpdatedAt, files: state.baseFiles } : null;
    const plan = Merge.planSong({ uid, base, local, remote, now: Date.now() });

    switch (plan.song) {
      case "noop":
        state.hashCache = hashCache;
        state.upload = false;
        SyncState.save();
        return;
      case "tombstone":
        await SyncEngine._deleteRemote(uid, plan.baseRev);
        SyncState.removeSong(uid);
        SyncEngine.events.emit("song", { uid, local: null, remote: null });
        return;
      case "delete-local":
        if (song) await SyncEngine._deleteLocalFolder(uid, song);
        SyncState.removeSong(uid);
        SyncEngine.events.emit("song", { uid, local: null, remote: null });
        return;
      case "push-new":
        if (!hasBase && !state.upload) return;
        break;
      case "pull-new":
      case "sync":
        break;
    }

    SyncEngine._emitKept(uid, plan, base, local, remote, localInfo);
    await SyncEngine._applyPlan(uid, plan, state, song, hasFolder ? dir : null, localInfo, hashCache);
  }

  /**
   * Read a song folder: its info (as the cloud keeps it) and its scanned files.
   * @throws If `info.json` can't be read: syncing a song without its info would push an empty one.
   */
  private static async _readLocal(dir: string, state: SyncState.SongState): Promise<{ local: Merge.PlanInput["local"]; info: ISong; hashCache: Record<string, SyncState.HashCacheEntry> }> {
    if (!toxenapi.isDesktop()) throw new Error("Local copies only exist on desktop.");
    const infoPath = toxenapi.path.join(dir, SongStorage.INFO_FILE);
    let info: ISong;
    let infoMtime = 0;
    try {
      info = JSON.parse(await toxenapi.fs.promises.readFile(infoPath, "utf8"));
      infoMtime = (await toxenapi.fs.promises.stat(infoPath)).mtimeMs;
    } catch (error) {
      throw new Error(`The song's info.json can't be read, so it isn't synced until it is fixed: ${error?.message ?? error}`);
    }
    const scan = await Manifest.scanLocal(dir, state.hashCache);
    const cloudInfo = CloudSongStorage.toCloudInfo(info);
    // Unchanged since the base: keep the base's time, so a rewrite of the same values never wins a conflict
    const infoUpdatedAt = state.baseInfo && SyncEngine._sameJson(cloudInfo, state.baseInfo)
      ? state.baseInfoUpdatedAt
      : Math.max(state.localInfoUpdatedAt, Math.round(infoMtime));
    return { local: { info: cloudInfo, infoUpdatedAt, files: scan.files }, info, hashCache: scan.hashCache };
  }

  /**
   * Apply a plan in the order `Merge.SyncPlan` documents: uploads -> commit -> local moves/deletes -> downloads ->
   * info -> base. A new download is assembled in `.toxen/incoming/<uid>` and moved into the library when complete,
   * so a killed app never leaves a half-written song folder.
   */
  private static async _applyPlan(uid: string, plan: Merge.SyncPlan, state: SyncState.SongState, song: Song | null, dir: string | null, localInfo: ISong | null, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const signal = SyncEngine._abort.signal;
    const files = plan.files;

    // 1. Uploads, read from disk before anything local changes
    if (files.uploads.length > 0) {
      if (!dir) throw new Error("Nothing to upload from: the song has no local folder.");
      const blocked = SyncEngine._uploadsBlocked || SyncEngine._me?.readOnly
        || (SyncEngine._me && SyncEngine._me.storageUsed + files.uploadBytes > SyncEngine._me.storageQuota);
      if (blocked) {
        SyncEngine._blockUploads(SyncEngine._uploadsBlocked ?? SyncEngine._quotaFromMe(files.uploadBytes));
        return SyncEngine._applyPullOnly(uid, plan, state, dir, localInfo, hashCache);
      }
      const missing = new Set(await SyncApi.findMissingBlobs(files.uploads.map(upload => upload.sha256)));
      const toSend = files.uploads.filter(upload => missing.has(upload.sha256));
      SyncEngine._startActive(uid, "up", toSend.reduce((sum, upload) => sum + upload.size, 0));
      for (const upload of toSend) {
        const result = await Transfer.uploadBlob(uid, upload.localPath, { sha256: upload.sha256, size: upload.size }, { diskPath: api.path.join(dir, ...upload.localPath.split("/")) }, progress => SyncEngine._onProgress(progress), signal);
        SyncEngine._finishActiveFile(uid, upload.size);
        if (result.ok === true) continue;
        if (result.body.code === SyncV2.ErrorCode.QuotaExceeded) {
          SyncEngine._blockUploads(result.body as SyncV2.QuotaExceededErrorResponse);
          SyncEngine._active.delete(uid);
          return SyncEngine._applyPullOnly(uid, plan, state, dir, localInfo, hashCache);
        }
        // The file changed after it was hashed: hash it again on the next try
        delete state.hashCache[upload.localPath];
        throw new Error(`"${upload.localPath}" changed while it was uploading. It is uploaded again shortly.`);
      }
      SyncEngine._active.delete(uid);
    }

    // 2. Commit (or nothing to commit)
    let rev = plan.baseRev;
    const request = Merge.toCommitRequest(plan);
    if (request) {
      const result = await SyncApi.commit(uid, request);
      if (result.ok === false) {
        const failure = result.body;
        if (failure.code === SyncV2.ErrorCode.StaleBase) {
          const current = (failure as SyncV2.StaleBaseErrorResponse).current;
          if (current) SyncEngine._storeRemote(current);
          else if (state.remote) state.remote = { ...state.remote, files: {}, deleted: true, deletedAt: Date.now() };
          throw new StaleBaseError();
        }
        if (failure.code === SyncV2.ErrorCode.MissingBlobs) throw new StaleBaseError(); // Re-plan uploads what's missing
        if (failure.code === SyncV2.ErrorCode.QuotaExceeded) {
          SyncEngine._blockUploads(failure as SyncV2.QuotaExceededErrorResponse);
          return SyncEngine._applyPullOnly(uid, plan, state, dir, localInfo, hashCache);
        }
        throw new Error((failure as SyncV2.ErrorResponse).error); // A code newer than this client
      }
      rev = result.value.rev;
      state.remote = result.value.manifest;
      if (SyncEngine._me) {
        SyncEngine._me.storageUsed = result.value.storageUsed;
        SyncEngine._me.storageQuota = result.value.storageQuota;
      }
      SyncState.save();
    }

    // 3-4. Local changes, into a staging folder for a new download
    const isNew = !dir;
    const targetDir = dir ?? SyncEngine._incomingDir(uid);
    const changedPaths: string[] = [];
    const cache = { ...hashCache };
    for (const move of files.localMoves) {
      const from = api.path.join(targetDir, ...move.from.split("/"));
      const to = api.path.join(targetDir, ...move.to.split("/"));
      await api.fs.promises.mkdir(api.path.dirname(to), { recursive: true });
      await api.fs.promises.rename(from, to);
      if (cache[move.from]) cache[move.to] = cache[move.from];
      delete cache[move.from];
      changedPaths.push(move.from, move.to);
    }
    for (const relPath of files.localDeletes) {
      await api.fs.promises.rm(api.path.join(targetDir, ...relPath.split("/")), { force: true });
      delete cache[relPath];
      changedPaths.push(relPath);
    }
    await SyncEngine._download(uid, targetDir, files.downloads, cache, isNew, signal);
    changedPaths.push(...files.downloads.map(download => download.path));

    // 5. Info
    let folder = song?.paths?.dirname ?? null;
    if (isNew) folder = await SyncEngine._newFolderName(uid);
    const infoChanged = plan.infoToWrite !== null;
    let writtenInfo: ISong | null = localInfo;
    if (infoChanged || changedPaths.length > 0 || isNew) {
      const source = (plan.infoToWrite ?? CloudSongStorage.toCloudInfo(localInfo ?? {})) as Partial<ISong>;
      const sourcePaths = (source.paths && typeof source.paths === "object" ? source.paths : {}) as Partial<ISong["paths"]>;
      writtenInfo = {
        ...source,
        uid,
        paths: { media: null, background: null, subtitles: null, storyboard: null, ...sourcePaths, dirname: folder },
        // A new cache-busting hash when files changed, so backgrounds reload
        hash: changedPaths.length > 0 || !localInfo?.hash ? SyncEngine._newHash() : localInfo.hash,
      } as ISong;
      await api.atomicWriteFile(api.path.join(targetDir, SongStorage.INFO_FILE), JSON.stringify(writtenInfo));
    }
    if (isNew) {
      await api.fs.promises.rename(targetDir, LocalSongStorage.instance.folderPath(folder, uid));
    }

    // 6. Base
    state.baseRev = rev;
    state.baseFiles = plan.base.files;
    state.baseInfo = plan.base.info;
    state.baseInfoUpdatedAt = plan.base.infoUpdatedAt;
    state.localInfoUpdatedAt = plan.infoUpdatedAt;
    state.hashCache = Object.fromEntries(Object.entries(cache).filter(([path]) => Object.prototype.hasOwnProperty.call(plan.base.files, path)));
    state.upload = false;
    if (isNew) state.keepInCloud = false;
    SyncState.save();

    if (plan.conflict) {
      SyncState.addConflict(plan.conflict);
      SyncEngine.events.emit("conflict", plan.conflict);
      SyncEngine.events.emit("conflicts", SyncEngine.getConflicts());
    }
    // `song` first, so the library's Song is current when `applied` re-applies its files
    SyncEngine.events.emit("song", { uid, local: { dirname: folder, info: writtenInfo }, remote: state.remote && !state.remote.deleted ? state.remote : null });
    if (changedPaths.length > 0 || infoChanged) SyncEngine.events.emit("applied", { uid, paths: [...new Set(changedPaths)], infoChanged });
  }

  /**
   * Uploads aren't possible (cloud full or read-only): take what the cloud changed, keep this device's changes for
   * later. The base only moves for what was pulled, so the next merge still pushes the rest.
   */
  private static async _applyPullOnly(uid: string, plan: Merge.SyncPlan, state: SyncState.SongState, dir: string, localInfo: ISong | null, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const pulls = plan.files.actions.filter((action): action is Extract<Merge.FileAction, { type: "pull" }> => action.type === "pull");
    const deletes = plan.files.localDeletes;
    const pullInfo = plan.info !== null && plan.info.pull && !plan.info.push;
    const cache = { ...hashCache };

    if (pulls.length > 0 || deletes.length > 0 || pullInfo) {
      for (const relPath of deletes) {
        await api.fs.promises.rm(api.path.join(dir, ...relPath.split("/")), { force: true });
        delete cache[relPath];
      }
      await SyncEngine._download(uid, dir, pulls.map(pull => ({ path: pull.path, sha256: pull.version.sha256, size: pull.version.size })), cache, false, SyncEngine._abort.signal);

      const baseFiles = { ...(state.baseFiles ?? {}) };
      for (const pull of pulls) baseFiles[pull.path] = pull.version.sha256;
      for (const relPath of deletes) delete baseFiles[relPath];
      state.baseFiles = baseFiles;
      if (pullInfo && localInfo) {
        const merged = plan.info.merged as Partial<ISong>;
        const info = { ...merged, uid, paths: { ...(merged.paths ?? {}), dirname: localInfo.paths?.dirname }, hash: SyncEngine._newHash() } as ISong;
        await api.atomicWriteFile(api.path.join(dir, SongStorage.INFO_FILE), JSON.stringify(info));
        state.baseInfo = plan.info.merged;
        state.baseInfoUpdatedAt = state.remote?.infoUpdatedAt ?? plan.infoUpdatedAt;
        SyncEngine.events.emit("song", { uid, local: { dirname: localInfo.paths?.dirname, info }, remote: state.remote });
      }
      state.hashCache = cache;
      SyncEngine.events.emit("applied", { uid, paths: [...pulls.map(pull => pull.path), ...deletes], infoChanged: pullInfo });
    }

    const quota = SyncEngine._uploadsBlocked;
    state.lastError = {
      message: quota ? SyncEngine._quotaMessage(quota.storageUsed, quota.storageQuota) : "Uploads are paused.",
      code: SyncV2.ErrorCode.QuotaExceeded,
      at: Date.now(),
      attempts: 1,
    };
    SyncState.save();
  }

  /**
   * Download files into `dir`, updating `cache`. In a staging folder, files left by an interrupted run are kept when
   * their hash already matches, so the download resumes instead of starting over.
   */
  private static async _download(uid: string, dir: string, downloads: Merge.Download[], cache: Record<string, SyncState.HashCacheEntry>, resume: boolean, signal: AbortSignal): Promise<void> {
    if (!toxenapi.isDesktop() || downloads.length === 0) return;
    const api = toxenapi;
    SyncEngine._startActive(uid, "down", downloads.reduce((sum, download) => sum + download.size, 0));
    try {
      for (const download of downloads) {
        const dest = api.path.join(dir, ...download.path.split("/"));
        if (resume) {
          const existing = await api.hashFile(dest).catch((): null => null);
          if (existing?.sha256 === download.sha256) {
            cache[download.path] = { sha256: existing.sha256, size: existing.size, mtimeMs: existing.mtimeMs };
            SyncEngine._finishActiveFile(uid, download.size);
            continue;
          }
        }
        let result;
        try {
          result = await Transfer.downloadFile(uid, download.path, dest, download.sha256, progress => SyncEngine._onProgress(progress), signal);
        } catch (error) {
          // The path has other content (or is gone) by now: fetch the newest manifest and plan again
          if (error instanceof SyncApi.HttpError && (error.status === 409 || error.status === 404)) {
            await SyncEngine._pull();
            throw new StaleBaseError();
          }
          throw error;
        }
        cache[download.path] = { sha256: result.sha256, size: result.size, mtimeMs: result.mtimeMs };
        SyncEngine._finishActiveFile(uid, download.size);
      }
    } finally {
      SyncEngine._active.delete(uid);
    }
  }

  /**
   * Delete-vs-modify resolves to "the modification wins" without a conflict record (plan §2.4). Tell the UI, so it can
   * say "Kept your edited copy of X".
   */
  private static _emitKept(uid: string, plan: Merge.SyncPlan, base: Merge.PlanInput["base"], local: Merge.PlanInput["local"], remote: SyncV2.TrackManifest | null, localInfo: ISong | null): void {
    if (!base) return;
    const name = SyncEngine._displayName(uid, localInfo ?? (remote?.info as Partial<ISong>) ?? {});
    const remoteLive = remote && !remote.deleted ? remote : null;
    if (plan.song === "push-new" && remote?.deleted) {
      SyncEngine.events.emit("kept", { uid, songName: name, kept: "local", paths: [] });
      return;
    }
    if (plan.song === "pull-new" && !local) {
      SyncEngine.events.emit("kept", { uid, songName: name, kept: "remote", paths: [] });
      return;
    }
    if (plan.song !== "sync" || !local || !remoteLive) return;
    const baseFiles = base.files ?? {};
    const keptLocal: string[] = [];
    const keptRemote: string[] = [];
    for (const action of plan.files.actions) {
      if (!Object.prototype.hasOwnProperty.call(baseFiles, action.path)) continue;
      if (action.type === "push" && !Object.prototype.hasOwnProperty.call(remoteLive.files, action.path)) keptLocal.push(action.path);
      if (action.type === "pull" && !Object.prototype.hasOwnProperty.call(local.files, action.path)) keptRemote.push(action.path);
    }
    if (keptLocal.length > 0) SyncEngine.events.emit("kept", { uid, songName: name, kept: "local", paths: keptLocal });
    if (keptRemote.length > 0) SyncEngine.events.emit("kept", { uid, songName: name, kept: "remote", paths: keptRemote });
  }

  //#endregion

  //#region Conflicts

  private static async _resolveLocally(record: Merge.ConflictRecord, choices: Merge.ConflictChoice[], song: Song): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const dir = LocalSongStorage.instance.songDir(song);
    const state = SyncState.getSong(record.uid);
    let infoPatch: Record<string, unknown> | null = null;

    for (const choice of choices) {
      if (choice.type === "file") {
        const item = record.items.find((entry): entry is Merge.FileConflict => entry.type === "file" && entry.path === choice.path);
        if (!item || choice.keep === "both") continue;
        const filePath = api.path.join(dir, ...item.path.split("/"));
        const copyPath = api.path.join(dir, ...item.copyPath.split("/"));
        if (choice.keep !== item.winner) {
          // The kept version sits in the conflict copy: move it over the file
          if (await api.fs.promises.stat(copyPath).then(() => true).catch(() => false)) await api.fs.promises.rename(copyPath, filePath);
        }
        else {
          await api.fs.promises.rm(copyPath, { force: true });
        }
        continue;
      }
      const item = record.items.find((entry): entry is Merge.InfoConflict => entry.type === "info");
      const field = item?.fields.find(entry => entry.field === choice.field);
      if (!field || choice.keep === field.winner) continue;
      infoPatch ??= {};
      infoPatch[field.field] = choice.keep === "local" ? ("local" in field ? field.local : undefined) : ("remote" in field ? field.remote : undefined);
    }

    if (infoPatch) {
      const infoPath = api.path.join(dir, SongStorage.INFO_FILE);
      const info = JSON.parse(await api.fs.promises.readFile(infoPath, "utf8")) as Record<string, unknown>;
      for (const [field, value] of Object.entries(infoPatch)) SyncEngine._setField(info, field, value);
      info.hash = SyncEngine._newHash();
      await api.atomicWriteFile(infoPath, JSON.stringify(info));
      state.localInfoUpdatedAt = Date.now();
      SyncEngine.events.emit("song", { uid: record.uid, local: { dirname: song.paths.dirname, info: info as unknown as ISong }, remote: state.remote });
    }
    SyncEngine.events.emit("applied", { uid: record.uid, paths: record.items.filter((item): item is Merge.FileConflict => item.type === "file").map(item => item.path), infoChanged: infoPatch !== null });
    SyncState.save();
  }

  /**
   * Resolve a conflict for a song without a local copy (its download was removed since): commit the choices directly.
   */
  private static async _resolveInCloud(record: Merge.ConflictRecord, choices: Merge.ConflictChoice[]): Promise<void> {
    const state = SyncState.getSong(record.uid);
    for (let attempt = 0; attempt < SyncEngine.MAX_COMMIT_RETRIES; attempt++) {
      const remote = state.remote && !state.remote.deleted ? state.remote : null;
      if (!remote) return;
      const request: SyncV2.CommitRequest = { baseRev: remote.rev };
      const files: SyncV2.FileMap = {};
      const deletes: string[] = [];
      let info: SyncV2.SongInfo | null = null;
      for (const choice of choices) {
        if (choice.type === "file") {
          const item = record.items.find((entry): entry is Merge.FileConflict => entry.type === "file" && entry.path === choice.path);
          const copy = item ? remote.files[item.copyPath] : undefined;
          if (!item || !copy || choice.keep === "both") continue;
          if (choice.keep !== item.winner) files[item.path] = { sha256: copy.sha256, size: copy.size };
          deletes.push(item.copyPath);
          continue;
        }
        const item = record.items.find((entry): entry is Merge.InfoConflict => entry.type === "info");
        const field = item?.fields.find(entry => entry.field === choice.field);
        if (!field || choice.keep === field.winner) continue;
        info ??= { ...remote.info };
        SyncEngine._setField(info, field.field, choice.keep === "local" ? field.local : field.remote);
      }
      if (Object.keys(files).length > 0) request.files = files;
      if (deletes.length > 0) request.deletes = deletes;
      if (info) {
        request.info = CloudSongStorage.toCloudInfo(info);
        request.infoUpdatedAt = Date.now();
      }
      if (!request.files && !request.deletes && !request.info) return;
      const result = await SyncApi.commit(record.uid, request);
      if (result.ok === true) {
        SyncEngine._storeRemote(result.value.manifest);
        SyncEngine.events.emit("song", { uid: record.uid, local: null, remote: result.value.manifest });
        return;
      }
      if (result.body.code !== SyncV2.ErrorCode.StaleBase) throw new Error(result.body.error);
      const current = (result.body as SyncV2.StaleBaseErrorResponse).current;
      if (current) SyncEngine._storeRemote(current);
    }
    throw new Error("The song kept changing in the cloud. Try resolving the conflict again.");
  }

  /**
   * Set a (possibly dotted, `field.subKey`) info field; `undefined` removes it.
   */
  private static _setField(info: Record<string, unknown>, field: string, value: unknown): void {
    const dot = field.indexOf(".");
    if (dot === -1 || !(Merge.DEEP_MERGE_FIELDS as readonly string[]).includes(field.slice(0, dot))) {
      if (value === undefined) delete info[field];
      else info[field] = value;
      return;
    }
    const top = field.slice(0, dot);
    const sub = field.slice(dot + 1);
    const container = info[top] && typeof info[top] === "object" ? { ...(info[top] as Record<string, unknown>) } : {};
    if (value === undefined) delete container[sub];
    else container[sub] = value;
    info[top] = container;
  }

  private static _pruneConflicts(): void {
    if (SyncState.pruneConflicts(Date.now()).length > 0) SyncEngine.events.emit("conflicts", SyncEngine.getConflicts());
  }

  //#endregion

  //#region Helpers

  private static _addListeners(): void {
    LocalSongStorage.instance.on("change", SyncEngine._onLocalChange);
    window.addEventListener("online", SyncEngine._onOnline);
    window.addEventListener("offline", SyncEngine._onOffline);
  }

  private static _removeListeners(): void {
    LocalSongStorage.instance.off("change", SyncEngine._onLocalChange);
    window.removeEventListener("online", SyncEngine._onOnline);
    window.removeEventListener("offline", SyncEngine._onOffline);
  }

  private static _onLocalChange = (change: SongStorage.ChangeEvent): void => {
    if (change.action === "info") {
      SyncState.getSong(change.uid).localInfoUpdatedAt = Date.now();
      SyncState.save();
    }
    SyncEngine.markDirty(change.uid, "local-change");
  };

  private static _onOnline = (): void => {
    SyncEngine._offline = false;
    for (const job of SyncState.data.pending) {
      if (SyncState.peekSong(job.uid)?.lastError?.code === "network") job.notBefore = Date.now();
    }
    if (SyncEngine._auto) SyncEngine._pull().catch(error => SyncEngine._reportBackgroundError(error));
    SyncEngine._refreshMe();
    SyncEngine._pump();
  };

  private static _onOffline = (): void => {
    SyncEngine._offline = true;
    SyncEngine._emitSummary();
  };

  private static _startPolling(): void {
    if (SyncEngine._pollTimer) return;
    SyncEngine._pollTimer = setInterval(() => {
      SyncEngine._pruneConflicts();
      SyncEngine._refreshMe();
      SyncEngine._pull().catch(error => SyncEngine._reportBackgroundError(error));
    }, SyncEngine.POLL_INTERVAL_MS);
  }

  private static _stopPolling(): void {
    if (SyncEngine._pollTimer) clearInterval(SyncEngine._pollTimer);
    SyncEngine._pollTimer = null;
  }

  private static _disable(reason: string): void {
    SyncEngine._disabledReason = reason;
    SyncEngine._emitSummary();
  }

  private static async _requireStarted(): Promise<void> {
    if (SyncEngine._running) return;
    await SyncEngine.init();
    if (!SyncEngine._running) throw new Error(SyncEngine._disabledReason ?? "Sync isn't available.");
  }

  private static _requireDesktop(action: string): void {
    if (!toxenapi.isDesktop()) throw new Error(`${action} is only available in the desktop app.`);
  }

  /**
   * The library's song for `uid` when it has a local copy.
   */
  private static _localSong(uid: string): Song | null {
    const song = SyncEngine._library?.getSong(uid) ?? null;
    return song && SyncEngine._hasLocalCopy(song) ? song : null;
  }

  private static _hasLocalCopy(song: Song): boolean {
    return toxenapi.isDesktop() && Boolean(song.paths?.dirname) && (!song.location || song.location.local);
  }

  private static _isLocal(uid: string): boolean {
    return SyncEngine._localSong(uid) !== null;
  }

  private static _songDirOrNull(song: Song): string | null {
    try {
      return LocalSongStorage.instance.songDir(song);
    } catch {
      return null;
    }
  }

  private static async _libraryDirExists(): Promise<boolean> {
    if (!toxenapi.isDesktop()) return false;
    const library = Settings.get("libraryDirectory");
    if (!library) return false;
    return toxenapi.fs.promises.stat(library).then(stat => stat.isDirectory()).catch(() => false);
  }

  private static _incomingDir(uid: string): string {
    if (!toxenapi.isDesktop()) throw new Error("Downloads only exist on desktop.");
    return toxenapi.path.resolve(Settings.get("libraryDirectory"), SyncState.DIR_NAME, SyncEngine.INCOMING_DIR, uid);
  }

  /**
   * Remove staging folders of downloads nobody is waiting for anymore.
   */
  private static async _cleanIncoming(): Promise<void> {
    if (!toxenapi.isDesktop() || !Settings.get("libraryDirectory")) return;
    const api = toxenapi;
    const root = api.path.resolve(Settings.get("libraryDirectory"), SyncState.DIR_NAME, SyncEngine.INCOMING_DIR);
    const entries = await api.fs.promises.readdir(root).catch((): string[] => []);
    for (const uid of entries) {
      if (SyncState.data.pending.some(job => job.uid === uid) || SyncEngine._inFlight.has(uid)) continue;
      await api.fs.promises.rm(api.path.join(root, uid), { recursive: true, force: true }).catch(() => { });
    }
  }

  /**
   * A free folder name in the library for a downloaded song: its uid, or `<uid> (2)`…
   */
  private static async _newFolderName(uid: string): Promise<string> {
    if (!toxenapi.isDesktop()) return uid;
    const api = toxenapi;
    for (let n = 1; ; n++) {
      const name = n === 1 ? uid : `${uid} (${n})`;
      const exists = await api.fs.promises.stat(LocalSongStorage.instance.folderPath(name, uid)).then(() => true).catch(() => false);
      if (!exists) return name;
    }
  }

  private static async _deleteLocalFolder(uid: string, song: Song): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const dir = LocalSongStorage.instance.songDir(song);
    await toxenapi.fs.promises.rm(dir, { recursive: true, force: true })
      .catch(() => toxenapi.isDesktop() && toxenapi.fs.promises.rm(dir, { recursive: true, force: true }));
  }

  /**
   * `DELETE /tracks/:uid`, retried against the current rev when another device changed the track in between.
   */
  private static async _deleteRemote(uid: string, baseRev: number | null): Promise<void> {
    let rev = baseRev ?? undefined;
    for (let attempt = 0; attempt <= SyncEngine.MAX_COMMIT_RETRIES; attempt++) {
      const result = await SyncApi.deleteTrack(uid, rev);
      if (result.ok === true) {
        const state = SyncState.getSong(uid);
        if (state.remote) state.remote = { ...state.remote, rev: result.value.rev, files: {}, deleted: true, deletedAt: Date.now() };
        if (SyncEngine._me) {
          SyncEngine._me.storageUsed = result.value.storageUsed;
          SyncEngine._me.storageQuota = result.value.storageQuota;
        }
        SyncState.save();
        return;
      }
      const current = result.body.current;
      if (!current || current.deleted) return;
      SyncEngine._storeRemote(current);
      rev = current.rev;
    }
    throw new Error("The song kept changing in the cloud while it was being deleted. It is tried again later.");
  }

  /**
   * Whether the local copy has changes the cloud doesn't: files or info that differ from the base, or from the cloud
   * when there is no base yet.
   */
  private static async _hasUnsyncedChanges(uid: string, dir: string, state: SyncState.SongState, remote: SyncV2.TrackManifest): Promise<boolean> {
    if (!toxenapi.isDesktop()) return false;
    const read = await SyncEngine._readLocal(dir, state).catch((): null => null);
    if (!read) return true;
    const reference = state.baseFiles ?? Object.fromEntries(Object.entries(remote.files).map(([path, entry]) => [path, entry.sha256]));
    const referenceInfo = state.baseInfo ?? CloudSongStorage.toCloudInfo(remote.info);
    const localFiles = Object.fromEntries(Object.entries(read.local.files).map(([path, version]) => [path, version.sha256]));
    return !SyncEngine._sameJson(localFiles, reference) || !SyncEngine._sameJson(read.local.info, referenceInfo);
  }

  private static _blockUploads(quota: SyncV2.QuotaExceededErrorResponse): void {
    const first = SyncEngine._uploadsBlocked === null;
    SyncEngine._uploadsBlocked = quota;
    if (SyncEngine._me) {
      SyncEngine._me.storageUsed = quota.storageUsed;
      SyncEngine._me.storageQuota = quota.storageQuota;
    }
    if (first) {
      SyncEngine.events.emit("error", { uid: null, message: `${SyncEngine._quotaMessage(quota.storageUsed, quota.storageQuota)} Uploads are paused; downloads continue.`, code: SyncV2.ErrorCode.QuotaExceeded });
    }
    SyncEngine._emitSummary();
  }

  private static _quotaFromMe(required: number): SyncV2.QuotaExceededErrorResponse {
    const me = SyncEngine._me;
    return {
      error: "The upload would exceed your storage quota.",
      code: SyncV2.ErrorCode.QuotaExceeded,
      storageUsed: me?.storageUsed ?? 0,
      storageQuota: me?.storageQuota ?? 0,
      required,
    };
  }

  private static _quotaMessage(used: number, quota: number): string {
    const format = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `Cloud storage full (${format(used)} of ${format(quota)}). Free up space or upgrade.`;
  }

  private static _toFailure(uid: string | null, error: unknown): SyncEngine.Failure {
    if (error instanceof SyncApi.HttpError) {
      if (error.status === 0) return { uid, message: "You're offline or the server can't be reached. Sync resumes when it's back.", code: "network" };
      return { uid, message: error.message, code: error.body?.code ?? (error.status >= 500 ? SyncV2.ErrorCode.Internal : "unknown") };
    }
    return { uid, message: error instanceof Error ? error.message : String(error), code: "unknown" };
  }

  private static _reportBackgroundError(error: unknown): void {
    const failure = SyncEngine._toFailure(null, error);
    if (failure.code === "network") {
      SyncEngine._offline = true;
      SyncEngine._emitSummary();
      return;
    }
    console.error("Sync failed.", error);
    SyncEngine.events.emit("error", failure);
  }

  private static _startActive(uid: string, direction: "up" | "down", total: number): void {
    SyncEngine._active.set(uid, { direction, done: 0, total, current: 0 });
    SyncEngine._emitStatus(uid);
  }

  private static _finishActiveFile(uid: string, size: number): void {
    const active = SyncEngine._active.get(uid);
    if (!active) return;
    active.done += size;
    active.current = 0;
    SyncEngine._emitStatus(uid);
  }

  private static _onProgress(progress: Transfer.Progress): void {
    const active = SyncEngine._active.get(progress.uid);
    if (active) active.current = progress.transferred;
    SyncEngine.events.emit("progress", progress);
    SyncEngine._emitStatus(progress.uid);
  }

  private static _emitStatus(uid: string): void {
    SyncEngine.events.emit("status", uid, SyncEngine.getSongStatus(uid));
    SyncEngine._emitSummary();
  }

  /**
   * Coalesced: at most one `summary` event per tick.
   */
  private static _emitSummary(): void {
    if (SyncEngine._summaryTimer) return;
    SyncEngine._summaryTimer = setTimeout(() => {
      SyncEngine._summaryTimer = null;
      SyncEngine.events.emit("summary", SyncEngine.getSummary());
    }, 0);
  }

  private static _displayName(uid: string, info: Partial<ISong>): string {
    const artist = typeof info.artist === "string" ? info.artist.trim() : "";
    const title = typeof info.title === "string" ? info.title.trim() : "";
    if (artist && title) return `${artist} - ${title}`;
    return artist || title || uid;
  }

  private static _newHash(): string {
    return Math.random().toString(16).slice(2, 18) + Math.random().toString(16).slice(2, 18);
  }

  /**
   * Structural equality of JSON values (key order ignored, `undefined` values dropped).
   */
  private static _sameJson(a: unknown, b: unknown): boolean {
    const canonical = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return v;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) sorted[key] = (v as Record<string, unknown>)[key];
      return sorted;
    }) ?? "";
    return canonical(a) === canonical(b);
  }

  //#endregion
}

export namespace SyncEngine {
  export type DirtyReason = "local-change" | "remote-change";

  /**
   * `device` = the local copy only (keeps the cloud copy). `cloud` = the cloud copy only. `everywhere` = both.
   */
  export type DeleteScope = "device" | "cloud" | "everywhere";

  /**
   * Per-song status shown in the song list (plan §2.1).
   */
  export enum Status {
    LocalOnly = "local-only",
    CloudOnly = "cloud-only",
    Synced = "synced",
    Queued = "queued",
    Uploading = "uploading",
    Downloading = "downloading",
    /** Auto-resolved, waiting for review (alert dot). */
    Conflict = "conflict",
    Error = "error",
  }

  export interface SongStatus {
    status: Status;
    /**
     * 0-1 while uploading or downloading.
     */
    progress: number | null;
    /**
     * Shown on hover for `Error`.
     */
    error: string | null;
    conflicts: number;
  }

  /**
   * Engine-wide status for Settings > Sync.
   */
  export interface Summary {
    state: "disabled" | "idle" | "syncing" | "offline" | "error";
    /**
     * Why the engine isn't running (logged out, server without sync v2, session expired), or `null`.
     */
    disabledReason: string | null;
    /**
     * Whether `autoSync` is on for the running engine.
     */
    autoSync: boolean;
    pending: number;
    lastSyncAt: number | null;
    storageUsed: number | null;
    storageQuota: number | null;
    tier: SyncV2.Tier | null;
    /**
     * Uploads are refused (over quota, or a 413): streaming and downloads still work.
     */
    readOnly: boolean;
    /**
     * "Cloud storage full (x of y)…" while uploads are paused, else `null`.
     */
    uploadsBlockedReason: string | null;
    /**
     * Synced songs missing from the library folder that sync won't delete from the cloud until
     * `SyncEngine.confirmMissingDeletes()`. `0` normally.
     */
    deletesBlocked: number;
    conflicts: number;
    errors: number;
  }

  /**
   * A failure worth telling the user about.
   * `server-outdated`: the server has no sync v2. `missing-songs`: see `Summary.deletesBlocked`.
   */
  export interface Failure {
    uid: string | null;
    message: string;
    code: SyncV2.ErrorCode | "network" | "unknown" | "server-outdated" | "missing-songs";
  }

  /**
   * Files that changed under a song because of a pull, so the player can re-apply them (background, subtitles,
   * storyboard now; media only after the song ends).
   */
  export interface Applied {
    uid: string;
    paths: string[];
    infoChanged: boolean;
  }

  /**
   * Delete-vs-modify: one side deleted, the other edited, and the edit was kept (no conflict record).
   * `kept` is the side whose edit survived; `paths` is empty when the whole song was kept.
   */
  export interface Kept {
    uid: string;
    songName: string;
    kept: Merge.Side;
    paths: string[];
  }

  /**
   * Where a song lives now. `local` = its folder and info on this device, `remote` = its live cloud manifest. Both
   * `null` = gone from the library.
   */
  export interface SongChange {
    uid: string;
    local: { dirname: string; info: ISong } | null;
    remote: SyncV2.TrackManifest | null;
  }

  /**
   * What the engine needs from the library (`SongLibrary` sets it).
   */
  export interface Library {
    /**
     * Every song in the library, local and cloud-only.
     */
    getSongs(): Song[];
    getSong(uid: string): Song | null;
    /**
     * Whether the last library load read every song folder. Missing songs are only deleted from the cloud when it did.
     */
    isComplete(): boolean;
  }

  /**
   * Thrown by `removeDownload` when the local copy has changes the cloud doesn't have yet.
   */
  export class UnsyncedChangesError extends Error {
    constructor(songName: string) {
      super(`"${songName}" has changes on this device that aren't in the cloud yet. Sync it first, or remove the download anyway to lose them.`);
      this.name = "UnsyncedChangesError";
    }
  }
}

export default SyncEngine;
