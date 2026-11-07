import { EventEmitter } from "events";
import type Song from "../Song";
import type { SyncV2 } from "./SyncApi";
import type { Merge } from "./Merge";
import type { Transfer } from "./Transfer";

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
}

/**
 * Background sync between the local library and the cloud (plan §2.6). Static manager, started once from bootstrap.
 *
 * Triggers: startup (scan changed folders, then `changes?since`), `LocalSongStorage` `change` (debounced
 * `DEBOUNCE_MS` per song), a `track:changed` socket event (`handleRemoteEvent`, wired by bootstrap), every
 * `POLL_INTERVAL_MS`, and the window `online` event.
 *
 * Per song: Manifest.scanLocal -> Merge.planSong -> quota pre-check -> Transfer uploads (`CONCURRENCY` songs at a time)
 * -> commit -> on 409 re-pull and re-plan, up to `MAX_COMMIT_RETRIES` -> downloads -> write info -> update SyncState.
 * Failures back off exponentially and stay in `SyncState.pending`. Quota errors stop uploads only; downloads continue.
 *
 * Boundaries: imports storage/, sync/ and `toxenapi` only. Never React components or `Toxen` UI helpers: everything
 * user-facing goes out as events, and bootstrap turns them into notifications and panel updates.
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
   * Start syncing for the logged-in user: load `SyncState`, configure `SyncApi`, run the startup pass, start timers.
   * No-op when logged out or auto-sync is off. Web: only remote pulls (no local copies).
   */
  public static async init(): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Stop timers and in-flight transfers, flush `SyncState` (logout, quit).
   */
  public static async stop(): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Whether the engine is running.
   */
  public static isRunning(): boolean {
    throw new Error("Not implemented.");
  }

  /**
   * Pull changes and process every pending job now (Settings > Sync "Sync now").
   */
  public static async syncNow(): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Queue a song (debounced).
   */
  public static markDirty(uid: string, reason?: SyncEngine.DirtyReason): void {
    throw new Error("Not implemented.");
  }

  /**
   * A `track:changed` event from the socket. Ignored when `origin` is this device.
   */
  public static handleRemoteEvent(event: SyncV2.TrackChangedEvent): void {
    throw new Error("Not implemented.");
  }

  //#region Song actions (context menu)

  /**
   * Download a cloud-only song and pin it.
   */
  public static async makeAvailableOffline(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Delete the local copy, keep the cloud copy, unpin.
   * @throws If the song has unsynced local changes (the caller asks the user first).
   */
  public static async removeDownload(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * Upload a local-only song.
   */
  public static async uploadToCloud(song: Song): Promise<void> {
    throw new Error("Not implemented.");
  }

  //#endregion

  //#region State for the UI

  public static getSongStatus(uid: string): SyncEngine.SongStatus {
    throw new Error("Not implemented.");
  }

  public static getSummary(): SyncEngine.Summary {
    throw new Error("Not implemented.");
  }

  public static getConflicts(uid?: string): Merge.ConflictRecord[] {
    throw new Error("Not implemented.");
  }

  /**
   * Apply the user's choices from the diff view as one ordinary commit, then drop the record and the copies that
   * are no longer wanted.
   */
  public static async resolveConflict(conflictId: string, choices: Merge.ConflictChoice[]): Promise<void> {
    throw new Error("Not implemented.");
  }

  /**
   * This machine's auto-download preference (stored in `SyncState.machine`, never synced).
   */
  public static getAutoDownload(): boolean {
    throw new Error("Not implemented.");
  }

  public static setAutoDownload(enabled: boolean): void {
    throw new Error("Not implemented.");
  }

  //#endregion
}

export namespace SyncEngine {
  export type DirtyReason = "local-change" | "remote-change";

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
    pending: number;
    lastSyncAt: number | null;
    storageUsed: number | null;
    storageQuota: number | null;
    readOnly: boolean;
    conflicts: number;
    errors: number;
  }

  /**
   * A failure worth telling the user about.
   */
  export interface Failure {
    uid: string | null;
    message: string;
    code: SyncV2.ErrorCode | "network" | "unknown";
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
}

export default SyncEngine;
