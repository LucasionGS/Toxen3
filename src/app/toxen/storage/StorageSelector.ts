import type Song from "../Song";
import type { SongStorage } from "./SongStorage";

/**
 * The one place that decides which storage a song uses. `Song` exposes it as `public get storage()`.
 *
 * Phase 1 (2.13, `Settings.isRemote()` still exists): exactly today's behaviour, centralised.
 *   forSong(song)  = Settings.isRemote() ? Cloud : Local
 *   forLibrary()   = Settings.isRemote() ? Cloud : Local   (web: isRemote() is always true)
 *
 * Phase 4 (2.14, unified library, `isRemote` migrated away):
 *   forSong(song)  = song.location.local ? Local : Cloud   (a downloaded song plays from disk; cloud-only streams)
 *   forLibrary()   = toxenapi.isDesktop() ? Local : Cloud  (new imports land on disk and sync up; web uploads)
 *
 * Only this file changes between the phases; call sites stay the same.
 */
export namespace StorageSelector {
  /**
   * Storage of an existing song.
   */
  export function forSong(song: Song): SongStorage {
    throw new Error("Not implemented.");
  }

  /**
   * Storage for library-level operations: listing, counting, importing new songs.
   */
  export function forLibrary(): SongStorage {
    throw new Error("Not implemented.");
  }

  /**
   * Shorthand for `forSong(song).kind === SongStorage.Kind.Local`. Use for desktop-only per-song features
   * (trim, convert, transcode, open in file explorer) instead of `!Settings.isRemote()`.
   */
  export function isLocal(song: Song): boolean {
    throw new Error("Not implemented.");
  }
}

export default StorageSelector;
