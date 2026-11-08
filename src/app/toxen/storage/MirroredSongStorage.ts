import type Song from "../Song";
import type { ISong } from "../Song";
import { SongStorage } from "./SongStorage";
import { CloudSongStorage } from "./CloudSongStorage";
import { DeviceSongStorage } from "./DeviceSongStorage";

/**
 * A web song kept on this device that is also in the cloud. Reads and playback use the device copy; every write goes
 * to the cloud first and then to the device, so the cloud stays the copy other devices sync from and the device copy
 * never gets ahead of it. A write that can't reach the cloud fails without touching the device copy.
 *
 * Kind is `Device`, since the song plays from this device.
 */
export class MirroredSongStorage implements SongStorage {
  /**
   * The shared instance.
   */
  public static readonly instance = new MirroredSongStorage();

  public readonly kind = SongStorage.Kind.Device;

  private get _device() { return DeviceSongStorage.instance; }
  private get _cloud() { return CloudSongStorage.instance; }

  public fileUrl(song: Song, relPath: string): string {
    return this._device.fileUrl(song, relPath);
  }

  public fileLocation(song: Song, relPath?: string): string {
    return this._device.fileLocation(song, relPath);
  }

  public mediaSource(song: Song, relPath: string): Promise<{ url: string; revoke: () => void } | null> {
    return this._device.mediaSource(song, relPath);
  }

  public readText(song: Song, relPath: string): Promise<string | null> {
    return this._device.readText(song, relPath);
  }

  public readBlob(song: Song, relPath: string): Promise<Blob | null> {
    return this._device.readBlob(song, relPath);
  }

  public async writeFile(song: Song, relPath: string, data: SongStorage.WriteData): Promise<void> {
    await this._cloud.writeFile(song, relPath, data);
    await this._device.writeFile(song, relPath, data);
    await this._device.recordCloudState(song.uid);
  }

  public async deleteFile(song: Song, relPath: string): Promise<void> {
    await this._cloud.deleteFile(song, relPath);
    await this._device.deleteFile(song, relPath);
    await this._device.recordCloudState(song.uid);
  }

  public list(song: Song): Promise<SongStorage.FileEntry[]> {
    return this._device.list(song);
  }

  public async saveInfo(song: Song): Promise<void> {
    await this._cloud.saveInfo(song);
    await this._device.saveInfo(song);
    await this._device.recordCloudState(song.uid);
  }

  /**
   * Deletes the device copy only. "Delete everywhere" is `SongLibrary.delete(song, "everywhere")`.
   */
  public deleteSong(song: Song): Promise<void> {
    return this._device.deleteSong(song);
  }

  public listSongs(onEach?: (info: ISong) => void, onSkip?: (skipped: SongStorage.SkippedEntry) => void): Promise<ISong[]> {
    return this._device.listSongs(onEach, onSkip);
  }

  public countSongs(): Promise<number> {
    return this._device.countSongs();
  }
}

export default MirroredSongStorage;
