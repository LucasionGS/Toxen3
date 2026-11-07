import type Song from "../Song";
import { SongStorage } from "./SongStorage";
import { LocalSongStorage } from "./LocalSongStorage";
import { CloudSongStorage } from "./CloudSongStorage";

/**
 * The one place that decides which storage a song uses. `Song` exposes it as `public get storage()`.
 *
 * Unified library (sync v2):
 *   forSong(song)  = web ? Cloud : (song.location.local ? Local : Cloud)   (a downloaded song plays from disk; cloud-only streams)
 *   forLibrary()   = toxenapi.isDesktop() ? Local : Cloud                  (new imports land on disk and sync up; web uploads)
 *
 * A song without a `location` (a draft being imported, a song built before the library set it) is local on desktop.
 */
export namespace StorageSelector {
  /**
   * Storage of an existing song.
   */
  export function forSong(song: Song): SongStorage {
    if (!toxenapi.isDesktop()) return CloudSongStorage.instance;
    return song.location && !song.location.local ? CloudSongStorage.instance : LocalSongStorage.instance;
  }

  /**
   * Storage for library-level operations: listing, counting, importing new songs.
   */
  export function forLibrary(): SongStorage {
    return toxenapi.isDesktop() ? LocalSongStorage.instance : CloudSongStorage.instance;
  }

  /**
   * Shorthand for `forSong(song).kind === SongStorage.Kind.Local`. Use for desktop-only per-song features
   * (trim, convert, transcode, open in file explorer).
   */
  export function isLocal(song: Song): boolean {
    return forSong(song).kind === SongStorage.Kind.Local;
  }
}

export default StorageSelector;
