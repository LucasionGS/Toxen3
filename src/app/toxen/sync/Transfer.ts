import type { SyncApi, SyncV2 } from "./SyncApi";

/**
 * Moving bytes between this device and the server, with progress. Never buffers whole files in memory on desktop:
 * uploads stream from disk with `toxenapi.uploadFile` (Node http, `Content-Length` known; Chromium `fetch` can't stream
 * request bodies over HTTP/1.1), downloads stream to a temp file and are renamed into place by `toxenapi.downloadFile`.
 * Web uploads small in-memory blobs through `SyncApi.putBlob`.
 */
export namespace Transfer {
  export interface Progress {
    uid: string;
    path: string;
    direction: "up" | "down";
    /**
     * Unit is in bytes.
     */
    transferred: number;
    total: number;
  }

  export interface UploadSource {
    /**
     * Desktop: absolute path to stream from. Web: the bytes.
     */
    diskPath?: string;
    blob?: Blob;
  }

  /**
   * Upload one blob, unless the server already has it for this user.
   * Retries once on `hash_mismatch` (plan §2.8), then fails.
   * @returns The server's answer, or the quota / hash failure.
   * @throws {SyncApi.HttpError} For network and server errors.
   */
  export async function uploadBlob(uid: string, path: string, entry: SyncV2.FileEntry, source: UploadSource, onProgress?: (progress: Progress) => void, signal?: AbortSignal): Promise<SyncApi.Result<SyncV2.BlobPutResponse, SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse>> {
    throw new Error("Not implemented.");
  }

  /**
   * Download one file of a track to `destPath` (desktop only), verifying `expectedSha256`.
   * @throws {SyncApi.HttpError} For network and server errors, or a hash mismatch.
   */
  export async function downloadFile(uid: string, path: string, destPath: string, expectedSha256: string, onProgress?: (progress: Progress) => void, signal?: AbortSignal): Promise<void> {
    throw new Error("Not implemented.");
  }
}

export default Transfer;
