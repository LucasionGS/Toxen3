/**
 * HTTP client for the sync v2 server API (`/api/v2`).
 *
 * `SyncV2` below is the wire contract. Everything between `//#region Contract` and `//#endregion` is a character for
 * character copy of the server's `server/src/types/syncV2.ts`. Change both files in the same commit.
 *
 * This file is a leaf: it imports nothing from the app, so `Merge.ts` tests and `CloudSongStorage` can use it.
 * `SyncApi.configure()` is called once at startup (SyncEngine.init on desktop, SongLibrary on web) with the server URL
 * and token getters.
 */
export namespace SyncV2 {
  //#region Contract
  /**
   * Version prefix of every v2 route, below `/api`.
   */
  export const VERSION_PREFIX = "/v2";

  /**
   * Route patterns, relative to `/api/v2`. `:path(*)` may contain `/`.
   */
  export const ROUTES = {
    CHANGES: "/sync/changes",
    BLOB: "/blobs/:sha256",
    BLOBS_MISSING: "/blobs/missing",
    TRACK_COMMIT: "/tracks/:uid/commit",
    TRACK: "/tracks/:uid",
    TRACK_FILE: "/tracks/:uid/files/:path(*)",
    MEDIA_TOKENS: "/media-tokens",
    ME: "/me",
  } as const;

  /**
   * Header carrying the sending device's id (`SyncState.deviceId`) on commits and deletes.
   * The server copies it into the socket event's `origin`, so the device can ignore its own echo.
   */
  export const HEADER_DEVICE = "X-Toxen-Device";

  /**
   * Response header of `HEAD /blobs/:sha256`, holding the blob size in bytes.
   */
  export const HEADER_BLOB_SIZE = "X-Toxen-Blob-Size";

  /**
   * Default and maximum `limit` of `GET /sync/changes`.
   */
  export const CHANGES_LIMIT_MAX = 500;

  /**
   * Maximum number of hashes in one `POST /blobs/missing` request.
   */
  export const MISSING_BLOBS_MAX = 1000;

  /**
   * Maximum number of uids in one `POST /media-tokens` request.
   */
  export const MEDIA_TOKENS_MAX = 1000;

  /**
   * Maximum length of a relative file path.
   */
  export const PATH_MAX_LENGTH = 512;

  /**
   * Paths that are never part of a file manifest. `info.json` travels as `info` instead.
   */
  export const RESERVED_PATHS = ["info.json"] as const;

  /**
   * Path prefixes that are never part of a file manifest.
   */
  export const RESERVED_PREFIXES = [".toxen/"] as const;

  /**
   * Machine-readable error codes. Clients switch on these, never on `error` text.
   */
  export enum ErrorCode {
    Unauthorized = "unauthorized",
    NotFound = "not_found",
    InvalidUid = "invalid_uid",
    InvalidPath = "invalid_path",
    InvalidRequest = "invalid_request",
    /** `baseRev` no longer matches the server. Re-pull, re-merge, retry. */
    StaleBase = "stale_base",
    /** A commit references blobs this user hasn't uploaded. Upload them, then retry. */
    MissingBlobs = "missing_blobs",
    /** The write would exceed the quota, or the account is over quota (read-only). */
    QuotaExceeded = "quota_exceeded",
    /** The uploaded bytes don't hash to the sha256 in the URL. */
    HashMismatch = "hash_mismatch",
    /** `PUT /blobs/:sha256` without a `Content-Length`. */
    LengthRequired = "length_required",
    /** 429: too many requests. Retry after the `RateLimit-Reset` / `Retry-After` delay, with backoff. */
    RateLimited = "rate_limited",
    /** 5xx: a server fault. Retry later with backoff; the request may or may not have been applied. */
    Internal = "internal",
  }

  /**
   * Storage tier. `free` is every account without an active subscription.
   */
  export type Tier = "free" | "basic" | "pro" | "ultimate";

  /**
   * Content of one file: its sha256 (lowercase hex, 64 characters) and size in bytes.
   */
  export interface FileEntry {
    sha256: string;
    size: number;
  }

  /**
   * A file as recorded in a server manifest.
   */
  export interface ManifestFileEntry extends FileEntry {
    /**
     * Server time when this path last got new content. Used for "newest wins" against the local mtime.
     */
    receivedAt: number;
  }

  /**
   * Relative path -> file content.
   */
  export type FileMap = Record<string, FileEntry>;

