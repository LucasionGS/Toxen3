import type Song from "../Song";
import Settings from "../Settings";
import { SongStorage } from "./SongStorage";
import { LocalSongStorage } from "./LocalSongStorage";
import { CloudSongStorage } from "./CloudSongStorage";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 4 decides per song from `song.location`
  export function forSong(song: Song): SongStorage {
    // Phase 1: every song lives where the library lives
    return forLibrary();
  }

  /**
   * Storage for library-level operations: listing, counting, importing new songs.
   */
  export function forLibrary(): SongStorage {
    return Settings.isRemote() ? CloudSongStorage.instance : LocalSongStorage.instance;
  }

  /**
   * Shorthand for `forSong(song).kind === SongStorage.Kind.Local`. Use for desktop-only per-song features
   * (trim, convert, transcode, open in file explorer) instead of `!Settings.isRemote()`.
   */
  export function isLocal(song: Song): boolean {
    return forSong(song).kind === SongStorage.Kind.Local;
  }
}

export default StorageSelector;
