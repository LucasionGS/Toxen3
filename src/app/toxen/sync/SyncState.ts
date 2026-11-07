import type { SyncV2 } from "./SyncApi";
import { Merge } from "./Merge";
import Settings from "../Settings";

/**
 * The device's sync bookkeeping: `<libraryDirectory>/.toxen/sync.json`, outside every song folder so it never syncs
 * itself (`.toxen/` is a reserved prefix). It belongs to the library, not the machine: a library shared between two
 * machines shares its bases, because both see the same local copies. Desktop writes it atomically
 * (`toxenapi.atomicWriteFile`), debounced. Web keeps it in memory only (it has no local copies, so nothing to remember
 * between sessions).
 *
 * This machine's own preferences (`machine`: device id, auto-download) live apart from it, in Toxen's app data folder
 * (`machine.json`, web: `localStorage`), because they must not travel with a shared library and are never synced.
 */
export class SyncState {
  /**
   * Folder below the library directory.
   */
  public static readonly DIR_NAME = ".toxen";

  public static readonly FILE_NAME = "sync.json";

  /**
   * File in Toxen's app data folder (desktop) holding `MachineSettings`.
   */
  public static readonly MACHINE_FILE_NAME = "machine.json";

  /**
   * `localStorage` key holding `MachineSettings` on web.
   */
  public static readonly MACHINE_STORAGE_KEY = "toxen.machine";

  /**
   * Coalesce saves within this window. Unit is in ms.
   */
  public static readonly SAVE_DEBOUNCE_MS = 1000;

  private constructor() { }

  /**
   * The loaded state. Mutate through the helpers below, or call `save()` after changing it, so saves get scheduled.
   */
  public static data: SyncState.Data = SyncState.empty(null, "");

  /**
   * This machine's preferences. Loaded by `loadMachine`.
   */
  public static machine: SyncState.MachineSettings = { deviceId: "", autoDownload: false };

  /**
   * Absolute path of `sync.json`, or `null` when the state is kept in memory only (web, or no library directory).
   */
  private static _filePath: string | null = null;
  private static _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private static _writing: Promise<void> = Promise.resolve();
  private static _loaded = false;

  /**
   * Whether `load` has run for the current library.
   */
  public static isLoaded(): boolean {
    return SyncState._loaded;
  }

  /**
   * A fresh state for an account.
   */
  public static empty(userId: number | null, server: string): SyncState.Data {
    return {
      version: SyncState.VERSION,
      userId,
      server,
      lastPulledRev: 0,
      lastSyncAt: null,
      songs: {},
      pending: [],
      conflicts: [],
    };
  }

  /**
   * Load this machine's preferences, creating a new `deviceId` on first use.
   */
  public static async loadMachine(): Promise<SyncState.MachineSettings> {
    let stored: Partial<SyncState.MachineSettings> | null = null;
    try {
      if (toxenapi.isDesktop()) {
        const text = await toxenapi.fs.promises.readFile(toxenapi.CrossPlatform.getToxenDataPath(SyncState.MACHINE_FILE_NAME), "utf8").catch((): null => null);
        stored = text ? JSON.parse(text) : null;
      }
      else {
        const text = window.localStorage.getItem(SyncState.MACHINE_STORAGE_KEY);
        stored = text ? JSON.parse(text) : null;
      }
    } catch (error) {
      console.error("Unable to read this machine's sync settings. Starting with new ones.", error);
    }

    const isNew = !stored || typeof stored.deviceId !== "string" || stored.deviceId.length === 0;
    SyncState.machine = {
      deviceId: isNew ? SyncState._newDeviceId() : stored.deviceId,
      autoDownload: stored?.autoDownload === true,
    };
    if (isNew) await SyncState.saveMachine();
    return SyncState.machine;
  }

