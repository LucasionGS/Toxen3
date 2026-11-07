import type { SyncV2 } from "./SyncApi";
import type { Merge } from "./Merge";
import type { SyncState } from "./SyncState";

/**
 * Builds the file side of a merge: scanning a local song folder (desktop, via `toxenapi.listFilesRecursive` and
 * `toxenapi.hashFile`) or reading a server manifest. Never imports `node:crypto` or `node:fs` itself.
 */
export namespace Manifest {
  /**
   * Suffixes of temp files that are never synced (in-progress downloads and atomic writes).
   */
  export const TEMP_SUFFIXES = [".toxen-part", ".tmp"] as const;

  export interface ScanResult {
    files: Merge.FileVersions;
    /**
     * Updated cache to store back into `SyncState.SongState.hashCache` (entries of vanished files dropped).
     */
    hashCache: Record<string, SyncState.HashCacheEntry>;
    /**
     * Number of files that had to be re-hashed.
     */
    hashed: number;
  }

  /**
   * Scan a song folder. Files whose size and mtime match `hashCache` reuse the cached hash; others are hashed
   * (streamed, at most 2 at a time). Skips `info.json`, reserved prefixes and temp files.
   * @param songDir Absolute path of the song folder.
   */
  export async function scanLocal(songDir: string, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<ScanResult> {
    throw new Error("Not implemented.");
  }

  /**
   * Quick check without hashing: did any file's size or mtime change, or a file appear or vanish, since the cache?
   * Used at startup to find songs that changed while the app was closed.
   */
  export async function hasLocalChanges(songDir: string, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<boolean> {
    throw new Error("Not implemented.");
  }

  /**
   * A server manifest as merge input (`receivedAt` as `mtimeMs`).
   */
  export function fromRemote(manifest: SyncV2.TrackManifest): Merge.FileVersions {
    throw new Error("Not implemented.");
  }

  /**
   * Whether a relative path takes part in sync: valid per the `SyncV2` path rules, not reserved, not a temp file.
   */
  export function isSyncablePath(relPath: string): boolean {
    throw new Error("Not implemented.");
  }
}

export default Manifest;