  /**
   * Relative path -> file content, as stored on the server.
   */
  export type ManifestFileMap = Record<string, ManifestFileEntry>;

  /**
   * Song metadata (`ISong` without `files` and `hash`). The server stores it as an opaque object
   * and only checks that `uid`, if present, matches the route.
   */
  export type SongInfo = Record<string, unknown>;

  /**
   * The server's view of one track.
   */
  export interface TrackManifest {
    uid: string;
    /**
     * Per-user revision of the last change to this track. Only ever increases.
     */
    rev: number;
    info: SongInfo;
    /**
     * Client time of the last info edit, as sent in the commit that changed `info`.
     */
    infoUpdatedAt: number;
    files: ManifestFileMap;
    /**
     * Tombstone. A deleted track has `files: {}` and keeps `info` for display in the conflict view.
     */
    deleted: boolean;
    deletedAt: number | null;
  }

  /**
   * The server's view of one playlist.
   * @experimental Playlists move onto the changelog in Phase 5. Until then the server never sends them.
   */
  export interface PlaylistManifest {
    id: string;
    rev: number;
    name: string;
    /**
     * Track uids in playlist order. May include uids that only exist on some device.
     */
    songs: string[];
    /**
     * Name of a `playlist_background` asset, or `null`.
     */
    background: string | null;
    applyBackground: boolean;
    /**
     * Track uid -> name of a `playlist_background` asset.
     */
    songBackground: Record<string, string>;
    /**
     * Display order among the user's playlists.
     */
    position: number;
    deleted: boolean;
    deletedAt: number | null;
  }

  export interface TrackChange {
    kind: "track";
    uid: string;
    rev: number;
    deleted: boolean;
    manifest: TrackManifest;
  }

  /**
   * @experimental See `PlaylistManifest`.
   */
  export interface PlaylistChange {
    kind: "playlist";
    id: string;
    rev: number;
    deleted: boolean;
    manifest: PlaylistManifest;
  }

  /**
   * One entry of the changelog. Clients must ignore entries with a `kind` they don't know.
   */
  export type Change = TrackChange | PlaylistChange;

  /**
   * `GET /sync/changes?since=<rev>&limit=<n>`
   */
  export interface ChangesQuery {
    /**
     * Return changes with `rev > since`. `0` lists everything.
     */
    since: number;
    /**
     * Default and maximum is `CHANGES_LIMIT_MAX`.
     */
    limit?: number;
  }

  /**
   * Response of `GET /sync/changes`. Changes are ordered by `rev` ascending.
   */
  export interface ChangesResponse {
    changes: Change[];
    /**
     * Pass as `since` for the next page. Equals the last change's `rev`, or the request's `since` if there were none.
     */
    nextSince: number;
    /**
     * The user's current revision.
     */
    latestRev: number;
    hasMore: boolean;
    /**
     * `true` when `since` is older than the oldest pruned tombstone. The response then lists every live item
     * (as if `since` were `0`), and anything the client has a base for but doesn't see by the last page was deleted.
     */
    fullResync: boolean;
  }

  /**
   * `POST /blobs/missing`. Batch form of `HEAD /blobs/:sha256`.
   */
  export interface MissingBlobsRequest {
    /**
     * At most `MISSING_BLOBS_MAX` hashes.
     */
    sha256: string[];
  }

  export interface MissingBlobsResponse {
    /**
     * The hashes this user has not uploaded yet, in request order.
     */
    missing: string[];
  }

  /**
   * Response of `PUT /blobs/:sha256`. The body is the raw bytes, `Content-Length` is required.
   */
  export interface BlobPutResponse {
    sha256: string;
    size: number;
    /**
     * `false` when this user already had the blob and the body was discarded.
     */
    created: boolean;
  }

  /**
   * `POST /tracks/:uid/commit`. Applied atomically, or not at all.
   */
  export interface CommitRequest {
    /**
     * The `rev` this change was merged against. `null` means "the track must not exist yet, or be a tombstone".
     */
    baseRev: number | null;
    /**
     * Full replacement of the track's info, already merged by the client. Omit to keep it.
     */
    info?: SongInfo;
    /**
     * Client time of the info edit. Required when `info` is set.
     */
    infoUpdatedAt?: number;
    /**
     * Added or changed files. Every blob must already be uploaded by this user.
     */
    files?: FileMap;
    /**
     * Removed paths. Must not overlap with `files`.
     */
    deletes?: string[];
  }

  export interface CommitResponse {
    rev: number;
    manifest: TrackManifest;
    storageUsed: number;
    storageQuota: number;
  }

