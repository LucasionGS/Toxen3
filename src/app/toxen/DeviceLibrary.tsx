import React from "react";
import { updateNotification } from "@mantine/notifications";
import { Toxen } from "../ToxenApp";
import Song from "./Song";
import { SongLibrary } from "./SongLibrary";
import { DeviceSongStorage } from "./storage/DeviceSongStorage";
import { DeviceFs } from "./storage/device/DeviceFs";
import { CloudSongStorage } from "./storage/CloudSongStorage";
import { SongStorage } from "./storage/SongStorage";
import Settings from "./Settings";
import User from "./User";

/**
 * The web app's songs on this device: adding them (file and folder pickers, the copy with progress, the one-time
 * notice about how safe the browser keeps them) and linking them with the cloud (upload, save a cloud song on the
 * device, refresh a saved copy when the cloud version changes). Web only; desktop imports into the library folder
 * through `System.handleImportedFiles` and syncs through `SyncEngine`.
 *
 * Transfers for one song run one at a time, in the order they were asked for.
 */
export namespace DeviceLibrary {
  /**
   * Per-device flag (`localStorage`) set once the storage notice has been shown.
   */
  export const NOTICE_KEY = "toxen.deviceStorageNoticeShown";

  /**
   * Whether this browser can keep songs on the device.
   */
  export function isAvailable(): boolean {
    return DeviceSongStorage.isAvailable();
  }

  /**
   * Whether the folder picker is there (`showDirectoryPicker`).
   */
  export function canPickFolder(): boolean {
    return isAvailable() && DeviceFs.canPickFolder();
  }

