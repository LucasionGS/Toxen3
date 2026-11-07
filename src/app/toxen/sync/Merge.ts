import type { SyncV2 } from "./SyncApi";

/**
 * Three-way merge of one song (plan §2.4): base B (last synced), local L, remote R.
 * Pure functions, no I/O and no app imports, so the full B/L/R table can be exercised from a scratch `src/test.ts`.
 *
 * Files, per path:
 * | B -> L    | B -> R    | Result |
 * |-----------|-----------|--------|
 * | same      | same      | nothing |
 * | changed   | same      | push L |
 * | same      | changed   | pull R |
 * | changed   | changed, L = R | base only |
 * | changed   | changed, L != R | conflict: newest wins (local mtime vs remote receivedAt), loser kept as `conflictCopyPath` on both sides |
 * | deleted   | same      | push delete |
 * | same      | deleted   | delete local |
 * | deleted   | changed (or the reverse) | the modification wins |
 * | new       | new, different | conflict (same rule) |
 *
 * Info: per field against the base. One side changed -> that side. Both changed -> newer `infoUpdatedAt`, recorded as a
 * field conflict. `DEEP_MERGE_FIELDS` are merged one key deeper. `IGNORED_INFO_FIELDS` are never merged.
 */
export namespace Merge {
  export type Side = "local" | "remote";

  /**
   * Info fields merged per sub-key (e.g. one playlist's overrides at a time).
   */
  export const DEEP_MERGE_FIELDS = ["playlistSettings", "visualizerStyleOptions"] as const;

  /**
   * Info fields that are never merged or pushed (v1 bookkeeping).
   */
  export const IGNORED_INFO_FIELDS = ["files", "hash"] as const;

  /**
   * One side's version of a file. `mtimeMs` is the local mtime, or the remote `receivedAt`.
   */
  export interface FileVersion {
    sha256: string;
    size: number;
    mtimeMs: number;
  }

  /**
   * Path -> version. A missing path means "doesn't exist on that side".
   */
  export type FileVersions = Record<string, FileVersion>;

  /**
   * Path -> sha256 at the last sync. `null` for a song that was never synced (first v2 sync, plan §2.7).
   */
  export type BaseFiles = Record<string, string> | null;

  export type FileAction =
    | { type: "push"; path: string; version: FileVersion }
    | { type: "pull"; path: string; version: FileVersion }
    | { type: "push-delete"; path: string }
    | { type: "delete-local"; path: string }
    /** Both sides already equal; only the base moves. */
    | { type: "base-only"; path: string; sha256: string }
    /** The winner stays at `path` on both sides; the loser is written to `copyPath` on both sides. */
    | { type: "conflict"; path: string; copyPath: string; winner: Side; local: FileVersion; remote: FileVersion };

  export interface FilesMergeResult {
    actions: FileAction[];
    /**
     * Bytes that would be uploaded (pushes and conflict copies), for the quota pre-check.
     */
    uploadBytes: number;
  }

  export interface InfoFieldConflict {
    /**
     * Dotted for deep fields, e.g. `playlistSettings.<playlistId>`.
     */
    field: string;
    local: unknown;
    remote: unknown;
    winner: Side;
  }

  export interface InfoMergeResult {
    merged: SyncV2.SongInfo;
    /**
     * `infoUpdatedAt` to send with the merged info.
     */
    infoUpdatedAt: number;
    /**
     * The merged info differs from the remote (commit it).
     */
    push: boolean;
    /**
     * The merged info differs from the local (write `info.json`).
     */
    pull: boolean;
    conflicts: InfoFieldConflict[];
  }

  /**
   * The full plan for one song.
   */
  export interface SyncPlan {
    uid: string;
    /**
     * Whole-song outcome. `delete-*` and `tombstone` skip `files`/`info`.
     */
    song: "sync" | "push-new" | "pull-new" | "tombstone" | "delete-local" | "noop";
    files: FilesMergeResult;
    info: InfoMergeResult | null;
    /**
     * Base rev for the commit (the remote rev the plan was made against), `null` if the server has no track.
     */
    baseRev: number | null;
    /**
     * Set when anything conflicted, ready to store in `SyncState.conflicts`.
     */
    conflict: ConflictRecord | null;
  }

  /**
   * Everything `planSong` needs. `local`/`remote` `null` = the song doesn't exist on that side (or is a tombstone).
   */
  export interface PlanInput {
    uid: string;
    base: { rev: number | null; info: SyncV2.SongInfo | null; infoUpdatedAt: number; files: BaseFiles } | null;
    local: { info: SyncV2.SongInfo; infoUpdatedAt: number; files: FileVersions } | null;
    remote: SyncV2.TrackManifest | null;
    /**
     * Used for conflict copy names and record ids. Passed in to keep the functions pure.
     */
    now: number;
  }

  //#region Conflict records (stored in sync.json, shown by SyncConflictModal)

  /**
   * How the diff view shows a file, from its extension.
   */
  export type FileKind = "text" | "image" | "media" | "other";

  export interface FileConflict {
    type: "file";
    kind: FileKind;
    path: string;
    copyPath: string;
    winner: Side;
    local: FileVersion;
    remote: FileVersion;
  }

  export interface InfoConflict {
    type: "info";
    fields: InfoFieldConflict[];
  }

  export type ConflictItem = FileConflict | InfoConflict;

  /**
   * An auto-resolved conflict waiting for review. Cleared when reviewed, or after `CONFLICT_TTL_MS` (copies are kept).
   */
  export interface ConflictRecord {
    id: string;
    uid: string;
    /**
     * Display name at the time of the conflict ("Artist - Title").
     */
    songName: string;
    createdAt: number;
    items: ConflictItem[];
  }

  /**
   * What the user picked for one item in the diff view. Applying it is one more ordinary commit.
   */
  export type ConflictChoice =
    | { type: "info"; field: string; keep: Side }
    | { type: "file"; path: string; keep: Side | "both" };

  /**
   * Unreviewed conflicts are dropped after 30 days. Unit is in ms.
   */
  export const CONFLICT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  //#endregion

  /**
   * Merge file sets per the table above.
   */
  export function mergeFiles(base: BaseFiles, local: FileVersions, remote: FileVersions, now: number): FilesMergeResult {
    throw new Error("Not implemented.");
  }

  /**
   * Merge info per field. `base` `null` = first sync: every differing field is a conflict decided by `infoUpdatedAt`.
   */
  export function mergeInfo(base: SyncV2.SongInfo | null, local: SyncV2.SongInfo, localUpdatedAt: number, remote: SyncV2.SongInfo, remoteUpdatedAt: number): InfoMergeResult {
    throw new Error("Not implemented.");
  }

  /**
   * Plan a whole song, including the song-level cases: only one side exists, one side deleted (the modification wins:
   * a remote tombstone against unchanged local files -> `delete-local`, against local changes -> `push-new`).
   */
  export function planSong(input: PlanInput): SyncPlan {
    throw new Error("Not implemented.");
  }

  /**
   * Name of the kept loser: `name.conflict-YYYYMMDD-HHmm.ext` (local time of `now`), with `-2`, `-3`… if taken.
   * Example: `subtitles.srt` -> `subtitles.conflict-20261107-1432.srt`
   */
  export function conflictCopyPath(path: string, now: number, taken: ReadonlySet<string>): string {
    throw new Error("Not implemented.");
  }

  /**
   * Classify a path for the diff view by extension.
   */
  export function fileKind(path: string): FileKind {
    throw new Error("Not implemented.");
  }
}

export default Merge;
