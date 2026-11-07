import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type Song from "../../toxen/Song";
import Settings from "../../toxen/Settings";
import type { SongStorage } from "../../toxen/storage/SongStorage";
import SyncEngine from "../../toxen/sync/SyncEngine";
import type { Merge } from "../../toxen/sync/Merge";

//#region Song location

/**
 * Which copies of a song exist. A song that isn't in the library (no `location` yet) has none.
 */
export function getSongLocation(song: Song): SongStorage.Location {
  return song.location ?? { local: false, cloud: false };
}

//#endregion

//#region Per-song status

function makeStatus(status: SyncEngine.Status): SyncEngine.SongStatus {
  return { status, progress: null, error: null, conflicts: 0 };
}

/**
 * Stable status objects for when the engine can't answer (not started, logged out), derived from the song location.
 */
const FALLBACKS: Record<"local" | "cloud" | "both", SyncEngine.SongStatus> = {
  local: makeStatus(SyncEngine.Status.LocalOnly),
  cloud: makeStatus(SyncEngine.Status.CloudOnly),
  both: makeStatus(SyncEngine.Status.Synced),
};

/**
 * How long to leave the engine alone after it threw. Unit is in ms.
 */
const ENGINE_RETRY_MS = 3000;

/**
 * One engine listener for every song row. Rows subscribe by uid, so a status change re-renders only that row, and the
 * event emitter never sees a listener per row.
 */
class SongStatusStore {
  private _cache = new Map<string, SyncEngine.SongStatus>();
  private _listeners = new Map<string, Set<() => void>>();
  private _attached = false;
  private _lastState: string | null = null;
  private _engineDownUntil = 0;

  public subscribe(uid: string, listener: () => void): () => void {
    this._attach();
    let set = this._listeners.get(uid);
    if (!set) this._listeners.set(uid, set = new Set());
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this._listeners.delete(uid);
    };
  }

  public get(song: Song): SyncEngine.SongStatus {
    const cached = this._cache.get(song.uid);
    if (cached) return cached;
    if (Date.now() >= this._engineDownUntil) {
      try {
        const status = SyncEngine.getSongStatus(song.uid);
        this._cache.set(song.uid, status);
        return status;
      } catch {
        this._engineDownUntil = Date.now() + ENGINE_RETRY_MS;
      }
    }
    const location = getSongLocation(song);
    return location.local && location.cloud ? FALLBACKS.both : (location.cloud ? FALLBACKS.cloud : FALLBACKS.local);
  }

  private _attach() {
    if (this._attached) return;
    this._attached = true;
    SyncEngine.events.on("status", (uid, status) => {
      this._cache.set(uid, status);
      this._listeners.get(uid)?.forEach(listener => listener());
    });
    SyncEngine.events.on("summary", summary => {
      // The engine started, stopped or went offline: every cached answer may be stale
      if (summary.state === this._lastState) return;
      this._lastState = summary.state;
      this._engineDownUntil = 0;
      this._cache.clear();
      this._listeners.forEach(set => set.forEach(listener => listener()));
    });
  }
}

const statusStore = new SongStatusStore();

/**
 * The sync status of one song, re-rendering only when that song's status changes.
 */
export function useSongSyncStatus(song: Song): SyncEngine.SongStatus {
  const subscribe = useCallback((listener: () => void) => statusStore.subscribe(song.uid, listener), [song.uid]);
  return useSyncExternalStore(subscribe, () => statusStore.get(song));
}

//#endregion

//#region Engine-wide state

/**
 * How many things in a record the user can review.
 */
export function countConflictItems(record: Merge.ConflictRecord): number {
  return record.items.reduce((total, item) => total + (item.type === "info" ? item.fields.length : 1), 0);
}

const EMPTY_SUMMARY: SyncEngine.Summary = {
  state: "disabled",
  disabledReason: null,
  autoSync: false,
  pending: 0,
  lastSyncAt: null,
  storageUsed: null,
  storageQuota: null,
  tier: null,
  readOnly: false,
  uploadsBlockedReason: null,
  deletesBlocked: 0,
  conflicts: 0,
  errors: 0,
};

function readSummary(): SyncEngine.Summary {
  try {
    return SyncEngine.getSummary();
  } catch {
    return EMPTY_SUMMARY;
  }
}

/**
 * The engine summary for Settings > Sync, kept up to date from the `summary` event.
 */
export function useSyncSummary(): SyncEngine.Summary {
  const [summary, setSummary] = useState<SyncEngine.Summary>(readSummary);
  useEffect(() => {
    setSummary(readSummary());
    const onSummary = (next: SyncEngine.Summary) => setSummary(next);
    SyncEngine.events.on("summary", onSummary);
    return () => { SyncEngine.events.off("summary", onSummary); };
  }, []);
  return summary;
}

function readConflicts(uid?: string): Merge.ConflictRecord[] {
  try {
    return SyncEngine.getConflicts(uid);
  } catch {
    return [];
  }
}

/**
 * Open conflicts, optionally of one song. Refreshes whenever the engine's list of open conflicts changes.
 */
export function useSyncConflicts(uid?: string): Merge.ConflictRecord[] {
  const [records, setRecords] = useState<Merge.ConflictRecord[]>(() => readConflicts(uid));
  useEffect(() => {
    const refresh = () => setRecords(readConflicts(uid));
    refresh();
    SyncEngine.events.on("conflicts", refresh);
    return () => { SyncEngine.events.off("conflicts", refresh); };
  }, [uid]);
  return records;
}

//#endregion

//#region Settings

/**
 * The saved auto-sync preference (on unless the user turned it off). The running engine reports its own state in
 * `Summary.autoSync`; change it with `SyncEngine.setAutoSync`.
 */
export function getAutoSyncSetting(): boolean {
  return Settings.get("autoSync") !== false;
}

/**
 * This machine's "download new cloud songs automatically" preference. `false` when the engine can't answer.
 */
export function readAutoDownload(): boolean {
  try {
    return SyncEngine.getAutoDownload();
  } catch {
    return false;
  }
}

//#endregion
