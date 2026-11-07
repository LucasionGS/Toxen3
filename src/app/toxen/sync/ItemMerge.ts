import type { SyncV2 } from "./SyncApi";

/**
 * Pure merges for the synced items next to tracks (plan Phase 5): playlists (three-way against a stored base),
 * settings and extensions (per key / per id, newest `updatedAt` wins). No I/O and no app imports, so
 * `ItemMerge.test.ts` exercises them directly.
 */
export namespace ItemMerge {
  //#region Playlists

  /**
   * One playlist as both sides and the base describe it.
   */
  export interface PlaylistVersion {
    name: string;
    songs: string[];
    background: string | null;
    applyBackground: boolean;
    songBackground: Record<string, string>;
    updatedAt: number;
  }

  export interface PlaylistMergeResult {
    merged: PlaylistVersion;
    /**
     * The merged playlist differs from the remote (commit it).
     */
    push: boolean;
    /**
     * The merged playlist differs from the local (write it).
     */
    pull: boolean;
  }

  /**
   * Merge a playlist's song list:
   * - A song removed on either side (present in the base, missing on that side) is removed.
   * - A song added on either side is added.
   * - Order: the local order, unless only the remote reordered since the base. Songs added on the other side are
   *   inserted after the song they follow there (or at the end), so both sides' additions keep their place.
   * `base` `null` = first merge: nothing is removed, everything is kept.
   */
  export function mergeSongList(base: string[] | null, local: string[], remote: string[]): string[] {
    const baseSet = new Set(base ?? []);
    const localSet = new Set(local);
    const remoteSet = new Set(remote);
    const removed = new Set<string>();
    if (base) {
      for (const uid of base) {
        if (!localSet.has(uid) || !remoteSet.has(uid)) removed.add(uid);
      }
    }

    const localReordered = base === null || !sameOrder(base, local);
    const remoteReordered = base !== null && !sameOrder(base, remote);
    const [primary, secondary] = !localReordered && remoteReordered ? [remote, local] : [local, remote];

    const result = unique(primary).filter(uid => !removed.has(uid));
    const inResult = new Set(result);
    const secondarySet = new Set(secondary);
    let previous: string | null = null;
    for (const uid of unique(secondary)) {
      if (removed.has(uid)) continue;
      if (!inResult.has(uid)) {
        if (baseSet.has(uid)) continue; // In the base but not on the primary side: removed there
        // After the song it follows on its side, and after songs the primary side added there
        let at = previous === null ? 0 : result.indexOf(previous) + 1;
        while (at > 0 && at < result.length && !baseSet.has(result[at]) && !secondarySet.has(result[at])) at++;
        result.splice(at, 0, uid);
        inResult.add(uid);
      }
      previous = uid;
    }
    return result;
  }

  /**
   * Three-way merge of one playlist. Songs as in `mergeSongList`; `name`, `background` and `applyBackground` per
   * field (one side changed -> that side, both -> newer `updatedAt`, ties -> local); `songBackground` per song the same
   * way. `base` `null` = first merge: differing fields go to the newer side.
   */
  export function mergePlaylist(base: PlaylistVersion | null, local: PlaylistVersion, remote: PlaylistVersion): PlaylistMergeResult {
    const localNewer = local.updatedAt >= remote.updatedAt;
    const pick = <T>(b: T | undefined, l: T, r: T): T => {
      if (base) {
        if (sameJson(b, l)) return r;
        if (sameJson(b, r)) return l;
      }
      return localNewer ? l : r;
    };

    const songBackground: Record<string, string> = {};
    const keys = new Set([...Object.keys(local.songBackground), ...Object.keys(remote.songBackground), ...Object.keys(base?.songBackground ?? {})]);
    for (const key of keys) {
      const value = pick(own(base?.songBackground, key), own(local.songBackground, key), own(remote.songBackground, key));
      if (value !== undefined) songBackground[key] = value;
    }

    const merged: PlaylistVersion = {
      name: pick(base?.name, local.name, remote.name),
      songs: mergeSongList(base ? base.songs : null, local.songs, remote.songs),
      background: pick(base?.background, local.background, remote.background),
      applyBackground: pick(base?.applyBackground, local.applyBackground, remote.applyBackground),
      songBackground,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    };
    const content = (version: PlaylistVersion) => ({ ...version, updatedAt: 0 });
    return {
      merged,
      push: !sameJson(content(merged), content(remote)),
      pull: !sameJson(content(merged), content(local)),
    };
  }

  /**
   * Whether a side's content (everything but `updatedAt`) differs from the base.
   */
  export function playlistChanged(base: PlaylistVersion, version: PlaylistVersion): boolean {
    return !sameJson({ ...base, updatedAt: 0 }, { ...version, updatedAt: 0 });
  }

