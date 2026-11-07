import type { SyncV2 } from "./SyncApi";
import type { Merge } from "./Merge";

/**
 * The device's sync bookkeeping: `<libraryDirectory>/.toxen/sync.json`, outside every song folder so it never syncs
 * itself (`.toxen/` is a reserved prefix). Desktop writes it atomically (`toxenapi.atomicWriteFile`), debounced.
 * Web keeps it in memory only (it has no local copies, so nothing to remember between sessions).
 *
 * Also holds this machine's sync preferences (`machine`), which are deliberately never synced: a laptop can stay
 * cloud-only while a desktop downloads everything.
 */
export class SyncState {
  /**
   * Folder below the library directory.
   */
  public static readonly DIR_NAME = ".toxen";

  public static readonly FILE_NAME = "sync.json";

  /**
   * Coalesce saves within this window. Unit is in ms.
   */
  public static readonly SAVE_DEBOUNCE_MS = 1000;

  private constructor() { }

  /**
   * The loaded state. Mutate through the helpers below so saves get scheduled.
   */
  public static data: SyncState.Data;

  /**
   * Load from disk (desktop) or start empty (web). A missing or unreadable file starts fresh with a new `deviceId`
   * (an unreadable one is renamed to `sync.json.broken-<ms>` first).
   * A file for another `userId` or `server` is reset (bases from another account are meaningless), keeping `machine`.
   */
  public static async load(userId: number | null, server: string): Promise<SyncState.Data> {
    throw new Error("Not implemented.");
  }

  /**
   * Schedule a debounced atomic save.
   */
  public static save(): void {
    throw new Error("Not implemented.");
  }

  /**
   * Write now (app quit, before a long transfer).
   */
  public static async flush(): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * The song's state, created empty if missing.
   */
  public static getSong(uid: string): SyncState.SongState {
    throw new Error("Not implemented.");
  }

  /**
   * Forget a song entirely (deleted everywhere).
   */
  public static removeSong(uid: string): void {
    throw new Error("Not implemented.");
  }

  /**
   * Add or update a pending job (one per uid; a newer reason replaces an older one).
   */
  public static enqueue(uid: string, reason: SyncState.PendingReason): void {
    throw new Error("Not implemented.");
  }

  public static dequeue(uid: string): void {
    throw new Error("Not implemented.");
  }

  public static addConflict(record: Merge.ConflictRecord): void {
    throw new Error("Not implemented.");
  }

  public static removeConflict(id: string): void {
    throw new Error("Not implemented.");
  }

  /**
   * Drop conflicts older than `Merge.CONFLICT_TTL_MS`.
   */
  public static pruneConflicts(now: number): void {
    throw new Error("Not implemented.");
  }
}

export namespace SyncState {
  /**
   * Bumped on incompatible shape changes; `load` migrates or resets older files.
   */
  export const VERSION = 1;

  /**
   * Shape of `.toxen/sync.json`.
   */
  export interface Data {
    version: typeof VERSION;
    /**
     * Random id of this device, sent as `SyncV2.HEADER_DEVICE`.
     */
    deviceId: string;
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
    machine: MachineSettings;
    songs: Record<string, SongState>;
    pending: PendingJob[];
    conflicts: Merge.ConflictRecord[];
  }

  /**
   * Per-machine preferences. Never synced, never part of `settings.json` sync (plan §8.2).
   */
  export interface MachineSettings {
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
     * Info at the last sync (without `files`/`hash`).
     */
    baseInfo: SyncV2.SongInfo | null;
    baseInfoUpdatedAt: number;
    /**
     * Path -> sha256 at the last sync.
     */
    baseFiles: Record<string, string> | null;
    /**
     * Path -> hash of the local file, reused while size and mtime are unchanged, so large media is only re-hashed
     * after it actually changed.
     */
    hashCache: Record<string, HashCacheEntry>;
    /**
     * Latest server manifest seen. For cloud-only songs this is how the library knows them.
     */
    remote: SyncV2.TrackManifest | null;
    /**
     * Kept downloaded regardless of `autoDownload` ("Make available offline").
     */
    pinned: boolean;
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
