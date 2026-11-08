// eslint-disable-next-line import/no-unresolved -- Vite virtual module
import DeviceWriterWorker from "./DeviceWriter.worker?worker&inline";
import type { DeviceWriterRequest, DeviceWriterResponse } from "./DeviceWriter.worker";

/**
 * File access for songs stored in the browser's Origin Private File System (OPFS). Web only; the desktop app keeps
 * songs in the library folder instead.
 *
 * Layout (the same as a desktop song folder, keyed by uid):
 * ```
 * <OPFS root>/library/<uid>/info.json
 * <OPFS root>/library/<uid>/<media and other files>
 * ```
 * The service worker (`public/device-sw.js`) reads the same layout to serve `/__device/<uid>/<path>`.
 */
export namespace DeviceFs {
  /**
   * Name of the folder in the OPFS root that holds one folder per song.
   */
  export const LIBRARY_DIR = "library";

  /**
   * Name of the folder in the OPFS root where the service worker stores files shared to the app (Android). Keep in
   * sync with `public/device-sw.js`.
   */
  export const INBOX_DIR = "inbox";

  /**
   * Prefix of the same-origin URLs the service worker answers from OPFS. Keep in sync with `public/device-sw.js`.
   */
  export const URL_PREFIX = "/__device/";

  /**
   * How much of a file the worker writer copies at once. Unit is in bytes.
   */
  export const CHUNK_BYTES = 4 * 1024 * 1024;

  export interface FileStat {
    /**
     * Relative path with `/` separators.
     */
    relPath: string;
    /**
     * Unit is in bytes.
     */
    size: number;
    /**
     * Unix ms.
     */
    mtimeMs: number;
  }

  export interface StorageEstimate {
    /**
     * Unit is in bytes. `null` when the browser doesn't say.
     */
    usage: number | null;
    /**
     * Unit is in bytes. `null` when the browser doesn't say.
     */
    quota: number | null;
    /**
     * Whether the browser promised not to clear this site's storage on its own.
     */
    persisted: boolean;
  }

  let _root: Promise<FileSystemDirectoryHandle> | null = null;
  let _writer: Worker | null = null;
  let _writerRequests = 0;
  const _writerCallbacks = new Map<number, (response: DeviceWriterResponse) => void>();

  /**
   * Whether this browser can store songs on the device.
   */
  export function isSupported(): boolean {
    return typeof navigator !== "undefined"
      && typeof navigator.storage?.getDirectory === "function"
      && typeof window !== "undefined" && window.isSecureContext;
  }

  /**
   * Whether the browser lets the user pick a whole folder (`showDirectoryPicker`). Chromium desktop yes; phones vary.
   */
  export function canPickFolder(): boolean {
    return typeof window !== "undefined" && typeof (window as DeviceFs.FolderPickerWindow).showDirectoryPicker === "function";
  }

  /**
   * Split and check a relative path. Rejects empty, `.` and `..` segments and backslashes, so no path can leave the
   * song folder.
   * @throws If the path isn't a plain relative path.
   */
  export function segments(relPath: string): string[] {
    const parts = relPath.split("/");
    if (relPath.includes("\\") || parts.some(part => part === "" || part === "." || part === "..")) {
      throw new Error(`"${relPath}" is not a valid path inside a song folder. Use a relative path with "/" separators.`);
    }
    return parts;
  }