  /**
   * Write `machine` now.
   */
  public static async saveMachine(): Promise<void> {
    const text = JSON.stringify(SyncState.machine, null, 2);
    if (toxenapi.isDesktop()) {
      const filePath = toxenapi.CrossPlatform.getToxenDataPath(SyncState.MACHINE_FILE_NAME);
      await toxenapi.fs.promises.mkdir(toxenapi.path.dirname(filePath), { recursive: true });
      await toxenapi.atomicWriteFile(filePath, text);
    }
    else {
      window.localStorage.setItem(SyncState.MACHINE_STORAGE_KEY, text);
    }
  }

  /**
   * Load from disk (desktop) or start empty (web). A missing or unreadable file starts fresh (an unreadable one is
   * renamed to `sync.json.broken-<ms>` first). A file for another `userId` or `server` is reset, because bases from
   * another account are meaningless.
   */
  public static async load(userId: number | null, server: string): Promise<SyncState.Data> {
    await SyncState.flush();
    SyncState._filePath = SyncState._resolveFilePath();
    SyncState._loaded = true;

    if (!SyncState._filePath || !toxenapi.isDesktop()) {
      // Web keeps the state for the session; switching accounts starts over
      if (SyncState.data.userId !== userId || SyncState.data.server !== server) SyncState.data = SyncState.empty(userId, server);
      return SyncState.data;
    }

    const filePath = SyncState._filePath;
    const text = await toxenapi.fs.promises.readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException): null => {
      if (error?.code !== "ENOENT") console.error(`Unable to read ${filePath}.`, error);
      return null;
    });

    let data: SyncState.Data | null = null;
    if (text !== null) {
      try {
        const parsed = JSON.parse(text) as SyncState.Data;
        if (!parsed || typeof parsed !== "object" || typeof parsed.songs !== "object" || !Array.isArray(parsed.pending)) {
          throw new Error("The file doesn't have the sync state shape.");
        }
        data = parsed;
      } catch (error) {
        const broken = `${filePath}.broken-${Date.now()}`;
        console.error(`The sync state is unreadable. Moved it to ${broken} and starting fresh.`, error);
        await toxenapi.fs.promises.rename(filePath, broken).catch(() => { });
      }
    }

    if (data && (data.userId !== userId || data.server !== server || data.version !== SyncState.VERSION)) {
      console.warn("The sync state belongs to another account, server or version. Starting fresh.");
      data = null;
    }
    SyncState.data = data ? SyncState._normalize(data) : SyncState.empty(userId, server);
    if (!data) SyncState.save();
    return SyncState.data;
  }

  /**
   * Forget the loaded state without writing (logout).
   */
  public static async unload(): Promise<void> {
    await SyncState.flush();
    SyncState.data = SyncState.empty(null, "");
    SyncState._filePath = null;
    SyncState._loaded = false;
  }

  /**
   * Schedule a debounced atomic save.
   */
  public static save(): void {
    if (!SyncState._filePath) return;
    if (SyncState._saveTimer) return;
    SyncState._saveTimer = setTimeout(() => {
      SyncState._saveTimer = null;
      SyncState._write().catch(error => console.error("Unable to save the sync state.", error));
    }, SyncState.SAVE_DEBOUNCE_MS);
  }

  /**
   * Write now (app quit, before a long transfer, before deleting a local copy).
   */
  public static async flush(): Promise<void> {
    if (SyncState._saveTimer) {
      clearTimeout(SyncState._saveTimer);
      SyncState._saveTimer = null;
      await SyncState._write();
    }
    else {
      await SyncState._writing;
    }
  }

  /**
   * The song's state, or `null` when it has none.
   */
  public static peekSong(uid: string): SyncState.SongState | null {
    return Object.prototype.hasOwnProperty.call(SyncState.data.songs, uid) ? SyncState.data.songs[uid] : null;
  }

  /**
   * The song's state, created empty if missing.
   */
  public static getSong(uid: string): SyncState.SongState {
    let song = SyncState.peekSong(uid);
    if (!song) {
      song = SyncState.data.songs[uid] = SyncState._emptySong();
      SyncState.save();
    }
    return song;
  }

  /**
   * Clear the song's base: the next merge treats the song as never synced. Must happen before a local copy that
   * should stay in the cloud is deleted (see `SyncEngine.removeDownload`).
   */
  public static clearBase(uid: string): void {
    const song = SyncState.getSong(uid);
    song.baseRev = null;
    song.baseInfo = null;
    song.baseInfoUpdatedAt = 0;
    song.baseFiles = null;
    song.hashCache = {};
    SyncState.save();
  }

  /**
   * Forget a song entirely (deleted everywhere).
   */
  public static removeSong(uid: string): void {
    delete SyncState.data.songs[uid];
    SyncState.dequeue(uid);
    SyncState.data.conflicts = SyncState.data.conflicts.filter(conflict => conflict.uid !== uid);
    SyncState.save();
  }

  /**
   * Add or update a pending job (one per uid). A newer reason replaces an older one, except that an explicit action
   * (`download`, `upload`, `remove-download`, `delete-cloud`) is never replaced by a plain change.
   * @param notBefore Earliest start (Unix ms). Default is now.
   */
  public static enqueue(uid: string, reason: SyncState.PendingReason, notBefore?: number): SyncState.PendingJob {
    const now = Date.now();
    let job = SyncState.data.pending.find(pending => pending.uid === uid);
    if (job) {
      const isChange = (r: SyncState.PendingReason) => r === "local-change" || r === "remote-change";
      if (!isChange(reason) || isChange(job.reason)) job.reason = reason;
      job.notBefore = Math.min(job.notBefore, notBefore ?? now);
    }
    else {
      job = { uid, reason, attempts: 0, enqueuedAt: now, notBefore: notBefore ?? now };
      SyncState.data.pending.push(job);
    }
    SyncState.save();
    return job;
  }

  public static dequeue(uid: string): void {
    const before = SyncState.data.pending.length;
    SyncState.data.pending = SyncState.data.pending.filter(job => job.uid !== uid);
    if (SyncState.data.pending.length !== before) SyncState.save();
  }

  public static addConflict(record: Merge.ConflictRecord): void {
    SyncState.data.conflicts = SyncState.data.conflicts.filter(conflict => conflict.id !== record.id);
    SyncState.data.conflicts.push(record);
    SyncState.save();
  }

  public static removeConflict(id: string): void {
    SyncState.data.conflicts = SyncState.data.conflicts.filter(conflict => conflict.id !== id);
    SyncState.save();
  }

  /**
   * Drop conflicts older than `Merge.CONFLICT_TTL_MS`. Their conflict copies stay where they are.
   * @returns The dropped records.
   */
  public static pruneConflicts(now: number): Merge.ConflictRecord[] {
    const expired = SyncState.data.conflicts.filter(conflict => now - conflict.createdAt > Merge.CONFLICT_TTL_MS);
    if (expired.length === 0) return [];
    SyncState.data.conflicts = SyncState.data.conflicts.filter(conflict => !expired.includes(conflict));
    SyncState.save();
    return expired;
  }

  private static _resolveFilePath(): string | null {
    if (!toxenapi.isDesktop()) return null;
    const library = Settings.get("libraryDirectory");
    if (!library) return null;
    return toxenapi.path.resolve(library, SyncState.DIR_NAME, SyncState.FILE_NAME);
  }

  private static async _write(): Promise<void> {
    const filePath = SyncState._filePath;
    if (!filePath || !toxenapi.isDesktop()) return;
    const text = JSON.stringify(SyncState.data);
    const previous = SyncState._writing;
    const write = previous.catch(() => { }).then(async () => {
      if (!toxenapi.isDesktop()) return;
      await toxenapi.fs.promises.mkdir(toxenapi.path.dirname(filePath), { recursive: true });
      await toxenapi.atomicWriteFile(filePath, text);
    });
    SyncState._writing = write.catch(() => { });
    return write;
  }

  /**
   * Fill fields a file from an older build may lack.
   */
  private static _normalize(data: SyncState.Data): SyncState.Data {
    data.lastPulledRev = Number.isFinite(data.lastPulledRev) ? data.lastPulledRev : 0;
    data.lastSyncAt ??= null;
    data.conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
    for (const uid of Object.keys(data.songs)) {
      data.songs[uid] = { ...SyncState._emptySong(), ...data.songs[uid] };
    }
    return data;
  }

  private static _emptySong(): SyncState.SongState {
    return {
      baseRev: null,
      baseInfo: null,
      baseInfoUpdatedAt: 0,
      baseFiles: null,
      hashCache: {},
      remote: null,
      pinned: false,
      keepInCloud: false,
      upload: false,
      localInfoUpdatedAt: 0,
      lastError: null,
    };
  }

  private static _newDeviceId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join("-");
  }
}

