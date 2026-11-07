import { Toxen } from "../ToxenApp";
import Settings from "./Settings";
import User from "./User";
import Playlist from "./Playlist";
import Theme from "./Theme";
import ExtensionManager from "./extensions/ExtensionManager";
import { SongLibrary } from "./SongLibrary";
import { SyncEngine } from "./sync/SyncEngine";
import { SyncState } from "./sync/SyncState";
import { SyncApi, SyncV2 } from "./sync/SyncApi";
import { ItemMerge } from "./sync/ItemMerge";
import { Transfer } from "./sync/Transfer";

type ItemKind = "playlists" | "settings" | "themes" | "extensions";

/**
 * The plan was made against a rev that is no longer current: the newer manifest is stored, plan again.
 */
class StaleItemError extends Error {
  constructor() {
    super("The item changed on the server while it was syncing.");
    this.name = "StaleItemError";
  }
}

/**
 * `GET /assets/playlist_background`, fetched once per playlist run when a playlist needs it.
 */
class AssetCache {
  private _assets: Promise<Map<string, SyncV2.AssetEntry>> | null = null;

  public get(): Promise<Map<string, SyncV2.AssetEntry>> {
    this._assets ??= SyncApi.listAssets("playlist_background").then(list => new Map(list.map(asset => [asset.name, asset])));
    return this._assets;
  }
}

/**
 * Syncs everything on the changelog next to tracks (sync v2, Phase 5), as `SyncEngine`'s item handler:
 * - Playlists: per playlist, three-way against the base in `sync.json` (`ItemMerge.mergePlaylist`); `playlists.json`
 *   stays the local copy, backgrounds travel as `playlist_background` assets. Desktop and web.
 * - Settings: the keys in `SyncV2.SYNCED_SETTINGS`, per key, newest `updatedAt` wins; incoming values apply live.
 * - Themes: whole theme, images as blobs; the newer side wins when both changed.
 * - Extensions: the install list per extension id, newest wins; installs missing ones from the store (desktop).
 * Settings, themes and extensions only sync while this device's `syncSettings` is on.
 *
 * App layer (it touches `Toxen`, playlists, themes and extensions), so it registers itself with the engine instead of
 * the engine importing it. Runs are serialised; local changes are pushed `DEBOUNCE_MS` after they settle.
 */
export class SyncedItems {
  private constructor() { }

  /**
   * Wait after the last local change before pushing it. Unit is in ms.
   */
  public static readonly DEBOUNCE_MS = 2000;

  /**
   * Re-plans after a stale base before giving up until the next run.
   */
  public static readonly MAX_ATTEMPTS = 3;

  private static _timers = new Map<ItemKind, ReturnType<typeof setTimeout>>();
  private static _chain: Promise<void> = Promise.resolve();
  /**
   * `true` while sync writes what it pulled, so the change hooks don't push it straight back.
   */
  private static _applying = false;
  private static _installed = false;

  /**
   * Register with the engine and hook the local change points. Called once at startup.
   */
  public static install(): void {
    if (SyncedItems._installed) return;
    SyncedItems._installed = true;
    SyncEngine.setItemHandler({
      store: (changes, fullResync) => SyncedItems._store(changes, fullResync ?? false),
      syncAll: () => SyncedItems._run(["playlists", "themes", "settings", "extensions"]),
      stop: () => {
        for (const timer of SyncedItems._timers.values()) clearTimeout(timer);
        SyncedItems._timers.clear();
      },
    });
    Playlist.onSaved = () => SyncedItems._schedule("playlists");
    Settings.onSyncedChange = () => SyncedItems._schedule("settings");
    Theme.onSaved = () => SyncedItems._schedule("themes");
    ExtensionManager.onChange = () => SyncedItems._schedule("extensions");
  }

  //#region Queue

  private static _schedule(kind: ItemKind): void {
    if (SyncedItems._applying || !User.getCurrentUser()) return;
    const previous = SyncedItems._timers.get(kind);
    if (previous) clearTimeout(previous);
    SyncedItems._timers.set(kind, setTimeout(() => {
      SyncedItems._timers.delete(kind);
      SyncedItems._run([kind]).catch(error => SyncedItems._report(kind, error));
    }, SyncedItems.DEBOUNCE_MS));
  }

