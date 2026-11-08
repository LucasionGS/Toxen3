/**
 * Writes files into the Origin Private File System with a sync access handle, for browsers without
 * `FileSystemFileHandle.createWritable()` on the main thread (Safari). The blob is copied in chunks so a large song
 * never has to fit in memory at once.
 */

export interface DeviceWriterRequest {
  id: number;
  /**
   * Folder names from the OPFS root, ending with the file name.
   */
  path: string[];
  blob: Blob;
  /**
   * Unit is in bytes.
   */
  chunkBytes: number;
}

export interface DeviceWriterResponse {
  id: number;
  /**
   * Set when the write failed.
   */
  error?: string;
  errorName?: string;
}

/**
 * The sync access handle, which the TypeScript DOM types (used by this project) leave out because it only exists in
 * workers.
 */
interface SyncAccessHandle {
  truncate(size: number): void;
  write(buffer: Uint8Array, options?: { at?: number }): number;
  flush(): void;
  close(): void;
}

type SyncFileHandle = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncAccessHandle> };

self.onmessage = async (event: MessageEvent<DeviceWriterRequest>) => {
  const { id, path, blob, chunkBytes } = event.data;
  let access: SyncAccessHandle | null = null;
  try {
    let dir = await navigator.storage.getDirectory();
    for (const part of path.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    const handle = await dir.getFileHandle(path[path.length - 1], { create: true }) as SyncFileHandle;
    access = await handle.createSyncAccessHandle();
    access.truncate(0);
    for (let offset = 0; offset < blob.size; offset += chunkBytes) {
      const chunk = new Uint8Array(await blob.slice(offset, offset + chunkBytes).arrayBuffer());
      access.write(chunk, { at: offset });
    }
    access.flush();
    respond({ id });
  } catch (error) {
    respond({ id, error: error instanceof Error ? error.message : String(error), errorName: error instanceof Error ? error.name : undefined });
  } finally {
    access?.close();
  }
};

function respond(response: DeviceWriterResponse) {
  (self as unknown as Worker).postMessage(response);
}
