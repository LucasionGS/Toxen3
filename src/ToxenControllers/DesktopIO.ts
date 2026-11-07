/**
 * Types of the file and network IO methods `toxenapi` offers for storage and sync.
 * Web (`ToxenController`) throws desktop-only for all of them. `DesktopController` implements them with
 * `node:fs`, `node:crypto` and `node:http(s)` so shared code never imports those.
 */
export namespace DesktopIO {
  /**
   * Result of hashing a file.
   */
  export interface FileHash {
    /**
     * Lowercase hex.
     */
    sha256: string;
    /**
     * Unit is in bytes.
     */
    size: number;
    mtimeMs: number;
  }

  /**
   * A file found by `listFilesRecursive`.
   */
  export interface FileStat {
    /**
     * Relative to the listed directory, with `/` separators on every OS.
     */
    relPath: string;
    size: number;
    mtimeMs: number;
  }

  export interface TransferProgress {
    /**
     * Unit is in bytes.
     */
    transferred: number;
    total: number;
  }

  export interface UploadOptions {
    url: string;
    /**
     * Absolute path of the file to send. Streamed, never read into memory.
     */
    filePath: string;
    /**
     * Default is `PUT`.
     */
    method?: "PUT" | "POST";
    headers?: Record<string, string>;
    onProgress?: (progress: TransferProgress) => void;
    signal?: AbortSignal;
  }

  export interface DownloadOptions {
    url: string;
    /**
     * Final path. Bytes go to `<destPath>.toxen-part` first and are renamed into place when complete
     * (and when `expectedSha256` matches), so a killed download never leaves a half-written file.
     */
    destPath: string;
    headers?: Record<string, string>;
    expectedSha256?: string;
    onProgress?: (progress: TransferProgress) => void;
    signal?: AbortSignal;
  }

  /**
   * Response of an upload. The body is parsed as JSON when it is JSON, otherwise `null`.
   */
  export interface HttpResult {
    status: number;
    body: unknown;
  }

  /**
   * What `downloadFile` and `uploadFile` reject with. Network failures are plain Node errors with a `code`
   * (`ECONNREFUSED`, `ECONNRESET`…) and no `status`; a cancelled transfer has `name` `AbortError`.
   */
  export interface TransferError extends Error {
    /**
     * HTTP status of a non-2xx download, `0` for a hash mismatch, `undefined` for network errors.
     */
    status?: number;
    /**
     * The parsed JSON error body, or `null`.
     */
    body?: unknown;
    code?: string;
  }
}

export default DesktopIO;