  //#endregion

  //#region Settings

  export interface SettingsPlan {
    /**
     * Keys to apply locally, with the remote value and time.
     */
    pull: Record<string, SyncV2.SettingEntry>;
    /**
     * Keys to commit.
     */
    push: Record<string, SyncV2.SettingEntry>;
    /**
     * Keys whose value already matches, but whose local time should move up to the remote one.
     */
    adopt: Record<string, number>;
  }

  /**
   * Per key, newest `updatedAt` wins. A key this device never tracked counts as `0`, so a device joining an account
   * takes the account's values. A key the server doesn't have is pushed (with at least `1`, so any tracked value from
   * another device still wins later): that's how the first device uploads its settings.
   * @param local Key -> local value (`undefined` = not set here).
   * @param localUpdatedAt Key -> when this device last changed it.
   */
  export function planSettings(keys: readonly string[], local: Record<string, unknown>, localUpdatedAt: Record<string, number>, remote: Record<string, SyncV2.SettingEntry>): SettingsPlan {
    const plan: SettingsPlan = { pull: {}, push: {}, adopt: {} };
    for (const key of keys) {
      const value = own(local, key);
      const localTime = own(localUpdatedAt, key) ?? 0;
      const entry = own(remote, key);
      if (!entry) {
        if (value !== undefined) plan.push[key] = { value, updatedAt: Math.max(1, localTime) };
        continue;
      }
      if (sameJson(value, entry.value)) {
        if (entry.updatedAt > localTime) plan.adopt[key] = entry.updatedAt;
        continue;
      }
      if (entry.updatedAt > localTime) plan.pull[key] = entry;
      else if (value !== undefined) plan.push[key] = { value, updatedAt: localTime };
    }
    return plan;
  }

  //#endregion

  //#region Extensions

  export interface ExtensionsPlan {
    /**
     * Remote entries newer than this device's: install, uninstall or change the enabled state here.
     */
    apply: SyncV2.ExtensionEntry[];
    /**
     * Local entries newer than the account's (or missing there): commit them.
     */
    push: SyncV2.ExtensionEntry[];
  }

  /**
   * Per extension id, newest `updatedAt` wins. Only a `removed` entry that is newer than the local install removes a
   * local extension; an extension only this device has is pushed, never removed.
   */
  export function planExtensions(local: SyncV2.ExtensionEntry[], remote: SyncV2.ExtensionEntry[]): ExtensionsPlan {
    const plan: ExtensionsPlan = { apply: [], push: [] };
    const localById = new Map(local.map(entry => [entry.id, entry]));
    const remoteById = new Map(remote.map(entry => [entry.id, entry]));
    for (const id of [...new Set([...localById.keys(), ...remoteById.keys()])].sort()) {
      const l = localById.get(id);
      const r = remoteById.get(id);
      if (r && (!l || r.updatedAt > l.updatedAt)) {
        if (!l && r.removed) continue; // Uninstalled elsewhere and not here: nothing to do
        if (!l || !sameEntry(l, r)) plan.apply.push(r);
      }
      else if (l && (!r || l.updatedAt > r.updatedAt) && (!r || !sameEntry(l, r))) {
        plan.push.push(l);
      }
    }
    return plan;
  }

  function sameEntry(a: SyncV2.ExtensionEntry, b: SyncV2.ExtensionEntry): boolean {
    return a.version === b.version && a.enabled === b.enabled && a.removed === b.removed;
  }

  //#endregion

  //#region Helpers

  function own<T>(record: Record<string, T> | undefined, key: string): T | undefined {
    return record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
  }

  function unique(items: string[]): string[] {
    return [...new Set(items)];
  }

  /**
   * Whether the songs both lists have keep their relative order.
   */
  function sameOrder(a: string[], b: string[]): boolean {
    const inB = new Set(b);
    const inA = new Set(a);
    const commonA = a.filter(uid => inB.has(uid));
    const commonB = b.filter(uid => inA.has(uid));
    return commonA.every((uid, i) => uid === commonB[i]);
  }

  /**
   * Structural equality of JSON values (key order ignored, `undefined` values dropped).
   */
  export function sameJson(a: unknown, b: unknown): boolean {
    return canonical(a) === canonical(b);
  }

  export function canonical(value: unknown): string {
    return JSON.stringify(value, (_key, v: unknown) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return v;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) sorted[key] = (v as Record<string, unknown>)[key];
      return sorted;
    }) ?? "undefined";
  }

  //#endregion
}

export default ItemMerge;
