import { SyncV2 } from "./SyncApi";
import { Merge } from "./Merge";
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

  /**
   * Files hashed at the same time by `scanLocal`.
   */
  export const HASH_CONCURRENCY = 2;

  // Example: `subtitles.srt.tmp-k3j9x0a2`, the temp name of `toxenapi.atomicWriteFile`
  const ATOMIC_TEMP_PATTERN = /\.tmp-[a-z0-9]+$/i;

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
   * (streamed, at most `HASH_CONCURRENCY` at a time). Skips `info.json`, reserved prefixes and temp files.
   * @param songDir Absolute path of the song folder.
   * @throws If the folder can't be listed or a file can't be hashed.
   */
  export async function scanLocal(songDir: string, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<ScanResult> {
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Manifest.scanLocal");
    const api = toxenapi;
    const stats = (await api.listFilesRecursive(songDir)).filter(stat => isSyncablePath(stat.relPath));
    const files: Merge.FileVersions = {};
    const cache: Record<string, SyncState.HashCacheEntry> = {};
    const toHash: typeof stats = [];

    for (const stat of stats) {
      const cached = Object.prototype.hasOwnProperty.call(hashCache, stat.relPath) ? hashCache[stat.relPath] : null;
      if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
        files[stat.relPath] = { sha256: cached.sha256, size: cached.size, mtimeMs: cached.mtimeMs };
        cache[stat.relPath] = cached;
      }
      else {
        toHash.push(stat);
      }
    }

    let next = 0;
    const worker = async () => {
      while (next < toHash.length) {
        const stat = toHash[next++];
        const hash = await api.hashFile(api.path.join(songDir, ...stat.relPath.split("/")));
        files[stat.relPath] = { sha256: hash.sha256, size: hash.size, mtimeMs: hash.mtimeMs };
        cache[stat.relPath] = { sha256: hash.sha256, size: hash.size, mtimeMs: hash.mtimeMs };
      }
    };
    await Promise.all(Array.from({ length: Math.min(HASH_CONCURRENCY, toHash.length) }, worker));
    return { files, hashCache: cache, hashed: toHash.length };
  }

  /**
   * Quick check without hashing: did any file's size or mtime change, or a file appear or vanish, since the cache?
   * Used at startup to find songs that changed while the app was closed. A missing folder counts as a change.
   */
  export async function hasLocalChanges(songDir: string, hashCache: Record<string, SyncState.HashCacheEntry>): Promise<boolean> {
    if (!toxenapi.isDesktop()) return false;
    const stats = await toxenapi.listFilesRecursive(songDir).catch((): null => null);
    if (!stats) return true;
    const syncable = stats.filter(stat => isSyncablePath(stat.relPath));
    if (syncable.length !== Object.keys(hashCache).length) return true;
    return syncable.some(stat => {
      const cached = Object.prototype.hasOwnProperty.call(hashCache, stat.relPath) ? hashCache[stat.relPath] : null;
      return !cached || cached.size !== stat.size || cached.mtimeMs !== stat.mtimeMs;
    });
  }

  /**
   * A server manifest as merge input (`receivedAt` as `mtimeMs`).
   */
  export function fromRemote(manifest: SyncV2.TrackManifest): Merge.FileVersions {
    return Merge.remoteVersions(manifest);
  }

  /**
   * Whether a relative path takes part in sync: valid per the `SyncV2` path rules, not reserved, not a temp file.
   */
  export function isSyncablePath(relPath: string): boolean {
    if (relPath.length === 0 || relPath.length > SyncV2.PATH_MAX_LENGTH) return false;
    if (relPath.includes("\\") || relPath.includes("\0")) return false;
    if (relPath.split("/").some(segment => segment === "" || segment === "." || segment === "..")) return false;
    const lower = relPath.toLowerCase();
    if ((SyncV2.RESERVED_PATHS as readonly string[]).includes(lower)) return false;
    if (SyncV2.RESERVED_PREFIXES.some(prefix => lower.startsWith(prefix))) return false;
    if (TEMP_SUFFIXES.some(suffix => lower.endsWith(suffix))) return false;
    return !ATOMIC_TEMP_PATTERN.test(relPath);
  }
}

export default Manifest;