  /**
   * Run kinds one after another, after every earlier run. Settings run after themes, so a synced theme choice finds
   * its theme.
   */
  private static _run(kinds: ItemKind[]): Promise<void> {
    const run = SyncedItems._chain.catch(() => { }).then(async () => {
      if (!SyncEngine.canSyncItems() || !User.getCurrentUser()) return;
      SyncedItems._resetItemsForAccount();
      const failures: unknown[] = [];
      for (const kind of kinds) {
        if (kind !== "playlists" && !SyncState.machine.syncSettings) continue;
        try {
          if (kind === "playlists") await SyncedItems._syncPlaylists();
          else if (kind === "settings") await SyncedItems._syncSettings();
          else if (kind === "themes") await SyncedItems._syncThemes();
          else await SyncedItems._syncExtensions();
        } catch (error) {
          SyncedItems._report(kind, error);
          failures.push(error);
        }
      }
      SyncState.save();
      await SyncState.saveMachine();
      if (failures.length > 0) throw failures[0];
    });
    SyncedItems._chain = run.catch(() => { });
    return run;
  }

  private static _report(kind: ItemKind, error: unknown): void {
    if (error instanceof SyncApi.HttpError && error.status === 0) return; // Offline: the next run catches up
    console.error(`Syncing ${kind} failed.`, error);
  }

  /**
   * The machine's item state belongs to one account; start over for another one.
   */
  private static _resetItemsForAccount(): void {
    const user = User.getCurrentUser();
    const items = SyncState.machine.items;
    const server = Settings.getServer();
    if (items.userId === (user?.id ?? null) && items.server === server) return;
    SyncState.machine.items = SyncState.emptyItems(user?.id ?? null, server);
  }

  //#endregion

  //#region Store

  private static _store(changes: SyncV2.Change[], fullResync: boolean): void {
    SyncedItems._resetItemsForAccount();
    const items = SyncState.machine.items;
    const seenPlaylists = new Set<string>();
    const seenThemes = new Set<string>();
    for (const change of changes) {
      switch (change.kind) {
        case "playlist": {
          seenPlaylists.add(change.id);
          const state = SyncState.data.playlists[change.id] ??= { base: null, baseRev: null, remote: null };
          if (!state.remote || state.remote.rev <= change.manifest.rev) state.remote = change.manifest;
          break;
        }
        case "settings":
          if (!items.settings || items.settings.rev <= change.manifest.rev) items.settings = change.manifest;
          break;
        case "theme": {
          seenThemes.add(change.id);
          const state = items.themes[change.id] ??= { remote: null, baseRev: null, baseHash: null };
          if (!state.remote || state.remote.rev <= change.manifest.rev) state.remote = change.manifest;
          break;
        }
        case "extensions":
          if (!items.extensions || items.extensions.rev <= change.manifest.rev) items.extensions = change.manifest;
          break;
        default:
          break; // A kind this client doesn't know
      }
    }
    if (fullResync) {
      // Live items the complete listing didn't mention were deleted (and their tombstones pruned)
      for (const [id, state] of Object.entries(SyncState.data.playlists)) {
        if (state.remote && !state.remote.deleted && !seenPlaylists.has(id)) state.remote = { ...state.remote, deleted: true, deletedAt: Date.now() };
      }
      for (const [id, state] of Object.entries(items.themes)) {
        if (state.remote && !state.remote.deleted && !seenThemes.has(id)) state.remote = { ...state.remote, files: {}, deleted: true, deletedAt: Date.now() };
      }
    }
    SyncState.save();
    SyncState.saveMachine().catch(error => console.error("Unable to save this machine's sync settings.", error));
  }

  //#endregion

  //#region Playlists