  /**
   * `DELETE /tracks/:uid?baseRev=<rev>`. Without `baseRev` the delete is unconditional.
   */
  export interface DeleteTrackQuery {
    baseRev?: number;
  }

  export interface DeleteTrackResponse {
    rev: number;
    storageUsed: number;
    storageQuota: number;
  }

  /**
   * `POST /media-tokens`. Short-lived signatures for `GET /tracks/:uid/files/:path(*)`,
   * used as `?u=<userId>&exp=<exp>&sig=<sig>` where a header can't be set (`<audio src>`, CSS backgrounds).
   * `sig` covers user id, uid and `exp`, so it can't be moved to another user or track.
   */
  export interface MediaTokensRequest {
    /**
     * At most `MEDIA_TOKENS_MAX` uids.
     */
    uids: string[];
  }

  /**
   * A signature that is valid for every file of one track until `exp`.
   */
  export interface MediaToken {
    /**
     * Expiry as Unix epoch seconds.
     */
    exp: number;
    sig: string;
  }

  export interface MediaTokensResponse {
    tokens: Record<string, MediaToken>;
  }

  /**
   * Response of `GET /me`.
   */
  export interface MeResponse {
    id: number;
    name: string;
    email: string;
    roles: string[];
    tier: Tier;
    premium: boolean;
    /**
     * ISO date, or `null` for none or lifetime.
     */
    premiumExpire: string | null;
    /**
     * Bytes in use. Each distinct file content counts once per user.
     */
    storageUsed: number;
    storageQuota: number;
    /**
     * `true` when `storageUsed > storageQuota`. Uploads and size-increasing commits are refused, everything else works.
     */
    readOnly: boolean;
    latestRev: number;
  }

  /**
   * Body of every v2 error response.
   */
  export interface ErrorResponse {
    error: string;
    code: ErrorCode;
  }

  /**
   * 409 from commit or delete.
   */
  export interface StaleBaseErrorResponse extends ErrorResponse {
    code: ErrorCode.StaleBase;
    /**
     * The server's manifest now, or `null` if the track doesn't exist.
     */
    current: TrackManifest | null;
  }

  /**
   * 422 from commit.
   */
  export interface MissingBlobsErrorResponse extends ErrorResponse {
    code: ErrorCode.MissingBlobs;
    missing: string[];
  }

  /**
   * 413 from blob PUT or commit.
   */
  export interface QuotaExceededErrorResponse extends ErrorResponse {
    code: ErrorCode.QuotaExceeded;
    storageUsed: number;
    storageQuota: number;
    /**
     * Bytes the refused write would have added.
     */
    required: number;
  }

  /**
   * 400 from blob PUT.
   */
  export interface HashMismatchErrorResponse extends ErrorResponse {
    code: ErrorCode.HashMismatch;
    expected: string;
    actual: string;
  }

  /**
   * Socket.io events sent to every socket of the owning user (room `user:<id>`).
   */
  export enum SocketEvent {
    TrackChanged = "track:changed",
    PlaylistChanged = "playlist:changed",
  }

  export interface TrackChangedEvent {
    uid: string;
    rev: number;
    deleted: boolean;
    /**
     * `HEADER_DEVICE` of the request that caused the change, or `null`.
     */
    origin: string | null;
  }

  /**
   * @experimental See `PlaylistManifest`.
   */
  export interface PlaylistChangedEvent {
    id: string;
    rev: number;
    deleted: boolean;
    origin: string | null;
  }
  //#endregion
}

export namespace SyncApi {
  export interface Config {
    /**
     * Base URL of the v1 API, e.g. `Settings.getServer()` -> `https://stream.toxen.net/api`. `/v2` is appended.
     */
    getServer: () => string;
    /**
     * Current user's session token, or `null` when logged out.
     */
    getToken: () => string | null;
    /**
     * This device's id (`SyncState.deviceId`), sent as `SyncV2.HEADER_DEVICE`. `null` on web.
     */
    getDeviceId: () => string | null;
  }

  /**
   * An expected failure, returned instead of thrown (stale base, missing blobs, quota). `body` is the server's error.
   */
  export interface Failure<E extends SyncV2.ErrorResponse = SyncV2.ErrorResponse> {
    ok: false;
    status: number;
    body: E;
  }

  export interface Success<T> {
    ok: true;
    value: T;
  }

