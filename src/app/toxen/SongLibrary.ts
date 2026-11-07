import type Song from "./Song";
import type { ToxenFile } from "./System";
import type { Result } from "./Result";

/**
 * Loading, importing and deleting songs (moved out of `Song.tsx`: `getSongs`, `getSongCount`, `loadLocalSongs`,
 * `loadRemoteSongs`, `importSong`, `importSongRemote`, `delete`). Works through `StorageSelector`, never `Settings.isRemote()`.
 *
 * Phase 1: `load()` lists `StorageSelector.forLibrary()` only, exactly as today.
 * Phase 4: `load()` lists both storages on desktop, merges by uid and sets `song.location`; cloud-only songs are built
 * from `SyncState` bases. Web lists the cloud only.
 */
export class SongLibrary {
  private constructor() { }

  /**
   * Load every song, sorted as `Song.sortSongs` does today.
   * @param onEach Called per loaded song (loading screen). Throttle UI updates on the caller side (plan P5).
   */
  public static async load(onEach?: (song: Song) => void): Promise<Song[]> {
    throw new Error("Not implemented.");
  }

  /**
   * Total for the loading screen.
   */
  public static async count(): Promise<number> {
    throw new Error("Not implemented.");
  }

  /**
   * Import a dropped or picked media file as a new song into `StorageSelector.forLibrary()`.
   */
  public static async importMedia(file: File | ToxenFile): Promise<Result<Song>> {
    throw new Error("Not implemented.");
  }

  /**
   * Delete a song. Phase 1 only supports `"auto"` (today's behaviour minus the C2 cloud delete).
   * Phase 4 adds the explicit scopes of the Delete dialog (plan §2.1).
   */
  public static async delete(song: Song, scope?: SongLibrary.DeleteScope): Promise<void> {
    throw new Error("Not implemented.");
  }
}

export namespace SongLibrary {
  /**
   * `auto` = the song's own storage. `device` = local copy only (keeps the cloud copy). `cloud` = cloud copy only.
   * `everywhere` = both.
   */
  export type DeleteScope = "auto" | "device" | "cloud" | "everywhere";
}

export default SongLibrary;
