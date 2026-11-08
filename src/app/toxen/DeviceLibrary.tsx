import React from "react";
import { updateNotification } from "@mantine/notifications";
import { Toxen } from "../ToxenApp";
import Song from "./Song";
import { SongLibrary } from "./SongLibrary";
import { DeviceSongStorage } from "./storage/DeviceSongStorage";
import { DeviceFs } from "./storage/device/DeviceFs";

/**
 * Adding songs from the phone or computer to the web app's device storage: the file and folder pickers, the copy with
 * progress, and the one-time notice about how safe the browser keeps them. Web only; desktop imports into the library
 * folder through `System.handleImportedFiles`.
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
    return added;
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