  /**
   * Check a song uid before it is used as a folder name.
   * @throws If the uid has characters a song uid never has.
   */
  export function checkUid(uid: string): string {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) throw new Error(`"${uid}" is not a valid song uid for device storage.`);
    return uid;
  }

  /**
   * The `library` folder in the OPFS root.
   */
  export async function libraryDir(): Promise<FileSystemDirectoryHandle> {
    if (!isSupported()) throw new Error("This browser can't store songs on the device. Use a recent version of Chrome or Safari.");
    _root ??= navigator.storage.getDirectory()
      .then(root => root.getDirectoryHandle(LIBRARY_DIR, { create: true }))
      .catch(error => {
        _root = null;
        throw error;
      });
    return _root;
  }

  /**
   * The folder of one song.
   * @returns `null` if it doesn't exist and `create` is false.
   */
  export async function songDir(uid: string, create = false): Promise<FileSystemDirectoryHandle | null> {
    const library = await libraryDir();
    return library.getDirectoryHandle(checkUid(uid), { create }).catch(_nullIfMissing);
  }

  /**
   * Read a file of a song.
   * @returns The file (read lazily from disk), or `null` if it doesn't exist.
   */
  export async function readFile(uid: string, relPath: string): Promise<File | null> {
    const parts = segments(relPath);
    let dir = await songDir(uid);
    for (const part of parts.slice(0, -1)) {
      if (!dir) return null;
      dir = await dir.getDirectoryHandle(part).catch(_nullIfMissing);
    }
    if (!dir) return null;
    const handle = await dir.getFileHandle(parts[parts.length - 1]).catch(_nullIfMissing);
    return handle ? handle.getFile() : null;
  }

  /**
   * Create or replace a file of a song, creating the song folder and subfolders as needed.
   * Uses a writable stream where the browser has one (written to a swap file, so a failed write leaves the old file),
   * otherwise a worker with a sync access handle (Safari).
   * @throws `DeviceFs.QuotaError` when the device is out of space for this site.
   */
  export async function writeFile(uid: string, relPath: string, data: string | Uint8Array | Blob): Promise<void> {
    const parts = segments(relPath);
    let dir = await songDir(uid, true);
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : new Uint8Array(data)]);
    const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });

    try {
      if (typeof handle.createWritable === "function") {
        const writable = await handle.createWritable();
        try {
          await blob.stream().pipeTo(writable);
        } catch (error) {
          await writable.abort().catch((): void => undefined);
          throw error;
        }
      }
      else {
        await _writeInWorker([LIBRARY_DIR, uid, ...parts], blob);
      }
    } catch (error) {
      if (_isQuotaError(error)) throw new DeviceFs.QuotaError();
      throw error;
    }
  }

  /**
   * Delete a file of a song. Missing files are not an error.
   */
  export async function deleteFile(uid: string, relPath: string): Promise<void> {
    const parts = segments(relPath);
    let dir = await songDir(uid);
    for (const part of parts.slice(0, -1)) {
      if (!dir) return;
      dir = await dir.getDirectoryHandle(part).catch(_nullIfMissing);
    }
    if (!dir) return;
    await dir.removeEntry(parts[parts.length - 1]).catch(_nullIfMissing);
  }

  /**
   * Delete a song folder with everything in it. A missing folder is not an error.
   */
  export async function deleteSong(uid: string): Promise<void> {
    const library = await libraryDir();
    await library.removeEntry(checkUid(uid), { recursive: true }).catch(_nullIfMissing);
  }

  /**
   * Every file in a song folder, recursively.
   * @returns `[]` if the song folder doesn't exist.
   */
  export async function list(uid: string): Promise<FileStat[]> {
    const dir = await songDir(uid);
    if (!dir) return [];
    const result: FileStat[] = [];
    const walk = async (folder: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
      for await (const [name, handle] of folder.entries()) {
        if (handle.kind === "directory") await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
        else {
          const file = await (handle as FileSystemFileHandle).getFile();
          result.push({ relPath: prefix + name, size: file.size, mtimeMs: file.lastModified });
        }
      }
    };
    await walk(dir, "");
    return result;
  }

  /**
   * Uids of every song folder, in the order the browser lists them.
   */
  export async function listSongUids(): Promise<string[]> {
    const library = await libraryDir();
    const uids: string[] = [];
    for await (const [name, handle] of library.entries()) {
      if (handle.kind === "directory" && !name.startsWith(".")) uids.push(name);
    }
    return uids;
  }

  /**
   * Files waiting in the share inbox, oldest first, with their entry names.
   */
  export async function listInbox(): Promise<{ name: string; file: File }[]> {
    if (!isSupported()) return [];
    const root = await navigator.storage.getDirectory();
    const inbox = await root.getDirectoryHandle(INBOX_DIR).catch(_nullIfMissing);
    if (!inbox) return [];
    const entries: { name: string; file: File }[] = [];
    for await (const [name, handle] of inbox.entries()) {
      if (handle.kind === "file") entries.push({ name, file: await (handle as FileSystemFileHandle).getFile() });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  /**
   * Remove one file from the share inbox. A missing file is not an error.
   */
  export async function removeFromInbox(name: string): Promise<void> {
    const root = await navigator.storage.getDirectory();
    const inbox = await root.getDirectoryHandle(INBOX_DIR).catch(_nullIfMissing);
    await inbox?.removeEntry(name).catch(_nullIfMissing);
  }

  /**
   * How much space this site uses and may use, and whether its storage is persistent.
   */
  export async function estimate(): Promise<StorageEstimate> {
    const [estimate, persisted] = await Promise.all([
      navigator.storage?.estimate?.().catch((): StorageEstimate => null) ?? null,
      navigator.storage?.persisted?.().catch(() => false) ?? false,
    ]);
    return { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted };
  }

  /**
   * Ask the browser to keep this site's storage until the user clears it.
   * @returns Whether storage is persistent now.
   */
  export async function persist(): Promise<boolean> {
    if (await navigator.storage?.persisted?.().catch(() => false)) return true;
    return navigator.storage?.persist?.().catch(() => false) ?? false;
  }

  /**
   * Thrown by `writeFile` when the device has no room left for this site.
   */
  export class QuotaError extends Error {
    constructor() {
      super("Your device is out of space for Toxen. Free up space or remove songs from this device, then try again.");
      this.name = "QuotaError";
    }
  }

  /**
   * `window` on browsers that have the folder picker. Not in the TypeScript DOM types yet.
   */
  export interface FolderPickerWindow extends Window {
    showDirectoryPicker?(options?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }

  async function _writeInWorker(path: string[], blob: Blob): Promise<void> {
    _writer ??= _createWriter();
    const id = ++_writerRequests;
    const response = await new Promise<DeviceWriterResponse>(resolve => {
      _writerCallbacks.set(id, resolve);
      const request: DeviceWriterRequest = { id, path, blob, chunkBytes: CHUNK_BYTES };
      _writer.postMessage(request);
    });
    if (response.error) {
      const error = new Error(response.error);
      error.name = response.errorName ?? "Error";
      throw error;
    }
  }

  function _createWriter(): Worker {
    const worker = new DeviceWriterWorker();
    worker.onmessage = (event: MessageEvent<DeviceWriterResponse>) => {
      const callback = _writerCallbacks.get(event.data.id);
      _writerCallbacks.delete(event.data.id);
      callback?.(event.data);
    };
    worker.onerror = event => {
      // A crashed worker fails every pending write; the next write starts a new one
      console.error("The device storage writer stopped.", event.message);
      for (const [id, callback] of _writerCallbacks) callback({ id, error: "The device storage writer stopped. Try again." });
      _writerCallbacks.clear();
      _writer = null;
    };
    return worker;
  }

  function _isQuotaError(error: unknown): boolean {
    return error instanceof Error && error.name === "QuotaExceededError";
  }

  /**
   * `catch` handler: a missing entry becomes `null`, other errors are rethrown.
   */
  function _nullIfMissing(error: unknown): null {
    if (error instanceof Error && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
    throw error;
  }
}

export default DeviceFs;