  export type Result<T, E extends SyncV2.ErrorResponse = SyncV2.ErrorResponse> = Success<T> | Failure<E>;

  export type CommitFailure = SyncV2.StaleBaseErrorResponse | SyncV2.MissingBlobsErrorResponse | SyncV2.QuotaExceededErrorResponse;

  /**
   * An unexpected failure: offline, 5xx, 401, or a response that isn't JSON. The sync engine retries these with backoff.
   */
  export class HttpError extends Error {
    /**
     * HTTP status, or `0` when the request never got a response (offline).
     */
    public readonly status: number;
    public readonly body: SyncV2.ErrorResponse | null;

    constructor(message: string, status: number, body: SyncV2.ErrorResponse | null = null) {
      super(message);
      this.name = "HttpError";
      this.status = status;
      this.body = body;
    }

    /**
     * Whether retrying later can help (offline, 5xx, 429).
     */
    public isTransient(): boolean {
      return this.status === 0 || this.status === 429 || this.status >= 500;
    }
  }

  /**
   * Set the server and token getters. Must be called before any request.
   */
  export function configure(config: Config): void {
    throw new Error("Not implemented.");
  }

  /**
   * Base URL of the v2 API (`<server>/v2`).
   */
  export function getBaseUrl(): string {
    throw new Error("Not implemented.");
  }

  /**
   * Request headers for a v2 call: `Authorization: Bearer`, `SyncV2.HEADER_DEVICE`. Used by `Transfer` for streamed uploads.
   */
  export function getHeaders(): Record<string, string> {
    throw new Error("Not implemented.");
  }

  /**
   * `GET /sync/changes`. One page.
   * @throws {HttpError}
   */
  export async function getChanges(query: SyncV2.ChangesQuery): Promise<SyncV2.ChangesResponse> {
    throw new Error("Not implemented.");
  }

  /**
   * `HEAD /blobs/:sha256`.
   * @returns The size if this user has the blob, else `null`.
   * @throws {HttpError}
   */
  export async function headBlob(sha256: string): Promise<number | null> {
    throw new Error("Not implemented.");
  }

  /**
   * `POST /blobs/missing`, split into chunks of `SyncV2.MISSING_BLOBS_MAX`.
   * @throws {HttpError}
   */
  export async function findMissingBlobs(sha256s: string[]): Promise<string[]> {
    throw new Error("Not implemented.");
  }

  /**
   * URL for `PUT /blobs/:sha256`. The upload itself goes through `Transfer` (streamed from disk on desktop).
   */
  export function blobUrl(sha256: string): string {
    throw new Error("Not implemented.");
  }

  /**
   * `PUT /blobs/:sha256` with an in-memory body (web uploads, small text files).
   * @throws {HttpError}
   */
  export async function putBlob(sha256: string, body: Blob): Promise<Result<SyncV2.BlobPutResponse, SyncV2.QuotaExceededErrorResponse | SyncV2.HashMismatchErrorResponse>> {
    throw new Error("Not implemented.");
  }

  /**
   * `POST /tracks/:uid/commit`.
   * @throws {HttpError}
   */
  export async function commit(uid: string, request: SyncV2.CommitRequest): Promise<Result<SyncV2.CommitResponse, CommitFailure>> {
    throw new Error("Not implemented.");
  }

  /**
   * `DELETE /tracks/:uid?baseRev=`.
   * @throws {HttpError}
   */
  export async function deleteTrack(uid: string, baseRev?: number): Promise<Result<SyncV2.DeleteTrackResponse, SyncV2.StaleBaseErrorResponse>> {
    throw new Error("Not implemented.");
  }

  /**
   * `GET /me`.
   * @throws {HttpError}
   */
  export async function getMe(): Promise<SyncV2.MeResponse> {
    throw new Error("Not implemented.");
  }

  /**
   * `POST /media-tokens`, split into chunks of `SyncV2.MEDIA_TOKENS_MAX`.
   * @throws {HttpError}
   */
  export async function getMediaTokens(uids: string[]): Promise<Record<string, SyncV2.MediaToken>> {
    throw new Error("Not implemented.");
  }

  /**
   * URL of `GET /tracks/:uid/files/:path(*)`, each path segment encoded. With `token` and `userId` the URL carries
   * `?u=&exp=&sig=` and works without headers (`<audio src>`, CSS).
   */
  export function fileUrl(uid: string, relPath: string, token?: SyncV2.MediaToken, userId?: number): string {
    throw new Error("Not implemented.");
  }
}

export default SyncApi;