export namespace SyncState {
  /**
   * Bumped on incompatible shape changes; `load` resets older files.
   */
  export const VERSION = 1;

  /**
   * Shape of `.toxen/sync.json`.
   */
  export interface Data {
    version: typeof VERSION;
    /**
     * The account and server the bases belong to.
     */
    userId: number | null;
    server: string;
    /**
     * `nextSince` of the last fully applied `changes` page.
     */
    lastPulledRev: number;
    lastSyncAt: number | null;
    songs: Record<string, SongState>;
    pending: PendingJob[];
    conflicts: Merge.ConflictRecord[];
  }

  /**
   * Per-machine preferences, in Toxen's app data folder (`machine.json`). Never synced, never part of the library.
   */
  export interface MachineSettings {
    /**
     * Random id of this device, sent as `SyncV2.HEADER_DEVICE` so the device can ignore its own socket echoes.
     */
    deviceId: string;
    /**
     * Download new cloud songs automatically on this device. Off by default. Pinned songs stay downloaded either way.
     */
    autoDownload: boolean;
  }

  /**
   * One song's sync state on this device.
   */
  export interface SongState {
    /**
     * Server rev at the last sync, `null` if never synced.
     */
    baseRev: number | null;
    /**
     * Info at the last sync (without `files`, `hash` and `paths.dirname`).
     */
    baseInfo: SyncV2.SongInfo | null;
    baseInfoUpdatedAt: number;
    /**
     * Path -> sha256 at the last sync. `null` = no base: the song was never synced, or its local copy was removed on
     * purpose ("Remove download") and must not read as a deletion.
     */
    baseFiles: Record<string, string> | null;
    /**
     * Path -> hash of the local file, reused while size and mtime are unchanged, so large media is only re-hashed
     * after it actually changed.
     */
    hashCache: Record<string, HashCacheEntry>;
    /**
     * Latest server manifest seen (tombstones included). For cloud-only songs this is how the library knows them.
     */
    remote: SyncV2.TrackManifest | null;
    /**
     * Kept downloaded regardless of `autoDownload` ("Make available offline").
     */
    pinned: boolean;
    /**
     * The user removed the download: `autoDownload` must not fetch it again.
     */
    keepInCloud: boolean;
    /**
     * Upload this local-only song (set by "Upload to cloud" and by imports). Local songs without a base and without
     * this flag stay local only.
     */
    upload: boolean;
    /**
     * Last local info edit (client time), sent as `infoUpdatedAt`.
     */
    localInfoUpdatedAt: number;
    lastError: SongError | null;
  }

  export interface HashCacheEntry {
    size: number;
    mtimeMs: number;
    sha256: string;
  }

  export interface SongError {
    message: string;
    code: SyncV2.ErrorCode | "network" | "unknown";
    at: number;
    attempts: number;
  }

  export type PendingReason = "local-change" | "remote-change" | "download" | "upload" | "remove-download" | "delete-cloud";

  /**
   * A queued job, persisted so it survives restarts and offline periods.
   */
  export interface PendingJob {
    uid: string;
    reason: PendingReason;
    attempts: number;
    enqueuedAt: number;
    /**
     * Exponential backoff: not before this time (Unix ms).
     */
    notBefore: number;
  }
}

export default SyncState;