  private static async _syncPlaylists(): Promise<void> {
    if (Playlist.isLoading || !Array.isArray(Toxen.playlists)) return;
    // A failed or partial load must never read as "the user deleted or emptied these playlists"
    const trustLocal = !Playlist.remoteLoadFailed && !Playlist.localLoadFailed;
    const libraryIncomplete = SongLibrary.lastLoadIncomplete || (Toxen.songList?.length ?? 0) === 0;
    const states = SyncState.data.playlists;
    const ids = new Set([...Toxen.playlists.map(pl => pl.id), ...Object.keys(states)]);
    const assets = new AssetCache();
    let localChanged = false;

    for (const id of ids) {
      for (let attempt = 0; attempt < SyncedItems.MAX_ATTEMPTS; attempt++) {
        try {
          if (await SyncedItems._syncPlaylist(id, trustLocal, libraryIncomplete, assets)) localChanged = true;
          break;
        } catch (error) {
          if (!(error instanceof StaleItemError)) throw error;
        }
      }
    }

    if (localChanged) {
      Toxen.playlists.sort((a, b) => a.name.localeCompare(b.name));
      if (Toxen.playlist && !Toxen.playlists.includes(Toxen.playlist)) Toxen.playlist = null;
      SyncedItems._applying = true;
      try {
        await Playlist.saveLocal();
      } finally {
        SyncedItems._applying = false;
      }
      Toxen.playlistPanel?.update();
      Toxen.songPanel?.update();
    }
  }

  /**
   * Sync one playlist (the cases in `ItemMerge`'s docs).
   * @returns Whether the local playlists changed.
   */
  private static async _syncPlaylist(id: string, trustLocal: boolean, libraryIncomplete: boolean, assets: AssetCache): Promise<boolean> {
    const state = SyncState.data.playlists[id] ??= { base: null, baseRev: null, remote: null };
    const playlist = Toxen.playlists.find(pl => pl.id === id) ?? null;
    const local = playlist?.toSyncVersion() ?? null;
    const remoteManifest = state.remote && !state.remote.deleted ? state.remote : null;
    const remote = remoteManifest ? SyncedItems._playlistVersion(remoteManifest) : null;
    const base = state.base;

    // An emptied playlist while the library is incomplete is a loading problem, not an edit
    if (local && local.songs.length === 0 && (base?.songs.length ?? remote?.songs.length ?? 0) > 0 && (libraryIncomplete || !trustLocal)) return false;

    if (local && !remote) {
      if (base && state.remote?.deleted && !ItemMerge.playlistChanged(base, local)) {
        SyncedItems._removeLocalPlaylist(playlist);
        delete SyncState.data.playlists[id];
        return true;
      }
      // New here, or edited here after another device deleted it (the edit wins)
      await SyncedItems._pushPlaylist(id, local, state.remote && !state.remote.deleted ? state.remote.rev : null, assets);
      return false;
    }

    if (!local && remote) {
      if (base && trustLocal && state.baseRev === remoteManifest.rev) {
        // Deleted here, unchanged there
        const result = await SyncApi.deletePlaylist(id, remoteManifest.rev);
        if (result.ok === false) {
          if (result.body.current) state.remote = result.body.current;
          throw new StaleItemError();
        }
        delete SyncState.data.playlists[id];
        return false;
      }
      // New there, changed there after it was deleted here (the change wins), or lost by a failed local load
      await SyncedItems._pullPlaylistAssets(remote, assets);
      Toxen.playlists.push(Playlist.fromSyncVersion(id, remote));
      SyncedItems._storePlaylistBase(state, remote, remoteManifest.rev);
      return true;
    }

    if (!local && !remote) {
      delete SyncState.data.playlists[id];
      return false;
    }

    const result = ItemMerge.mergePlaylist(base, local, remote);
    let rev = remoteManifest.rev;
    if (result.push) rev = await SyncedItems._pushPlaylist(id, result.merged, remoteManifest.rev, assets);
    if (result.pull) {
      await SyncedItems._pullPlaylistAssets(result.merged, assets);
      playlist.applySyncVersion(result.merged);
    }
    SyncedItems._storePlaylistBase(state, result.merged, rev);
    return result.pull;
  }

  private static async _pushPlaylist(id: string, version: ItemMerge.PlaylistVersion, baseRev: number | null, assets: AssetCache): Promise<number> {
    await SyncedItems._pushPlaylistAssets(version, assets);
    const position = Math.max(0, Toxen.playlists.findIndex(pl => pl.id === id));
    const request: SyncV2.PlaylistCommitRequest = {
      baseRev,
      name: version.name,
      songs: version.songs.filter(uid => uid),
      background: version.background,
      applyBackground: version.applyBackground,
      songBackground: version.songBackground,
      position,
      updatedAt: version.updatedAt || Date.now(),
    };
    const state = SyncState.data.playlists[id] ??= { base: null, baseRev: null, remote: null };
    const result = await SyncApi.commitPlaylist(id, request);
    if (result.ok === false) {
      state.remote = result.body.current ?? (state.remote ? { ...state.remote, deleted: true } : null);
      throw new StaleItemError();
    }
    state.remote = result.value.manifest;
    SyncedItems._storePlaylistBase(state, version, result.value.rev);
    return result.value.rev;
  }

