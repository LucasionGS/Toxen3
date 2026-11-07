import { SyncApi } from "./SyncApi";
import type { SyncV2 } from "./SyncApi";
import type { DesktopIO } from "../../../ToxenControllers/DesktopIO";

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
   * Shortest time between two progress callbacks of one transfer. Unit is in ms.
   */
  export const PROGRESS_INTERVAL_MS = 200;

  /**
   * Upload one blob, unless the server already has it for this user.
   * Retries once on `hash_mismatch` (plan §2.8), then fails.
   * @returns The server's answer, or the quota / hash failure.
   * @throws {SyncApi.HttpError} For network and server errors.
   */
  export async function uploadBlob(uid: string, path: string, entry: SyncV2.FileEntry, source: UploadSource, onProgress?: (progress: Progress) => void, signal?: AbortSignal): Promise<SyncApi.Result<SyncV2.BlobPutResponse, SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse>> {
    const report = throttle(onProgress);
    let result: SyncApi.Result<SyncV2.BlobPutResponse, SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse>;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await uploadOnce(entry, source, transferred => report({ uid, path, direction: "up", transferred, total: entry.size }), signal);
      if (result.ok === true || result.body.code !== "hash_mismatch") break;
    }
    report.flush();
    return result;
  }

  async function uploadOnce(entry: SyncV2.FileEntry, source: UploadSource, onBytes: (transferred: number) => void, signal?: AbortSignal): Promise<SyncApi.Result<SyncV2.BlobPutResponse, SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse>> {
    if (source.blob) {
      const result = await SyncApi.putBlob(entry.sha256, source.blob);
      onBytes(entry.size);
      return result;
    }
    if (!source.diskPath) throw new Error("Nothing to upload: pass `diskPath` (desktop) or `blob`.");
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Uploading a file from disk");

    let res: DesktopIO.HttpResult;
    try {
      res = await toxenapi.uploadFile({
        url: SyncApi.blobUrl(entry.sha256),
        filePath: source.diskPath,
        headers: SyncApi.getHeaders(),
        onProgress: progress => onBytes(progress.transferred),
        signal,
      });
    } catch (error) {
      throw toHttpError(error);
    }

    const body = res.body as SyncV2.ErrorResponse | SyncV2.BlobPutResponse | null;
    if (res.status >= 200 && res.status < 300) return { ok: true, value: body as SyncV2.BlobPutResponse };
    const errorBody = body && typeof (body as SyncV2.ErrorResponse).code === "string" ? body as SyncV2.ErrorResponse : null;
    if (errorBody && (errorBody.code === "quota_exceeded" || errorBody.code === "hash_mismatch")) {
      return { ok: false, status: res.status, body: errorBody as SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse };
    }
    throw new SyncApi.HttpError(errorBody?.error ?? `Uploading a file failed with ${res.status}.`, res.status, errorBody);
  }

  /**
   * Download one file of a track to `destPath` (desktop only), verifying `expectedSha256`.
   * @returns The written file's hash, size and mtime.
   * @throws {SyncApi.HttpError} For network and server errors. A hash mismatch is reported as status `409` with no
   * body, like a stale base: the file at that path changed again, so re-pull and re-plan.
   */
  export async function downloadFile(uid: string, path: string, destPath: string, expectedSha256: string, onProgress?: (progress: Progress) => void, signal?: AbortSignal): Promise<DesktopIO.FileHash> {
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Downloading a file to disk");
    const report = throttle(onProgress);
    try {
      return await toxenapi.downloadFile({
        url: SyncApi.fileUrl(uid, path),
        destPath,
        headers: SyncApi.getHeaders(),
        expectedSha256,
        onProgress: progress => report({ uid, path, direction: "down", transferred: progress.transferred, total: progress.total }),
        signal,
      });
    } catch (error) {
      throw toHttpError(error);
    } finally {
      report.flush();
    }
  }

  /**
   * A `toxenapi` transfer error as `SyncApi.HttpError`. Network errors become status `0` (transient).
   */
  function toHttpError(error: unknown): SyncApi.HttpError | Error {
    if (error instanceof SyncApi.HttpError) return error;
    const transferError = error as DesktopIO.TransferError;
    if (transferError?.name === "AbortError") return transferError;
    const body = transferError?.body && typeof (transferError.body as SyncV2.ErrorResponse).code === "string" ? transferError.body as SyncV2.ErrorResponse : null;
    if (typeof transferError?.status === "number" && transferError.status > 0) {
      return new SyncApi.HttpError(transferError.message, transferError.status, body);
    }
    if (transferError?.status === 0) {
      // Hash mismatch: the path got new content since the plan was made, which is what a stale base means
      return new SyncApi.HttpError(transferError.message, 409, null);
    }
    return new SyncApi.HttpError(`Can't reach the sync server: ${transferError?.message ?? String(error)}`, 0);
  }

  interface Throttled {
    (progress: Progress): void;
    flush(): void;
  }

  /**
   * At most one callback per `PROGRESS_INTERVAL_MS`; `flush` delivers the last pending one.
   */
  function throttle(onProgress?: (progress: Progress) => void): Throttled {
    let last = 0;
    let pending: Progress | null = null;
    const fn = ((progress: Progress) => {
      if (!onProgress) return;
      const now = Date.now();
      if (now - last >= PROGRESS_INTERVAL_MS) {
        last = now;
        pending = null;
        onProgress(progress);
      }
      else {
        pending = progress;
      }
    }) as Throttled;
    fn.flush = () => {
      if (pending && onProgress) onProgress(pending);
      pending = null;
    };
    return fn;
  }
}

export default Transfer;
