import type Song from "../Song";
import Settings from "../Settings";
import { SongStorage } from "./SongStorage";
import { LocalSongStorage } from "./LocalSongStorage";
import { CloudSongStorage } from "./CloudSongStorage";
import { DeviceSongStorage } from "./DeviceSongStorage";
import { MirroredSongStorage } from "./MirroredSongStorage";

/**
 * The one place that decides which storage a song uses. `Song` exposes it as `public get storage()`.
 *
 * Unified library (sync v2):
 *   forSong(song)  = desktop: song.location.local ? Local : Cloud          (a downloaded song plays from disk; cloud-only streams)
 *                    web:     song.location.local ? (cloud too ? Mirrored : Device) : Cloud
 *                             (a song kept on this device plays from it; one that is also in the cloud writes to both)
 *   forLibrary()   = desktop: Local                                        (new imports land on disk and sync up)
 *                    web:     Cloud when logged in, otherwise Device       (drops upload; signed out they stay on the device)
 *
 * A song without a `location` (a draft being imported, a song built before the library set it) is local on desktop
 * and cloud on the web.
 */
export namespace StorageSelector {
  /**
   * Storage of an existing song.
   */
  export function forSong(song: Song): SongStorage {
    if (!toxenapi.isDesktop()) {
      if (!song.location?.local || !DeviceSongStorage.isAvailable()) return CloudSongStorage.instance;
      return song.location.cloud && Settings.getUser() ? MirroredSongStorage.instance : DeviceSongStorage.instance;
    }
    return song.location && !song.location.local ? CloudSongStorage.instance : LocalSongStorage.instance;
  }

  /**
   * Storage for library-level operations: listing, counting, importing new songs.
   */
  export function forLibrary(): SongStorage {
    if (toxenapi.isDesktop()) return LocalSongStorage.instance;
    return !Settings.getUser() && DeviceSongStorage.isAvailable() ? DeviceSongStorage.instance : CloudSongStorage.instance;
  }

  /**
   * Whether the song plays from a copy on this device: the library folder on desktop, device storage on the web.
   */
  export function isOnDevice(song: Song): boolean {
    const kind = forSong(song).kind;
    return kind === SongStorage.Kind.Local || kind === SongStorage.Kind.Device;
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