  private static _storePlaylistBase(state: SyncState.PlaylistState, version: ItemMerge.PlaylistVersion, rev: number): void {
    state.base = { ...version, songs: [...version.songs], songBackground: { ...version.songBackground } };
    state.baseRev = rev;
    SyncState.save();
  }

  private static _removeLocalPlaylist(playlist: Playlist): void {
    Toxen.playlists = Toxen.playlists.filter(pl => pl !== playlist);
  }

  private static _playlistVersion(manifest: SyncV2.PlaylistManifest): ItemMerge.PlaylistVersion {
    return {
      name: manifest.name,
      songs: [...manifest.songs],
      background: manifest.background,
      applyBackground: manifest.applyBackground,
      songBackground: { ...manifest.songBackground },
      updatedAt: manifest.updatedAt,
    };
  }

  /**
   * Background file names a playlist references.
   */
  private static _backgroundNames(version: ItemMerge.PlaylistVersion): string[] {
    return [...new Set([version.background, ...Object.values(version.songBackground)].filter((name): name is string => Boolean(name)))];
  }

  /**
   * Upload the playlist's background files the server doesn't have under that name and content (desktop).
   */
  private static async _pushPlaylistAssets(version: ItemMerge.PlaylistVersion, assets: AssetCache): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const names = SyncedItems._backgroundNames(version);
    if (names.length === 0) return;
    const remote = await assets.get();
    const dir = Playlist.getLocalPlaylistBackgroundsDir();
    for (const name of names) {
      const filePath = api.path.join(dir, name);
      const hash = await api.hashFile(filePath).catch((): null => null);
      if (!hash || remote.get(name)?.sha256 === hash.sha256) continue;
      if ((await SyncApi.findMissingBlobs([hash.sha256])).length > 0) {
        const upload = await Transfer.uploadBlob("playlists", name, { sha256: hash.sha256, size: hash.size }, { diskPath: filePath });
        if (upload.ok === false) throw new Error(upload.body.error);
      }
      const put = await SyncApi.putAsset("playlist_background", name, hash.sha256);
      if (put.ok === false) throw new Error(put.body.error);
      remote.set(name, put.value.asset);
    }
  }

  /**
   * Download background files the playlist references that aren't here, or differ (desktop).
   */
  private static async _pullPlaylistAssets(version: ItemMerge.PlaylistVersion, assets: AssetCache): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const names = SyncedItems._backgroundNames(version);
    if (names.length === 0) return;
    const remote = await assets.get();
    const dir = Playlist.getLocalPlaylistBackgroundsDir(true);
    for (const name of names) {
      const entry = remote.get(name);
      if (!entry) continue;
      const filePath = api.path.join(dir, name);
      const hash = await api.hashFile(filePath).catch((): null => null);
      if (hash?.sha256 === entry.sha256) continue;
      await api.downloadFile({ url: SyncApi.assetUrl("playlist_background", name), destPath: filePath, headers: SyncApi.getHeaders(), expectedSha256: entry.sha256 });
    }
  }

  //#endregion

  //#region Settings

  private static async _syncSettings(): Promise<void> {
    const items = SyncState.machine.items;
    const data = Settings.data as unknown as Record<string, unknown>;
    for (let attempt = 0; attempt < SyncedItems.MAX_ATTEMPTS; attempt++) {
      const remote = items.settings;
      const times = Settings.data.settingsUpdatedAt ??= {};
      const plan = ItemMerge.planSettings(SyncV2.SYNCED_SETTINGS, data, times, remote?.values ?? {});

      for (const [key, updatedAt] of Object.entries(plan.adopt)) times[key] = updatedAt;
      if (Object.keys(plan.pull).length > 0) await Settings.applyFromSync(plan.pull);

      // A value over the server's cap would refuse the whole patch: keep it local
      const push = Object.fromEntries(Object.entries(plan.push).filter(([, entry]) => new TextEncoder().encode(JSON.stringify(entry.value) ?? "").length <= SyncV2.SETTING_VALUE_MAX_BYTES));
      if (Object.keys(push).length === 0) {
        if (Object.keys(plan.adopt).length > 0) await Settings.save({ suppressNotification: true });
        return;
      }

      const result = await SyncApi.commitSettings({ baseRev: remote?.rev || null, values: push });
      if (result.ok === true) {
        items.settings = result.value.manifest;
        for (const [key, entry] of Object.entries(push)) times[key] = entry.updatedAt;
        await Settings.save({ suppressNotification: true });
        return;
      }
      const failure = result.body as SyncV2.StaleBaseErrorResponse<SyncV2.SettingsManifest>;
      if (failure.code !== SyncV2.ErrorCode.StaleBase) throw new Error(failure.error);
      if (failure.current) items.settings = failure.current;
    }
  }

  //#endregion

  //#region Themes

  /**
   * Theme fields that name image files.
   */
  private static readonly THEME_IMAGE_FIELDS = ["backgroundImage", "sidepanelImage"] as const;

  private static async _syncThemes(): Promise<void> {
    const items = SyncState.machine.items;
    const localThemes = new Map((Toxen.themes ?? []).map(theme => [theme.name, theme]));
    let changed = false;
    for (const id of new Set([...localThemes.keys(), ...Object.keys(items.themes)])) {
      if (!SyncedItems._isValidThemeId(id)) continue;
      for (let attempt = 0; attempt < SyncedItems.MAX_ATTEMPTS; attempt++) {
        try {
          if (await SyncedItems._syncTheme(id, localThemes.get(id) ?? null)) changed = true;
          break;
        } catch (error) {
          if (!(error instanceof StaleItemError)) throw error;
        }
      }
    }
    if (!changed) return;
    Toxen.themes = await Theme.load();
    // The selected theme may be one that just arrived, or one that just changed
    const selected = Settings.get("theme");
    if (selected) Toxen.setThemeByName(selected);
  }

  /**
   * @returns Whether a local theme was written.
   */
  private static async _syncTheme(id: string, theme: Theme | null): Promise<boolean> {
    const items = SyncState.machine.items;
    const state = items.themes[id] ??= { remote: null, baseRev: null, baseHash: null };
    const remote = state.remote && !state.remote.deleted ? state.remote : null;
    const local = theme ? await SyncedItems._readTheme(theme) : null;
    const localChanged = local !== null && local.hash !== state.baseHash;
    const remoteChanged = remote !== null && remote.rev !== state.baseRev;

    if (local && (!remote || (localChanged && (!remoteChanged || local.updatedAt >= remote.updatedAt)))) {
      if (!localChanged && state.remote?.deleted) return false; // Deleted elsewhere, untouched here: keep it, but don't revive it
      await SyncedItems._pushTheme(id, local, state);
      return false;
    }
    if (remote && (!local || remoteChanged)) {
      await SyncedItems._writeTheme(remote);
      const written = (await Theme.load()).find(t => t.name === id);
      state.baseRev = remote.rev;
      state.baseHash = written ? (await SyncedItems._readTheme(written)).hash : null;
      return true;
    }
    return false;
  }

  private static _isValidThemeId(id: string): boolean {
    return Boolean(id) && id.length <= SyncV2.THEME_ID_MAX_LENGTH && !/[/\\\0]/.test(id) && id !== "." && id !== ".." && !["__proto__", "constructor", "prototype"].includes(id);
  }

  /**
   * A local theme as the server keeps it: `data` with image fields naming files, and the files' bytes and hashes.
   */
  private static async _readTheme(theme: Theme): Promise<{ data: SyncV2.ThemeData; files: Record<string, { sha256: string; size: number; diskPath?: string; blob?: Blob }>; hash: string; updatedAt: number }> {
    const data: SyncV2.ThemeData = {
      displayName: theme.displayName ?? null,
      description: theme.description ?? null,
      styles: theme.styles ?? {},
      customCSS: theme.customCSS ?? null,
    };
    const files: Record<string, { sha256: string; size: number; diskPath?: string; blob?: Blob }> = {};
    let updatedAt = 0;
    for (const field of SyncedItems.THEME_IMAGE_FIELDS) {
      const value = theme[field];
      if (!value) {
        data[field] = null;
        continue;
      }
      if (value.startsWith("data:")) {
        const blob = await (await fetch(value)).blob();
        const ext = (blob.type.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "") || "png";
        const name = `${field === "backgroundImage" ? "background" : "sidepanel"}.${ext}`;
        files[name] = { sha256: await SyncedItems._sha256(blob), size: blob.size, blob };
        data[field] = name;
      }
      else if (toxenapi.isDesktop()) {
        const diskPath = toxenapi.path.join(toxenapi.themeFolderPath, theme.name, value);
        const hash = await toxenapi.hashFile(diskPath).catch((): null => null);
        if (!hash) {
          data[field] = null;
          continue;
        }
        files[value] = { sha256: hash.sha256, size: hash.size, diskPath };
        data[field] = value;
      }
    }
    if (toxenapi.isDesktop()) {
      const api = toxenapi;
      const stat = await api.fs.promises.stat(api.path.join(api.themeFolderPath, theme.name, "theme.json"))
        .catch(() => api.fs.promises.stat(api.path.join(api.themeFolderPath, `${theme.name}.theme.json`)))
        .catch((): null => null);
      updatedAt = stat ? Math.round(stat.mtimeMs) : Date.now();
    }
    else {
      updatedAt = Date.now();
    }
    const hash = ItemMerge.canonical({ data, files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.sha256])) });
    return { data, files, hash, updatedAt };
  }

  private static async _pushTheme(id: string, local: Awaited<ReturnType<typeof SyncedItems._readTheme>>, state: SyncState.ThemeState): Promise<void> {
    const missing = new Set(await SyncApi.findMissingBlobs(Object.values(local.files).map(file => file.sha256)));
    for (const [name, file] of Object.entries(local.files)) {
      if (!missing.has(file.sha256)) continue;
      const upload = await Transfer.uploadBlob(`theme:${id}`, name, { sha256: file.sha256, size: file.size }, file.blob ? { blob: file.blob } : { diskPath: file.diskPath });
      if (upload.ok === false) throw new Error(upload.body.error);
    }
    const remote = state.remote && !state.remote.deleted ? state.remote : null;
    const result = await SyncApi.commitTheme(id, {
      baseRev: remote?.rev ?? null,
      data: local.data,
      updatedAt: local.updatedAt,
      files: Object.fromEntries(Object.entries(local.files).map(([name, file]) => [name, { sha256: file.sha256, size: file.size }])),
    });
    if (result.ok === false) {
      const failure = result.body as SyncV2.StaleBaseErrorResponse<SyncV2.ThemeManifest>;
      if (failure.code === SyncV2.ErrorCode.StaleBase) {
        state.remote = failure.current;
        throw new StaleItemError();
      }
      throw new Error(failure.error);
    }
    state.remote = result.value.manifest;
    state.baseRev = result.value.rev;
    state.baseHash = local.hash;
  }

  /**
   * Write a theme from the server: desktop as `<themes>/<id>/theme.json` plus its image files, web with the images as
   * data URLs (web keeps themes in `localStorage`).
   */
  private static async _writeTheme(manifest: SyncV2.ThemeManifest): Promise<void> {
    const theme = Theme.create({ ...(manifest.data as object), name: manifest.id } as Theme);
    if (toxenapi.isDesktop()) {
      const api = toxenapi;
      const dir = api.safeJoinInside(api.themeFolderPath, manifest.id);
      await api.fs.promises.mkdir(dir, { recursive: true });
      for (const [name, file] of Object.entries(manifest.files)) {
        const dest = api.safeJoinInside(dir, name);
        const existing = await api.hashFile(dest).catch((): null => null);
        if (existing?.sha256 === file.sha256) continue;
        await api.downloadFile({ url: SyncApi.themeFileUrl(manifest.id, name), destPath: dest, headers: SyncApi.getHeaders(), expectedSha256: file.sha256 });
      }
    }
    else {
      for (const field of SyncedItems.THEME_IMAGE_FIELDS) {
        const name = theme[field];
        if (!name || !manifest.files[name]) continue;
        const res = await fetch(SyncApi.themeFileUrl(manifest.id, name), { headers: SyncApi.getHeaders() });
        if (!res.ok) throw new Error(`Downloading the theme image "${name}" failed with ${res.status}.`);
        theme[field] = await SyncedItems._dataUrl(await res.blob());
      }
    }
    SyncedItems._applying = true;
    try {
      await theme.save();
    } finally {
      SyncedItems._applying = false;
    }
  }

  private static _dataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private static async _sha256(blob: Blob): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  //#endregion

  //#region Extensions

  private static async _syncExtensions(): Promise<void> {
    if (!toxenapi.isDesktop()) return; // Web can't install extensions
    const items = SyncState.machine.items;
    await SyncedItems._scanExtensions();
    for (let attempt = 0; attempt < SyncedItems.MAX_ATTEMPTS; attempt++) {
      const plan = ItemMerge.planExtensions(Object.values(items.localExtensions), items.extensions?.extensions ?? []);
      for (const entry of plan.apply) await SyncedItems._applyExtension(entry);
      if (plan.push.length === 0) return;
      const result = await SyncApi.commitExtensions({ baseRev: items.extensions?.rev || null, extensions: plan.push });
      if (result.ok === true) {
        items.extensions = result.value.manifest;
        return;
      }
      const failure = result.body as SyncV2.StaleBaseErrorResponse<SyncV2.ExtensionsManifest>;
      if (failure.code !== SyncV2.ErrorCode.StaleBase) throw new Error(failure.error);
      if (failure.current) items.extensions = failure.current;
    }
  }

  /**
   * Record installs, uninstalls, updates and enable/disable since the last look, with the time they were seen.
   * Extensions found on the first look get their folder's time, so an older uninstall elsewhere doesn't remove them.
   */
  private static async _scanExtensions(): Promise<void> {
    if (!toxenapi.isDesktop()) return;
    const api = toxenapi;
    const local = SyncState.machine.items.localExtensions;
    const now = Date.now();
    for (const [id, ext] of ExtensionManager.extensions) {
      if (!id || id.length > SyncV2.EXTENSION_ID_MAX_LENGTH) continue;
      const version = String(ext.manifest.version ?? "0.0.0").slice(0, SyncV2.EXTENSION_VERSION_MAX_LENGTH);
      const known = local[id];
      if (known && !known.removed && known.version === version && known.enabled === ext.enabled) continue;
      let updatedAt = now;
      if (!known) updatedAt = await api.fs.promises.stat(ext.dirPath).then(stat => Math.round(stat.mtimeMs)).catch(() => now);
      local[id] = { id, version, enabled: ext.enabled, removed: false, updatedAt };
    }
    for (const [id, known] of Object.entries(local)) {
      if (!known.removed && !ExtensionManager.extensions.has(id)) local[id] = { ...known, removed: true, updatedAt: now };
    }
  }

  /**
   * Make this device match a newer entry from the account: install from the store, uninstall, or switch on/off.
   */
  private static async _applyExtension(entry: SyncV2.ExtensionEntry): Promise<void> {
    const local = SyncState.machine.items.localExtensions;
    SyncedItems._applying = true;
    try {
      const installed = ExtensionManager.extensions.get(entry.id);
      if (entry.removed) {
        if (installed) await ExtensionManager.uninstall(entry.id);
      }
      else if (!installed) {
        let found = false;
        try {
          found = await ExtensionManager.installFromStore(entry.id);
        } catch (error) {
          console.warn(`Unable to install the extension "${entry.id}" from the store. It is tried again on the next sync.`, error);
          return;
        }
        if (!found) {
          console.warn(`The extension "${entry.id}" isn't in the extension store, so it can't be installed here.`);
          return;
        }
        if (!entry.enabled) await ExtensionManager.disable(entry.id);
      }
      else if (installed.enabled !== entry.enabled) {
        if (entry.enabled) await ExtensionManager.enable(entry.id);
        else await ExtensionManager.disable(entry.id);
      }
      const now = ExtensionManager.extensions.get(entry.id);
      local[entry.id] = { ...entry, version: now ? String(now.manifest.version ?? entry.version) : entry.version };
    } finally {
      SyncedItems._applying = false;
    }
  }

  //#endregion
}

export default SyncedItems;