  /**
   * Open the file picker and add the picked audio and video files.
   */
  export function pickFiles(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = [...Toxen.getSupportedMediaFiles(), "audio/*", "video/*"].join(",");
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])];
      input.remove();
      if (files.length > 0) importFiles(files);
    });
    // iOS only opens the picker for inputs that are in the document
    document.body.appendChild(input);
    input.click();
  }

  /**
   * Open the folder picker and add every audio and video file in the folder and its subfolders.
   */
  export async function pickFolder(): Promise<void> {
    const picker = (window as DeviceFs.FolderPickerWindow).showDirectoryPicker;
    if (!picker) return Toxen.error("This browser can't pick folders. Pick the files instead.");
    let folder: FileSystemDirectoryHandle;
    try {
      folder = await picker.call(window, { id: "toxen-device-import", mode: "read" });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return; // The user closed the picker
      return Toxen.error(`Unable to open the folder: ${error instanceof Error ? error.message : String(error)}`);
    }
    const files: File[] = [];
    const walk = async (dir: FileSystemDirectoryHandle): Promise<void> => {
      for await (const handle of dir.values()) {
        if (handle.kind === "directory") await walk(handle as FileSystemDirectoryHandle);
        else if (isMedia(handle.name)) files.push(await (handle as FileSystemFileHandle).getFile());
      }
    };
    await walk(folder);
    if (files.length === 0) return Toxen.warn(`There are no songs in "${folder.name}".`, 5000);
    await importFiles(files);
  }

  /**
   * Copy files into device storage as new songs, one song per audio or video file, with a progress notification.
   * Other files are skipped. Stops at the first "device full" error.
   * @returns The songs that were added.
   */
  export async function importFiles(files: File[]): Promise<Song[]> {
    const media = files.filter(file => isMedia(file.name));
    const skipped = files.length - media.length;
    if (media.length === 0) {
      Toxen.error(files.length === 1 ? `${files[0].name} isn't a song Toxen can play.` : "None of these files are songs Toxen can play.");
      return [];
    }

    const nId = Toxen.notify({ title: "Adding songs to this device", content: `0 of ${media.length}`, disableClose: true });
    const added: Song[] = [];
    const failed: string[] = [];
    for (const file of media) {
      updateNotification({ id: nId, message: `${added.length + failed.length + 1} of ${media.length}: ${file.name}`, autoClose: false });
      const result = await SongLibrary.importToDevice(file);
      if (result.isSuccess()) {
        added.push(result.data);
        (Toxen.songList ??= []).push(result.data);
      }
      else if (result.isFailure()) {
        failed.push(`${file.name}: ${result.message}`);
        if (result.message === new DeviceFs.QuotaError().message) break;
      }
    }
    if (added.length > 0) {
      Song.sortSongs(Toxen.songList);
      Toxen.updateSongPanels();
    }

    const summary = [
      added.length === 1 ? "Added 1 song to this device." : `Added ${added.length} songs to this device.`,
      skipped > 0 ? `Skipped ${skipped} ${skipped === 1 ? "file that isn't a song" : "files that aren't songs"}.` : "",
    ].filter(Boolean).join(" ");
    updateNotification({
      id: nId,
      title: failed.length > 0 ? "Some songs couldn't be added" : "Songs added",
      message: failed.length > 0
        ? <div><p>{summary}</p><ul>{failed.slice(0, 5).map(line => <li key={line}>{line}</li>)}</ul></div>
        : summary,
      color: failed.length > 0 ? (added.length > 0 ? "yellow" : "red") : "green",
      autoClose: failed.length > 0 ? false : 4000,
      withCloseButton: true,
    });
    if (added.length > 0) showStorageNotice();
    // New songs go up to the cloud when auto-sync is on, like desktop imports
    if (added.length > 0 && User.getCurrentUser() && Settings.get("autoSync") !== false) {
      uploadAll(added).catch(error => console.error("Unable to upload the new songs.", error));
    }
    return added;
  }

  /**
   * Upload a song that is only on this device, then keep both copies linked.
   * @throws If nobody is logged in, or the upload fails (cloud storage full, offline).
   */
  export function upload(song: Song): Promise<void> {
    return _queue(song.uid, async () => {
      if (!User.getCurrentUser()) throw new Error("Log in to upload songs to the cloud.");
      if (song.location?.cloud) return;
      const device = DeviceSongStorage.instance;
      for (const file of await device.list(song)) {
        const blob = await device.readBlob(song, file.relPath);
        if (blob) await CloudSongStorage.instance.writeFile(song, file.relPath, blob);
      }
      await CloudSongStorage.instance.saveInfo(song);
      await device.recordCloudState(song.uid);
      song.location = { local: true, cloud: true };
      Toxen.updateSongPanels();
    });
  }

  /**
   * Upload several device songs one after another and report the result once.
   */
  export async function uploadAll(songs: Song[]): Promise<void> {
    let failed = 0;
    let lastError = "";
    for (const song of songs) {
      try {
        await upload(song);
      } catch (error) {
        failed++;
        lastError = error instanceof Error ? error.message : String(error);
        console.error(error);
      }
    }
    if (failed === 0) {
      Toxen.log(songs.length === 1 ? `Uploaded ${songs[0].getDisplayName()} to the cloud.` : `Uploaded ${songs.length} songs to the cloud.`, 3000);
    }
    else {
      Toxen.error(songs.length === 1 ? `Couldn't upload ${songs[0].getDisplayName()}: ${lastError}` : `Couldn't upload ${failed} of ${songs.length} songs: ${lastError}`);
    }
  }

  /**
   * Download a cloud song and keep it on this device, so it plays offline ("Make available offline").
   * A failed download leaves nothing behind.
   * @throws If the song isn't in the cloud, the device is full or the download fails.
   */
  export function saveOnDevice(song: Song): Promise<void> {
    return _queue(song.uid, async () => {
      if (!isAvailable()) throw new Error("This browser can't keep songs on the device.");
      if (song.location?.local) return;
      const manifest = CloudSongStorage.instance.getManifest(song.uid);
      if (!manifest || manifest.deleted) throw new Error("The song isn't in the cloud anymore. Reload the library and try again.");
      try {
        await _download(song, Object.keys(manifest.files));
        await DeviceSongStorage.instance.saveInfo(song);
        await DeviceSongStorage.instance.recordCloudState(song.uid);
      } catch (error) {
        await DeviceFs.deleteSong(song.uid).catch((): void => undefined);
        throw error;
      }
      song.location = { local: true, cloud: true };
      Toxen.updateSongPanels();
      showStorageNotice();
    });
  }

  /**
   * Bring the device copy of a song up to date with the cloud version this device knows: download changed files,
   * delete removed ones and take the cloud info. Does nothing when the copy is current or the song has no cloud copy.
   */
  export function refresh(song: Song): Promise<void> {
    return _queue(song.uid, async () => {
      if (!song.location?.local || !User.getCurrentUser()) return;
      const manifest = CloudSongStorage.instance.getManifest(song.uid);
      if (!manifest || manifest.deleted) return;
      const device = DeviceSongStorage.instance;
      const state = await device.readState(song.uid);
      if (state?.rev === manifest.rev) return;

      const changed = Object.entries(manifest.files)
        .filter(([relPath, file]) => state?.files[relPath] !== file.sha256)
        .map(([relPath]) => relPath);
      const removed = state ? Object.keys(state.files).filter(relPath => !Object.prototype.hasOwnProperty.call(manifest.files, relPath)) : [];
      await _download(song, changed);
      for (const relPath of removed) await DeviceFs.deleteFile(song.uid, relPath);
      song.applyInfo(CloudSongStorage.toSongInfo(manifest));
      await device.saveInfo(song);
      await device.recordCloudState(song.uid);
      Toxen.updateSongPanels();
    });
  }

  /**
   * Refresh every song that has both copies, one at a time (after the library loads). Failures are logged; the
   * next load tries again.
   */
  export async function refreshAll(songs: Song[]): Promise<void> {
    for (const song of songs) {
      if (!song.location?.local || !song.location.cloud) continue;
      await refresh(song).catch(error => console.warn(`Unable to refresh the device copy of ${song.getDisplayName()}.`, error));
    }
  }


  /**
   * Tell the user once how safe songs on this device are. Not shown again on this device.
   */
  export async function showStorageNotice(): Promise<void> {
    if (_read(NOTICE_KEY)) return;
    const persisted = await DeviceFs.persist();
    _write(NOTICE_KEY, "1");
    if (persisted) return;
    Toxen.notify({
      title: "Your browser may clear these songs",
      content: <div>
        <p>The browser didn't promise to keep Toxen's storage, so it can remove songs on this device when space runs low or the app isn't used for a while.</p>
        <p>On iPhone and iPad, add Toxen to your home screen. Log in to keep a copy in the cloud.</p>
      </div>,
      type: "warning",
    });
  }

  /**
   * Whether a file name has an extension Toxen plays.
   */
  export function isMedia(name: string): boolean {
    return Toxen.getSupportedMediaFiles().includes(toxenapi.getFileExtension(name).toLowerCase());
  }

  const _queues = new Map<string, Promise<unknown>>();

  /**
   * Run `task` after the transfers already queued for the song.
   */
  function _queue<T>(uid: string, task: () => Promise<T>): Promise<T> {
    const previous = _queues.get(uid) ?? Promise.resolve();
    const next = previous.catch((): void => undefined).then(task);
    _queues.set(uid, next);
    next.finally(() => {
      if (_queues.get(uid) === next) _queues.delete(uid);
    }).catch((): void => undefined);
    return next;
  }

  /**
   * Copy cloud files of a song into its device folder.
   */
  async function _download(song: Song, relPaths: string[]): Promise<void> {
    for (const relPath of relPaths) {
      if (relPath === SongStorage.INFO_FILE || relPath === DeviceSongStorage.STATE_FILE) continue;
      const blob = await CloudSongStorage.instance.readBlob(song, relPath);
      if (!blob) throw new Error(`"${relPath}" is missing from the cloud copy of ${song.getDisplayName()}.`);
      await DeviceFs.writeFile(song.uid, relPath, blob);
    }
  }

  function _read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function _write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode: the notice may show again, which is harmless
    }
  }
}

export default DeviceLibrary;
