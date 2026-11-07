import type { SyncV2 } from "./SyncApi";

/**
 * Three-way merge of one song (plan §2.4): base B (last synced), local L, remote R.
 * Pure functions, no I/O and no app imports, so the full B/L/R table is exercised by the scratch script
 * `Merge.test.ts` next to this file. Anything time-dependent takes `now` as a parameter.
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
 * A song that was never synced (no base, plan §2.7) is merged against an empty base: equal files become the base,
 * files on one side only are copied to the other, different files go through the conflict rule. Nothing is lost.
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
   * Info fields that are never merged or pushed (v1 sync bookkeeping, plan §2.7).
   */
  export const IGNORED_INFO_FIELDS = ["files", "hash"] as const;

  /**
   * Text between a file's name and the timestamp of its conflict copy.
   */
  export const CONFLICT_MARKER = ".conflict-";

  /**
   * Longest relative path the server accepts. Same as `SyncV2.PATH_MAX_LENGTH`, which a type-only import can't read.
   */
  export const PATH_MAX_LENGTH = 512;

  /**
   * Extensions (lowercase, with the dot) shown as a line diff in the conflict view.
   */
  export const TEXT_EXTENSIONS = [".srt", ".vtt", ".lrc", ".tst", ".ass", ".ssa", ".tsb", ".yaml", ".yml", ".json", ".txt", ".md"] as const;

  /**
   * Extensions (lowercase, with the dot) shown as thumbnails in the conflict view.
   */
  export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"] as const;

  /**
   * Extensions (lowercase, with the dot) shown with a preview player in the conflict view. Mirrors `MediaFormats`.
   */
  export const MEDIA_EXTENSIONS = [
    // Audio
    ".mp3", ".flac", ".ogg", ".wav", ".aac", ".m4a", ".opus", ".wma", ".aiff", ".aif", ".ape", ".mka", ".wv", ".tta",
    ".ac3", ".dts", ".mpc", ".amr", ".gsm", ".ra", ".au", ".snd",
    // Video
    ".mp4", ".webm", ".mov", ".mkv", ".avi", ".wmv", ".flv", ".ts", ".m2ts", ".mts", ".vob",
  ] as const;

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

  /**
   * The decision for one path. Paths that need nothing at all get no action.
   */
  export type FileAction =
    | { type: "push"; path: string; version: FileVersion }
    | { type: "pull"; path: string; version: FileVersion }
    | { type: "push-delete"; path: string }
    | { type: "delete-local"; path: string }
    /** Both sides already agree; only the base moves. `sha256` `null` = deleted on both sides (drop it from the base). */
    | { type: "base-only"; path: string; sha256: string | null }
    /**
     * The winner stays at `path` on both sides; the loser is kept at `copyPath` on both sides.
     * `reusedCopy`: the loser's content already sits at `copyPath` from an earlier, interrupted sync (that path's own
     * action finishes spreading it), so no new copy is made.
     */
    | { type: "conflict"; path: string; copyPath: string; winner: Side; local: FileVersion; remote: FileVersion; reusedCopy: boolean };

  /**
   * A blob to upload before the commit. Read it from `localPath` before any local change of the same plan.
   */
  export interface Upload {
    sha256: string;
    size: number;
    localPath: string;
  }

  /**
   * A file to fetch after the commit. In the committed manifest (or the unchanged remote when nothing is committed)
   * `path` holds exactly `sha256`, so the download is `GET /tracks/:uid/files/<path>` into local `path`.
   */
  export interface Download {
    path: string;
    sha256: string;
    size: number;
  }

  /**
   * A local rename (conflict loser on this device), done after the commit and before the downloads.
   */
  export interface LocalMove {
    from: string;
    to: string;
  }

  /**
   * A conflict loser kept as a copy. `from` is the side whose version lost.
   */
  export interface ConflictCopy {
    path: string;
    copyPath: string;
    from: Side;
    sha256: string;
    size: number;
  }

  export interface FilesMergeResult {
    /**
     * One entry per path that needs something, sorted by path.
     */
    actions: FileAction[];
    /**
     * Blobs to upload, deduplicated by hash. Content already in the remote manifest is skipped (the server has it).
     */
    uploads: Upload[];
    /**
     * Files to set in the commit (pushes, local conflict winners, conflict copies).
     */
    commitFiles: SyncV2.FileMap;
    /**
     * Paths to delete in the commit.
     */
    remoteDeletes: string[];
    localMoves: LocalMove[];
    localDeletes: string[];
    downloads: Download[];
    /**
     * New conflict copies this plan creates (one per non-reused file conflict).
     */
    conflictCopies: ConflictCopy[];
    /**
     * Path -> sha256 on both sides once the plan is applied: the next base.
     */
    newBase: Record<string, string>;
    /**
     * Bytes that will be uploaded, for the quota pre-check.
     */
    uploadBytes: number;
  }

  export interface InfoFieldConflict {
    /**
     * Dotted for deep fields, e.g. `playlistSettings.<playlistId>`.
     */
    field: string;
    /**
     * This device's value. An absent key means the field doesn't exist locally, which is not the same as `null`.
     */
    local?: unknown;
    /**
     * The cloud's value. An absent key means the field doesn't exist remotely, which is not the same as `null`.
     */
    remote?: unknown;
    winner: Side;
  }

  export interface InfoMergeResult {
    /**
     * The merged info, without `IGNORED_INFO_FIELDS`.
     */
    merged: SyncV2.SongInfo;
    /**
     * `max(localUpdatedAt, remoteUpdatedAt)`. Send it with the commit when `push`, and store it as this device's
     * `localInfoUpdatedAt`.
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
   * Whole-song outcome:
   * - `sync`: both sides exist; apply the file and info lists.
   * - `push-new`: create (or recreate over a tombstone) the cloud track from the local song.
   * - `pull-new`: download a cloud song that has no local copy.
   * - `tombstone`: deleted on this device and unchanged in the cloud since the base: `DELETE /tracks/:uid?baseRev=`.
   * - `delete-local`: deleted in the cloud and unchanged here since the base: remove the local folder.
   * - `noop`: nothing to transfer and the base is already current.
   */
  export type SongOutcome = "sync" | "push-new" | "pull-new" | "tombstone" | "delete-local" | "noop";

  /**
   * The base to store after the plan is fully applied. Its rev is the commit's new `rev`, or `SyncPlan.baseRev`
   * when nothing was committed.
   */
  export interface NewBase {
    info: SyncV2.SongInfo;
    infoUpdatedAt: number;
    files: Record<string, string>;
  }

  /**
   * The full plan for one song. Apply in this order, so an interruption at any step never loses data and the next
   * plan picks up where this one stopped:
   * 1. `files.uploads` (read from disk before anything local changes).
   * 2. The commit from `toCommitRequest(plan)` if it isn't `null` (or the track delete for `tombstone`).
   *    A 409 means re-pull and re-plan: nothing local has changed yet.
   * 3. `files.localMoves`, then `files.localDeletes` (or the whole folder for `delete-local`).
   * 4. `files.downloads` (temp file + rename).
   * 5. Write `infoToWrite` to `info.json` when set.
   * 6. Store `base` in `SyncState` (`null` = forget the song) and any `conflict` record.
   *
   * `push-new` and `pull-new` describe what syncing would do. Whether the engine acts on them (local-only and
   * cloud-only songs are allowed, plan §2.1) is its decision.
   */
  export interface SyncPlan {
    uid: string;
    song: SongOutcome;
    /**
     * Base rev for the commit or delete (the remote rev the plan was made against), `null` if the server has no
     * live track.
     */
    baseRev: number | null;
    files: FilesMergeResult;
    /**
     * The field-level result, set for `sync` only.
     */
    info: InfoMergeResult | null;
    /**
     * Info to send in the commit, `null` = keep the remote info.
     */
    infoToCommit: SyncV2.SongInfo | null;
    /**
     * Info to write locally, `null` = keep the local `info.json`. Without `IGNORED_INFO_FIELDS`.
     */
    infoToWrite: SyncV2.SongInfo | null;
    /**
     * `infoUpdatedAt` to send with `infoToCommit` and to keep as this device's `localInfoUpdatedAt`.
     */
    infoUpdatedAt: number;
    /**
     * The next base, `null` once the song is gone from both sides.
     */
    base: NewBase | null;
    /**
     * Set when anything conflicted, ready to store in `SyncState.conflicts`.
     */
    conflict: ConflictRecord | null;
  }

  /**
   * Everything `planSong` needs.
   */
  export interface PlanInput {
    uid: string;
    /**
     * State at the last sync, `null` (or `files: null`) if the song was never synced.
     */
    base: { rev: number | null; info: SyncV2.SongInfo | null; infoUpdatedAt: number; files: BaseFiles } | null;
    /**
     * The local copy, `null` if there is none. After "Remove download" the engine must also clear the base, or the
     * missing local copy reads as a deletion.
     */
    local: { info: SyncV2.SongInfo; infoUpdatedAt: number; files: FileVersions } | null;
    /**
     * The server's track, `null` if it has none. A tombstone counts as no track.
     */
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
    /**
     * Where the losing version is kept, on both sides.
     */
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

  //#region Files

  /**
   * Per-path decision before conflicts are given their copies.
   */
  type Decision =
    | { type: "unchanged"; sha256: string }
    | { type: "push"; version: FileVersion }
    | { type: "pull"; version: FileVersion }
    | { type: "push-delete" }
    | { type: "delete-local" }
    | { type: "base-only"; sha256: string | null }
    | { type: "conflict"; local: FileVersion; remote: FileVersion; winner: Side };

  /**
   * Apply the §2.4 table to one path. `base` `undefined` = the path didn't exist at the last sync.
   */
  function decide(base: string | undefined, local: FileVersion | undefined, remote: FileVersion | undefined): Decision {
    const localSha = local?.sha256;
    const remoteSha = remote?.sha256;
    const localChanged = localSha !== base;
    const remoteChanged = remoteSha !== base;

    // Same on both sides as the base
    if (!localChanged && !remoteChanged) return { type: "unchanged", sha256: base as string };
    // Changed (or deleted) on one side only
    if (localChanged && !remoteChanged) return local ? { type: "push", version: local } : { type: "push-delete" };
    if (!localChanged && remoteChanged) return remote ? { type: "pull", version: remote } : { type: "delete-local" };
    // Changed on both sides to the same thing (including deleted on both)
    if (localSha === remoteSha) return { type: "base-only", sha256: localSha ?? null };
    // Deleted on one side, modified on the other: the modification wins
    if (!local) return { type: "pull", version: remote };
    if (!remote) return { type: "push", version: local };
    // Changed differently on both sides (or new on both with different content)
    return { type: "conflict", local, remote, winner: pickNewer(local, remote) };
  }

  /**
   * Newest wins: local mtime against the server's `receivedAt`. Equal times fall back to the larger hash, which keeps
   * the result independent of which side is "local", so every device resolves the same conflict the same way.
   */
  function pickNewer(local: FileVersion, remote: FileVersion): Side {
    const localTime = Number.isFinite(local.mtimeMs) ? local.mtimeMs : 0;
    const remoteTime = Number.isFinite(remote.mtimeMs) ? remote.mtimeMs : 0;
    if (localTime !== remoteTime) return localTime > remoteTime ? "local" : "remote";
    return local.sha256 > remote.sha256 ? "local" : "remote";
  }

  /**
   * Content of a path once a non-conflict decision is applied (`null` = gone), or `undefined` for a conflict.
   */
  function finalSha(decision: Decision): string | null | undefined {
    switch (decision.type) {
      case "unchanged": return decision.sha256;
      case "push": return decision.version.sha256;
      case "pull": return decision.version.sha256;
      case "push-delete": return null;
      case "delete-local": return null;
      case "base-only": return decision.sha256;
      case "conflict": return undefined;
    }
  }

  /**
   * Merge file sets per the table above. `base` `null` = first sync, merged against an empty base.
   * @param now Timestamp for the names of new conflict copies.
   */
  export function mergeFiles(base: BaseFiles, local: FileVersions, remote: FileVersions, now: number): FilesMergeResult {
    const baseFiles = base ?? {};
    const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(local), ...Object.keys(remote)])].sort();
    const decisions = new Map<string, Decision>();
    for (const path of paths) {
      decisions.set(path, decide(own(baseFiles, path), own(local, path), own(remote, path)));
    }

    const remoteShas = new Set(Object.values(remote).map(v => v.sha256));
    const taken = new Set(paths);
    const result: FilesMergeResult = {
      actions: [],
      uploads: [],
      commitFiles: {},
      remoteDeletes: [],
      localMoves: [],
      localDeletes: [],
      downloads: [],
      conflictCopies: [],
      newBase: {},
      uploadBytes: 0,
    };
    const uploaded = new Set<string>();
    // Commit `version` at `remotePath`, uploading its blob from local `localPath` unless the server already has it
    const push = (remotePath: string, version: FileVersion, localPath: string) => {
      result.commitFiles[remotePath] = { sha256: version.sha256, size: version.size };
      if (remoteShas.has(version.sha256) || uploaded.has(version.sha256)) return;
      uploaded.add(version.sha256);
      result.uploads.push({ sha256: version.sha256, size: version.size, localPath });
      result.uploadBytes += version.size;
    };
    const download = (path: string, version: FileVersion) => {
      result.downloads.push({ path, sha256: version.sha256, size: version.size });
    };

    for (const path of paths) {
      const decision = decisions.get(path);
      switch (decision.type) {
        case "unchanged":
          result.newBase[path] = decision.sha256;
          break;
        case "push":
          result.actions.push({ type: "push", path, version: decision.version });
          push(path, decision.version, path);
          result.newBase[path] = decision.version.sha256;
          break;
        case "pull":
          result.actions.push({ type: "pull", path, version: decision.version });
          download(path, decision.version);
          result.newBase[path] = decision.version.sha256;
          break;
        case "push-delete":
          result.actions.push({ type: "push-delete", path });
          result.remoteDeletes.push(path);
          break;
        case "delete-local":
          result.actions.push({ type: "delete-local", path });
          result.localDeletes.push(path);
          break;
        case "base-only":
          result.actions.push({ type: "base-only", path, sha256: decision.sha256 });
          if (decision.sha256 !== null) result.newBase[path] = decision.sha256;
          break;
        case "conflict": {
          const { winner } = decision;
          const winning = winner === "local" ? decision.local : decision.remote;
          const losing = winner === "local" ? decision.remote : decision.local;
          const reused = findReusableCopy(path, losing.sha256, decisions);
          const copyPath = reused ?? conflictCopyPath(path, now, taken);
          taken.add(copyPath);
          result.actions.push({ type: "conflict", path, copyPath, winner, local: decision.local, remote: decision.remote, reusedCopy: reused !== null });
          result.newBase[path] = winning.sha256;

          // The winner at `path` on both sides
          if (winner === "local") push(path, decision.local, path);
          else download(path, decision.remote);

          // The loser at `copyPath` on both sides, unless an earlier copy already carries it
          if (reused !== null) break;
          result.conflictCopies.push({ path, copyPath, from: winner === "local" ? "remote" : "local", sha256: losing.sha256, size: losing.size });
          result.newBase[copyPath] = losing.sha256;
          if (winner === "local") { // Remote version lost: the server has its blob already
            result.commitFiles[copyPath] = { sha256: losing.sha256, size: losing.size };
            download(copyPath, losing);
          }
          else { // Local version lost: upload it from `path` first, then move it aside locally
            push(copyPath, losing, path);
            result.localMoves.push({ from: path, to: copyPath });
          }
          break;
        }
      }
    }

    // Downloads in path order, so conflict copies don't depend on the loop order above
    result.downloads.sort((a, b) => compareStrings(a.path, b.path));
    return result;
  }

  /**
   * An existing conflict copy of `path` that will hold `sha256` on both sides once its own decision is applied.
   * This is what an interrupted sync leaves behind (the copy got committed, the base wasn't saved), and reusing it
   * stops the retry from making a second copy of the same content.
   */
  function findReusableCopy(path: string, sha256: string, decisions: Map<string, Decision>): string | null {
    const { dir, stem, ext } = splitPath(path);
    const pattern = new RegExp(`^${escapeRegExp(dir + stem + CONFLICT_MARKER)}\\d{8}-\\d{4}(?:-\\d+)?${escapeRegExp(ext)}$`, "i");
    for (const [candidate, decision] of decisions) {
      if (pattern.test(candidate) && finalSha(decision) === sha256) return candidate;
    }
    return null;
  }

  /**
   * Name of the kept loser: `name.conflict-YYYYMMDD-HHmm.ext` (local time of `now`), with `-2`, `-3`… before the
   * extension if that name is in `taken` (compared case-insensitively, for Windows and macOS file systems).
   * The directory is kept, the extension is the part after the last dot of the file name, and a leading dot is not
   * an extension. The name part is shortened if the result would pass `PATH_MAX_LENGTH`.
   *
   * Examples (now = 2026-11-07 14:32):
   * - `subtitles.srt` -> `subtitles.conflict-20261107-1432.srt`
   * - `extra/lyrics.v2.lrc` -> `extra/lyrics.v2.conflict-20261107-1432.lrc`
   * - `README` -> `README.conflict-20261107-1432`
   * - `.background` -> `.background.conflict-20261107-1432`
   * - `subtitles.srt` with the first name taken -> `subtitles.conflict-20261107-1432-2.srt`
   */
  export function conflictCopyPath(path: string, now: number, taken: ReadonlySet<string>): string {
    const { dir, stem, ext } = splitPath(path);
    const stamp = formatStamp(now);
    const takenLower = new Set<string>();
    for (const p of taken) takenLower.add(p.toLowerCase());

    for (let n = 1; ; n++) {
      const suffix = `${CONFLICT_MARKER}${stamp}${n > 1 ? `-${n}` : ""}${ext}`;
      const room = Math.max(1, PATH_MAX_LENGTH - dir.length - suffix.length);
      const candidate = dir + stem.slice(0, room) + suffix;
      if (!takenLower.has(candidate.toLowerCase())) return candidate;
    }
  }

  /**
   * Split a relative path into directory (with its trailing `/`), name and extension (with its dot).
   */
  function splitPath(path: string): { dir: string; stem: string; ext: string } {
    const slash = path.lastIndexOf("/");
    const dir = path.slice(0, slash + 1);
    const name = path.slice(slash + 1);
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) return { dir, stem: name, ext: "" };
    return { dir, stem: name.slice(0, dot), ext: name.slice(dot) };
  }

  /**
   * `YYYYMMDD-HHmm` in local time.
   */
  function formatStamp(now: number): string {
    const date = new Date(now);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  /**
   * Classify a path for the diff view by extension.
   */
  export function fileKind(path: string): FileKind {
    const ext = splitPath(path).ext.toLowerCase();
    if ((TEXT_EXTENSIONS as readonly string[]).includes(ext)) return "text";
    if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
    if ((MEDIA_EXTENSIONS as readonly string[]).includes(ext)) return "media";
    return "other";
  }

  /**
   * A server manifest as merge input (`receivedAt` as `mtimeMs`). A tombstone has no files.
   */
  export function remoteVersions(manifest: SyncV2.TrackManifest): FileVersions {
    const files: FileVersions = {};
    if (manifest.deleted) return files;
    for (const [path, entry] of Object.entries(manifest.files)) {
      files[path] = { sha256: entry.sha256, size: entry.size, mtimeMs: entry.receivedAt };
    }
    return files;
  }

  //#endregion

  //#region Info

  /**
   * Stands for "this key doesn't exist", which is different from a `null` value ("unset, inherit").
   */
  const MISSING: unique symbol = Symbol("missing");
  type Slot = unknown;

  /**
   * Merge info per field. `base` `null` = first sync, merged against an empty base: a field on one side only is
   * kept, a field that differs is a conflict decided by `infoUpdatedAt`.
   *
   * Rules, per field (and per sub-key of `DEEP_MERGE_FIELDS`):
   * - Unchanged on one side: take the other side.
   * - Changed on both sides to the same value: take it.
   * - Removed on one side, changed on the other: the change wins (an older client may drop keys it doesn't know).
   * - Changed differently on both sides: a deep field with objects on both sides is merged per sub-key; otherwise the
   *   side with the newer `infoUpdatedAt` wins, ties go to the larger canonical JSON of the value. Recorded as a conflict.
   */
  export function mergeInfo(base: SyncV2.SongInfo | null, local: SyncV2.SongInfo, localUpdatedAt: number, remote: SyncV2.SongInfo, remoteUpdatedAt: number): InfoMergeResult {
    const baseInfo = stripInfo(base ?? {});
    const localInfo = stripInfo(local);
    const remoteInfo = stripInfo(remote);
    const newer: Side | null = localUpdatedAt === remoteUpdatedAt ? null : (localUpdatedAt > remoteUpdatedAt ? "local" : "remote");
    const conflicts: InfoFieldConflict[] = [];
    const merged = mergeRecord(baseInfo, localInfo, remoteInfo, newer, conflicts, "", true);

    return {
      merged,
      infoUpdatedAt: Math.max(localUpdatedAt, remoteUpdatedAt),
      push: !deepEqual(merged, remoteInfo),
      pull: !deepEqual(merged, localInfo),
      conflicts,
    };
  }

  /**
   * A copy of `info` without `IGNORED_INFO_FIELDS` or `undefined` values.
   */
  export function stripInfo(info: SyncV2.SongInfo): SyncV2.SongInfo {
    const stripped: SyncV2.SongInfo = {};
    for (const [key, value] of Object.entries(info)) {
      if ((IGNORED_INFO_FIELDS as readonly string[]).includes(key) || value === undefined) continue;
      stripped[key] = value;
    }
    return stripped;
  }

  function mergeRecord(base: Record<string, unknown>, local: Record<string, unknown>, remote: Record<string, unknown>, newer: Side | null, conflicts: InfoFieldConflict[], prefix: string, topLevel: boolean): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    const keys = [...new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])];
    for (const key of keys) {
      const value = mergeSlot(key, slot(base, key), slot(local, key), slot(remote, key), newer, conflicts, prefix, topLevel);
      if (value !== MISSING) merged[key] = value;
    }
    return merged;
  }

  function mergeSlot(key: string, base: Slot, local: Slot, remote: Slot, newer: Side | null, conflicts: InfoFieldConflict[], prefix: string, topLevel: boolean): Slot {
    if (deepEqual(base, local)) return remote;
    if (deepEqual(base, remote)) return local;
    if (deepEqual(local, remote)) return local;

    const field = prefix + key;
    if (topLevel && (DEEP_MERGE_FIELDS as readonly string[]).includes(key) && isPlainObject(local) && isPlainObject(remote)) {
      return mergeRecord(isPlainObject(base) ? base : {}, local, remote, newer, conflicts, `${field}.`, false);
    }
    if (local === MISSING) return remote;
    if (remote === MISSING) return local;

    const winner = newer ?? (canonical(local) > canonical(remote) ? "local" : "remote");
    conflicts.push({ field, local, remote, winner });
    return winner === "local" ? local : remote;
  }

  function slot(record: Record<string, unknown>, key: string): Slot {
    const value = own(record, key);
    return value === undefined ? MISSING : value;
  }

  //#endregion

  //#region Song

  /**
   * Plan a whole song, including the song-level cases:
   * - Both sides exist: `mergeFiles` + `mergeInfo` (`sync`, or `noop` when there's nothing to do).
   * - Only local exists: with a base and no local change since it, the cloud deleted it -> `delete-local`.
   *   Otherwise -> `push-new` (never synced, or the local changes win over the cloud delete).
   * - Only remote exists: with a base and no cloud change since it, this device deleted it -> `tombstone`.
   *   Otherwise -> `pull-new` (never downloaded, or the cloud changes win over the local delete).
   * - Neither exists -> `noop` with a `null` base.
   */
  export function planSong(input: PlanInput): SyncPlan {
    const { uid, local, now } = input;
    const remote = input.remote && !input.remote.deleted ? input.remote : null;
    const base = input.base && input.base.files !== null ? input.base : null;
    const plan: SyncPlan = {
      uid,
      song: "noop",
      baseRev: remote ? remote.rev : null,
      files: mergeFiles({}, {}, {}, now),
      info: null,
      infoToCommit: null,
      infoToWrite: null,
      infoUpdatedAt: 0,
      base: null,
      conflict: null,
    };

    if (!local && !remote) return plan;

    if (local && !remote) {
      if (base && !hasChangedSince(base, local.files, local.info)) {
        plan.song = "delete-local";
        return plan;
      }
      const info = stripInfo(local.info);
      plan.song = "push-new";
      plan.files = mergeFiles({}, local.files, {}, now);
      plan.infoToCommit = info;
      plan.infoUpdatedAt = local.infoUpdatedAt;
      plan.base = { info, infoUpdatedAt: local.infoUpdatedAt, files: plan.files.newBase };
      return plan;
    }

    const remoteFiles = remoteVersions(remote);
    if (!local) {
      if (base && !hasChangedSince(base, remoteFiles, remote.info)) {
        plan.song = "tombstone";
        return plan;
      }
      const info = stripInfo(remote.info);
      plan.song = "pull-new";
      plan.files = mergeFiles({}, {}, remoteFiles, now);
      plan.infoToWrite = info;
      plan.infoUpdatedAt = remote.infoUpdatedAt;
      plan.base = { info, infoUpdatedAt: remote.infoUpdatedAt, files: plan.files.newBase };
      return plan;
    }

    const files = mergeFiles(base ? base.files : null, local.files, remoteFiles, now);
    const info = mergeInfo(input.base?.info ?? null, local.info, local.infoUpdatedAt, remote.info, remote.infoUpdatedAt);
    plan.files = files;
    plan.info = info;
    plan.infoToCommit = info.push ? info.merged : null;
    plan.infoToWrite = info.pull ? info.merged : null;
    plan.infoUpdatedAt = info.infoUpdatedAt;
    plan.base = { info: info.merged, infoUpdatedAt: info.push ? info.infoUpdatedAt : remote.infoUpdatedAt, files: files.newBase };
    plan.conflict = buildConflictRecord(uid, info.merged, files, info, now);

    const baseCurrent = base !== null
      && base.rev === remote.rev
      && deepEqual(base.files, files.newBase)
      && deepEqual(stripInfo(base.info ?? {}), info.merged);
    plan.song = hasFileWork(files) || info.push || info.pull || !baseCurrent ? "sync" : "noop";
    return plan;
  }

  /**
   * The commit for a plan, or `null` when there's nothing to commit (`tombstone` uses `DELETE` instead).
   */
  export function toCommitRequest(plan: SyncPlan): SyncV2.CommitRequest | null {
    if (plan.song !== "sync" && plan.song !== "push-new") return null;
    const request: SyncV2.CommitRequest = { baseRev: plan.baseRev };
    if (plan.infoToCommit) {
      request.info = plan.infoToCommit;
      request.infoUpdatedAt = plan.infoUpdatedAt;
    }
    if (Object.keys(plan.files.commitFiles).length > 0) request.files = plan.files.commitFiles;
    if (plan.files.remoteDeletes.length > 0) request.deletes = plan.files.remoteDeletes;
    if (!request.info && !request.files && !request.deletes) return null;
    return request;
  }

  /**
   * Whether a plan has nothing to transfer, write or store.
   */
  export function isNoop(plan: SyncPlan): boolean {
    return plan.song === "noop";
  }

  function hasFileWork(files: FilesMergeResult): boolean {
    return files.uploads.length > 0
      || Object.keys(files.commitFiles).length > 0
      || files.remoteDeletes.length > 0
      || files.localMoves.length > 0
      || files.localDeletes.length > 0
      || files.downloads.length > 0;
  }

  /**
   * Whether a side's files or info differ from the base.
   */
  function hasChangedSince(base: PlanInput["base"], files: FileVersions, info: SyncV2.SongInfo): boolean {
    const shas: Record<string, string> = {};
    for (const [path, version] of Object.entries(files)) shas[path] = version.sha256;
    return !deepEqual(base.files, shas) || !deepEqual(stripInfo(base.info ?? {}), stripInfo(info));
  }

  function buildConflictRecord(uid: string, info: SyncV2.SongInfo, files: FilesMergeResult, infoResult: InfoMergeResult, now: number): ConflictRecord | null {
    const items: ConflictItem[] = [];
    for (const action of files.actions) {
      if (action.type !== "conflict") continue;
      items.push({ type: "file", kind: fileKind(action.path), path: action.path, copyPath: action.copyPath, winner: action.winner, local: action.local, remote: action.remote });
    }
    if (infoResult.conflicts.length > 0) items.push({ type: "info", fields: infoResult.conflicts });
    if (items.length === 0) return null;
    return { id: `${uid}-${now}`, uid, songName: songName(uid, info), createdAt: now, items };
  }

  /**
   * "Artist - Title", or whichever exists, or the uid.
   */
  function songName(uid: string, info: SyncV2.SongInfo): string {
    const artist = typeof info.artist === "string" ? info.artist.trim() : "";
    const title = typeof info.title === "string" ? info.title.trim() : "";
    if (artist && title) return `${artist} - ${title}`;
    return artist || title || uid;
  }

  //#endregion

  //#region Helpers

  function own<T>(record: Record<string, T>, key: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Structural equality for JSON-like values. Key order doesn't matter, `MISSING` only equals `MISSING`.
   */
  function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
      return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    }
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).filter(k => aRecord[k] !== undefined);
    const bKeys = Object.keys(bRecord).filter(k => bRecord[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => Object.prototype.hasOwnProperty.call(bRecord, k) && deepEqual(aRecord[k], bRecord[k]));
  }

  /**
   * JSON with sorted keys, for side-independent tie-breaks.
   */
  function canonical(value: unknown): string {
    return JSON.stringify(value, (_key, v: unknown) => {
      if (!isPlainObject(v)) return v;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }) ?? "";
  }

  function compareStrings(a: string, b: string): number {
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  //#endregion
}

export default Merge;
