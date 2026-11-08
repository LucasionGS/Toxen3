import React from "react";
import { Button, Group } from "@mantine/core";
import { hideNotification } from "@mantine/notifications";
import Song from "./Song";
import type { ISong } from "./Song";
import System from "./System";
import type { ToxenFile } from "./System";
import { Failure, Result, Success } from "./Result";
import Settings from "./Settings";
import Converter from "./Converter";
import { Toxen } from "../ToxenApp";
import { SongStorage } from "./storage/SongStorage";
import { StorageSelector } from "./storage/StorageSelector";
import { LocalSongStorage } from "./storage/LocalSongStorage";
import { CloudSongStorage } from "./storage/CloudSongStorage";
import { DeviceSongStorage } from "./storage/DeviceSongStorage";
import { DeviceFs } from "./storage/device/DeviceFs";
import { SyncEngine } from "./sync/SyncEngine";
import { SyncState } from "./sync/SyncState";
import User from "./User";

/**
 * Loading, importing and deleting songs. Works through `StorageSelector`, never `Settings.isRemote()`.
 *
 * The unified library: on desktop `load()` lists the library folder and adds the cloud-only songs `SyncState` knows
 * (union by uid), setting `song.location` on every song. Web lists the songs kept on this device and the cloud (union by
 * uid; a song on both plays from the device). Afterwards `SyncEngine` keeps the list current through `applySyncChange`
 * (downloads, removed downloads, new and changed cloud songs, deletes).
 */
export class SongLibrary {
  private constructor() { }

  /**
   * How long song list refreshes from sync are batched. Unit is in ms.
   */
  public static readonly PANEL_UPDATE_DELAY_MS = 250;

  private static _index = new Map<string, Song>();
  private static _indexedList: Song[] | null = null;
  private static _indexedLength = -1;
  private static _panelTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * `true` when the last `load()` left songs out: the library couldn't be listed, a song folder couldn't be read, or a
   * song has no playable media. `Toxen.loadSongs` hands it to `Playlist.load` so playlists keep the uids of songs that
   * aren't loaded instead of dropping them on the next save.
   */
  public static lastLoadIncomplete = false;

  /**
   * Load every song, sorted as `Song.sortSongs` does today. Sets `lastLoadIncomplete`.
   * @param onEach Called once per song folder or track as it loads (loading screen), with `null` for entries that are
   * skipped because they have no playable media. Throttle UI updates on the caller side (plan P5).
   * @throws If the cloud library can't be loaded, so `Toxen.loadSongs` can fall back to the local library.
   */
  public static async load(onEach?: (song: Song | null) => void): Promise<Song[]> {
    // Another library folder has its own sync state; the engine restarts for it once the songs are listed
    const restartSync = await SyncEngine.prepareLibrary().catch(error => {
      console.error("Unable to load the sync state of the library.", error);
      return false;
    });
    if (!toxenapi.isDesktop()) {
      const songs = await SongLibrary._loadWeb(onEach);
      SongLibrary._ensureCloudTokens(songs);
      if (restartSync) setTimeout(() => SyncEngine.init().catch(error => console.error("Unable to restart sync.", error)), 0);
      return songs;
    }

    const storage = StorageSelector.forLibrary();
    const result = await SongLibrary._load(storage, onEach);
    SongLibrary.lastLoadIncomplete = result.incomplete;

    const location: SongStorage.Location = { local: storage.kind === SongStorage.Kind.Local, cloud: storage.kind === SongStorage.Kind.Cloud };
    for (const song of result.songs) {
      song.location = { ...location, cloud: location.cloud || SongLibrary._isInCloud(song.uid) };
    }
    const songs = storage.kind === SongStorage.Kind.Local
      ? Song.sortSongs([...result.songs, ...SongLibrary._cloudOnlySongs(result.songs, onEach)])
      : result.songs;

    SongLibrary._ensureCloudTokens(songs);
    if (restartSync) setTimeout(() => SyncEngine.init().catch(error => console.error("Unable to restart sync.", error)), 0);
    return songs;
  }

  /**
   * The library's song with this uid, or `null`.
   */
  public static getSong(uid: string): Song | null {
    const list = Toxen.songList ?? [];
    if (SongLibrary._indexedList !== list || SongLibrary._indexedLength !== list.length) {
      SongLibrary._index = new Map(list.map(song => [song.uid, song]));
      SongLibrary._indexedList = list;
      SongLibrary._indexedLength = list.length;
    }
    return SongLibrary._index.get(uid) ?? null;
  }

  /**
   * Bring the song list in line with a sync change: add new cloud and downloaded songs, update changed ones in place
   * (playlists and the player keep their references), drop deleted ones.
   */
  public static applySyncChange(change: SyncEngine.SongChange): void {
    const existing = SongLibrary.getSong(change.uid);
    if (!toxenapi.isDesktop() && existing?.location?.local) {
      // Web: the engine only knows the cloud copy. A song kept on this device stays and keeps playing from it, also
      // when its cloud copy is deleted
      existing.location = { local: true, cloud: Boolean(change.remote) };
      SongLibrary._schedulePanelUpdate();
      return;
    }
    if (!change.local && !change.remote) {
      if (!existing) return;
      if (Song.getCurrent() === existing) Toxen.musicPlayer?.playNext();
      Toxen.songList = (Toxen.songList ?? []).filter(song => song !== existing);
      SongLibrary._schedulePanelUpdate();
      return;
    }

    const info = change.local ? change.local.info : CloudSongStorage.toSongInfo(change.remote);
    const location: SongStorage.Location = { local: Boolean(change.local), cloud: Boolean(change.remote) };
    if (existing) {
      existing.applyInfo(info);
      existing.location = location;
    }
    else {
      const song = Song.create(info);
      song.location = location;
      if (!SongLibrary._isPlayable(song)) return;
      (Toxen.songList ??= []).push(song);
      Song.sortSongs(Toxen.songList);
    }
    if (!change.local && change.remote) {
      CloudSongStorage.instance.ensureMediaTokens([change.uid]).catch(error => console.warn("Unable to get media tokens.", error));
    }
    SongLibrary._schedulePanelUpdate();
  }

  /**
   * Whether `SyncState` knows a live cloud track for `uid`.
   */
  private static _isInCloud(uid: string): boolean {
    const remote = SyncState.peekSong(uid)?.remote;
    return Boolean(remote && !remote.deleted);
  }

  /**
   * Songs that exist only in the cloud, from the manifests in `SyncState` (desktop; the engine refreshes them).
   */
  private static _cloudOnlySongs(localSongs: Song[], onEach?: (song: Song | null) => void): Song[] {
    if (!User.getCurrentUser()) return [];
    const localUids = new Set(localSongs.map(song => song.uid));
    const songs: Song[] = [];
    for (const [uid, state] of Object.entries(SyncState.data.songs)) {
      if (localUids.has(uid) || !state.remote || state.remote.deleted) continue;
      const song = Song.create(CloudSongStorage.toSongInfo(state.remote));
      song.location = { local: false, cloud: true };
      if (!SongLibrary._isPlayable(song)) continue;
      onEach?.(song);
      songs.push(song);
    }
    return songs;
  }

  private static _schedulePanelUpdate(): void {
    if (SongLibrary._panelTimer) return;
    SongLibrary._panelTimer = setTimeout(() => {
      SongLibrary._panelTimer = null;
      Toxen.songPanel?.update();
    }, SongLibrary.PANEL_UPDATE_DELAY_MS);
  }

  private static async _load(storage: SongStorage, onEach?: (song: Song | null) => void): Promise<{ songs: Song[], incomplete: boolean }> {
    const created = new Map<ISong, Song>();
    const skipped: SongStorage.SkippedEntry[] = [];
    let infos: ISong[];
    try {
      infos = await storage.listSongs(info => {
        const song = Song.create(info);
        created.set(info, song);
        onEach?.(SongLibrary._isPlayable(song) ? song : null);
      }, entry => skipped.push(entry));
    } catch (error) {
      // Cloud errors go up so `Toxen.loadSongs` can fall back to the local library
      if (storage.kind === SongStorage.Kind.Cloud) throw error;
      console.error(error);
      Toxen.error(`Unable to load the song library: ${error?.message ?? error}. Playlists keep their songs until the library loads again.`);
      return { songs: [], incomplete: true };
    }
    if (skipped.length > 0) SongLibrary._notifySkipped(skipped);

    const songs: Song[] = [];
    let unplayable = 0;
    for (const info of infos) {
      const song = created.get(info) ?? Song.create(info);
      if (SongLibrary._isPlayable(song)) songs.push(song);
      else {
        unplayable++;
        if (storage.kind === SongStorage.Kind.Local) SongLibrary._notifyMissingMedia(song);
      }
    }
    return { songs: Song.sortSongs(songs), incomplete: skipped.length > 0 || unplayable > 0 };
  }

  /**
   * Total for the loading screen. `0` if it can't be counted.
   */
  public static async count(): Promise<number> {
    if (!toxenapi.isDesktop()) {
      const [device, cloud] = await Promise.all([
        DeviceSongStorage.instance.countSongs().catch((): number => 0),
        User.getCurrentUser() ? CloudSongStorage.instance.countSongs().catch((): number => 0) : 0,
      ]);
      return device + cloud;
    }
    const storage = StorageSelector.forLibrary();
    const count = await storage.countSongs().catch(error => {
      console.error("Unable to count songs", error);
      return 0;
    });
    if (storage.kind !== SongStorage.Kind.Local || !User.getCurrentUser()) return count;
    // Cloud-only songs aren't folders; counting every live manifest overcounts synced songs only on the loading screen
    return count + Object.values(SyncState.data.songs).filter(state => state.remote && !state.remote.deleted && state.baseFiles === null).length;
  }

  /**
   * Import a dropped or picked media file as a new song into `StorageSelector.forLibrary()`.
   */
  public static async importMedia(file: File | ToxenFile): Promise<Result<Song>> {
    const ext = toxenapi.getFileExtension(file.name).toLowerCase();
    if (!Toxen.getSupportedMediaFiles().includes(ext)) return new Failure(file.name + " isn't a valid file");

    const storage = StorageSelector.forLibrary();
    try {
      if (storage.kind === SongStorage.Kind.Local) return await SongLibrary._importLocal(file);
      if (storage.kind === SongStorage.Kind.Device) return await SongLibrary._importDevice(file);
      return await SongLibrary._importCloud(storage, file);
    } catch (error) {
      console.error(error);
      return new Failure(error?.message ?? `Unable to import ${file.name}`);
    }
  }

  /**
   * Import a picked file as a new song kept on this device (web). Signed in with auto-sync on, it is uploaded later
   * by the device sync.
   */
  public static async importToDevice(file: File): Promise<Result<Song>> {
    const ext = toxenapi.getFileExtension(file.name).toLowerCase();
    if (!Toxen.getSupportedMediaFiles().includes(ext)) return new Failure(file.name + " isn't a valid file");
    try {
      return await SongLibrary._importDevice(file);
    } catch (error) {
      console.error(error);
      return new Failure(error?.message ?? `Unable to import ${file.name}`);
    }
  }

  /**
   * Delete a song from this device, the cloud, or both (the Delete dialog, plan §2.1). `auto` is the copy the song
   * plays from: the local copy when there is one (a synced song stays in the cloud), otherwise the cloud copy.
   */
  public static async delete(song: Song, scope: SongLibrary.DeleteScope = "auto"): Promise<void> {
    if (!toxenapi.isDesktop()) return SongLibrary._deleteWeb(song, scope);
    const resolved: Exclude<SongLibrary.DeleteScope, "auto"> = scope !== "auto" ? scope : (StorageSelector.isLocal(song) ? "device" : "cloud");
    const keepsCloud = resolved === "device" && Boolean(song.location?.cloud);
    const keepsLocal = resolved === "cloud" && StorageSelector.isLocal(song);

    // Play the next song if this one disappears from the list
    const current = Song.getCurrent();
    if (current && current.uid === song.uid && !keepsCloud && !keepsLocal) {
      await Toxen.musicPlayer.playNext();
    }

    try {
      if (User.getCurrentUser() && (song.location?.cloud || SongLibrary._isInCloud(song.uid))) {
        // The sync engine keeps the sync state right (a removed download must not read as a deletion)
        await SyncEngine.deleteFrom(song, resolved);
      }
      else if (resolved !== "cloud") {
        await song.storage.deleteSong(song);
        if (User.getCurrentUser()) SyncState.removeSong(song.uid);
      }
    } catch (error) {
      console.error(error);
      Toxen.error(`Failed to delete ${song.getDisplayName()}: ${error?.message ?? error}`);
      return;
    }

    if (keepsCloud || keepsLocal) {
      song.location = { local: keepsLocal, cloud: keepsCloud };
    }
    else {
      Toxen.songList = Toxen.songList.filter(s => s !== song);
    }
    Toxen.songPanel.update();
  }

  /**
   * Web: remove the device copy, the cloud copy or both. A song keeps whichever copy is left.
   */
  private static async _deleteWeb(song: Song, scope: SongLibrary.DeleteScope): Promise<void> {
    const onDevice = Boolean(song.location?.local);
    const inCloud = Boolean(song.location?.cloud) || SongLibrary._isInCloud(song.uid);
    const resolved = scope !== "auto" ? scope : (onDevice ? "device" : "cloud");
    const removeDevice = onDevice && resolved !== "cloud";
    const removeCloud = inCloud && resolved !== "device";
    const keepsDevice = onDevice && !removeDevice;
    const keepsCloud = inCloud && !removeCloud;

    const current = Song.getCurrent();
    if (current && current.uid === song.uid && (removeDevice || !keepsDevice)) await Toxen.musicPlayer.playNext();

    try {
      if (removeCloud) {
        if (User.getCurrentUser()) await SyncEngine.deleteFrom(song, "cloud");
        else await CloudSongStorage.instance.deleteSong(song);
      }
      if (removeDevice) await DeviceSongStorage.instance.deleteSong(song);
    } catch (error) {
      console.error(error);
      Toxen.error(`Failed to delete ${song.getDisplayName()}: ${error?.message ?? error}`);
      return;
    }

    if (keepsDevice || keepsCloud) song.location = { local: keepsDevice, cloud: keepsCloud };
    else Toxen.songList = Toxen.songList.filter(s => s !== song);
    Toxen.songPanel.update();
  }

  /**
   * Web: the songs on this device plus the cloud songs (when logged in), union by uid. A song in both plays from the
   * device. Sets `lastLoadIncomplete`.
   * @throws If the cloud library can't be loaded and there are no device songs to show instead.
   */
  private static async _loadWeb(onEach?: (song: Song | null) => void): Promise<Song[]> {
    const device = DeviceSongStorage.isAvailable()
      ? await SongLibrary._load(DeviceSongStorage.instance, onEach)
      : { songs: [] as Song[], incomplete: false };
    for (const song of device.songs) song.location = { local: true, cloud: SongLibrary._isInCloud(song.uid) };

    let cloud = { songs: [] as Song[], incomplete: false };
    if (User.getCurrentUser()) {
      try {
        cloud = await SongLibrary._load(CloudSongStorage.instance, onEach);
      } catch (error) {
        if (device.songs.length === 0) throw error;
        console.error(error);
        Toxen.error(`Unable to load your cloud library: ${error?.message ?? error}. Songs on this device still play.`);
        cloud.incomplete = true;
      }
    }

    const onDevice = new Map(device.songs.map(song => [song.uid, song]));
    const cloudOnly: Song[] = [];
    for (const song of cloud.songs) {
      const local = onDevice.get(song.uid);
      if (local) local.location = { local: true, cloud: true };
      else {
        song.location = { local: false, cloud: true };
        cloudOnly.push(song);
      }
    }
    SongLibrary.lastLoadIncomplete = device.incomplete || cloud.incomplete;
    return Song.sortSongs([...device.songs, ...cloudOnly]);
  }

  /**
   * Fetch media tokens for the songs that stream from the cloud. Not awaited: until the tokens arrive, cloud files
   * load with the session token.
   */
  private static _ensureCloudTokens(songs: Song[]): void {
    const cloudUids = songs.filter(song => song.location?.cloud && !song.location.local).map(song => song.uid);
    if (cloudUids.length === 0) return;
    CloudSongStorage.instance.ensureMediaTokens(cloudUids).catch(error => console.warn("Unable to get media tokens.", error));
  }

  private static _isPlayable(song: Song): boolean {
    return Boolean(song.paths) && song.hasPlayableMedia();
  }

  /**
   * Tell the user once which song folders couldn't be read and were left out of the library.
   */
  private static _notifySkipped(skipped: SongStorage.SkippedEntry[]): void {
    const SHOWN = 8;
    const nId = Toxen.notify({
      title: skipped.length === 1 ? "1 song couldn't be loaded" : `${skipped.length} songs couldn't be loaded`,
      content: <div>
        <p>These song folders couldn't be read and were left out. Check that Toxen can read them, then reload the library. Your playlists keep these songs in the meantime.</p>
        <ul>
          {skipped.slice(0, SHOWN).map(entry => <li key={entry.name}><code>{entry.name}</code>: {entry.error.message}</li>)}
          {skipped.length > SHOWN && <li>…and {skipped.length - SHOWN} more</li>}
        </ul>
        <Group>
          <Button color="green" onClick={() => hideNotification(nId)}>OK</Button>
          {toxenapi.isDesktop() && (
            <Button color="blue" onClick={() => {
              if (toxenapi.isDesktop()) toxenapi.remote.shell.openPath(Settings.get("libraryDirectory"));
            }}>Show Library Folder</Button>
          )}
        </Group>
      </div>,
      type: "error",
    });
  }

  /**
   * Ask what to do with a local song folder that has no media file.
   */
  private static _notifyMissingMedia(song: Song): void {
    console.warn(`Song "${song.dirname()}" is missing a media file. Excluding from song list.`);
    const nId = Toxen.notify({
      title: "Song missing media file",
      content: <div>
        <p>The song <b>{song.getDisplayName()}</b> is missing a media file. </p>
        <p>Do you want to remove it from the library?</p>
        <Group>
          <Button color="red" onClick={() => {
            hideNotification(nId);
            SongLibrary.delete(song);
          }}>Delete</Button>
          <Button color="green" onClick={() => hideNotification(nId)}>Ask later</Button>
          {toxenapi.isDesktop() && (
            <Button color="blue" onClick={() => {
              if (toxenapi.isDesktop()) toxenapi.remote.shell.openPath(song.dirname());
            }}>Show Folder</Button>
          )}
        </Group>
      </div>,
      type: "warning",
    });
  }

  /**
   * Copy the media file into a new song folder in the library directory and build its info.
   */
  private static async _importLocal(file: File | ToxenFile): Promise<Result<Song>> {
    if (!toxenapi.isDesktop()) return new Failure("Importing into a local library is only available on desktop.");
    const ensureValidName = (name: string) => name.replace(/[^:\\/a-z0-9()[\]{}.\-_\s]/gi, "_");
    const libraryDirectory = Settings.get("libraryDirectory");
    const nameNoExt = ensureValidName(Converter.trimChar(toxenapi.path.basename(file.name, toxenapi.path.extname(file.name)), "."));

    let dirname = nameNoExt;
    let increment = 0;
    while (await toxenapi.fs.promises.stat(toxenapi.path.resolve(libraryDirectory, dirname)).then(() => true).catch(() => false)) {
      dirname = `${nameNoExt} (${++increment})`;
    }

    // A placeholder song gives the storage a folder to write into; the real info is built from the copied file
    const draft = Song.create({ paths: { dirname, media: null, background: null, subtitles: null, storyboard: null } });
    await LocalSongStorage.instance.writeFile(draft, ensureValidName(file.name), System.toWriteData(file, toxenapi.getFilePath(file)));

    const info = await Song.buildInfo(LocalSongStorage.instance.songDir(draft));
    const song = Song.create(info);
    song.location = { local: true, cloud: false };
    await song.saveInfo();
    // New imports go up to the cloud when auto-sync is on (existing local-only songs stay local until uploaded)
    if (User.getCurrentUser() && Settings.get("autoSync") !== false) SyncEngine.markForUpload(song.uid);
    return new Success(song);
  }

  /**
   * Copy a picked file into device storage as a new song. A failed copy (device full) leaves nothing behind.
   */
  private static async _importDevice(file: File | ToxenFile): Promise<Result<Song>> {
    if (!DeviceSongStorage.isAvailable()) return new Failure("This browser can't keep songs on the device.");
    if (typeof File === "undefined" || !(file instanceof File)) return new Failure(`Unable to read ${file.name}`);

    const uid = Song.generateUID();
    const fileName = file.name.replace(/[\\/]/g, "_");
    const song = Song.create(newDeviceInfo(uid, fileName));
    song.location = { local: true, cloud: false };
    const storage = DeviceSongStorage.instance;
    try {
      await storage.writeFile(song, fileName, file);
      await storage.saveInfo(song);
    } catch (error) {
      await storage.deleteSong(song).catch((): void => undefined);
      throw error;
    }
    // Not awaited: the browser may ask the user, and the import is done either way
    DeviceFs.persist().catch((): void => undefined);
    return new Success(song);
  }

  /**
   * Upload the media file as a new track and save its info.
   */
  private static async _importCloud(storage: SongStorage, file: File | ToxenFile): Promise<Result<Song>> {
    if (!Settings.getUser()) return new Failure("Not logged in");

    const uid = Song.generateUID();
    const fileName = file.name;
    const nameNoExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
    const song = Song.create({
      uid,
      title: nameNoExt,
      paths: {
        dirname: uid,
        media: fileName,
        background: "",
        subtitles: "",
        storyboard: "",
      },
    });

    // A browser `File` is uploaded as is; a dropped desktop file is read from its path
    let data: SongStorage.WriteData;
    if (typeof File !== "undefined" && file instanceof File) data = file;
    else if (toxenapi.isDesktop()) data = { diskPath: toxenapi.getFilePath(file) };
    else return new Failure("Cannot read file path on web");

    await storage.writeFile(song, fileName, data);
    await song.saveInfo();
    song.location = { local: false, cloud: true };
    return new Success(song);
  }
}

export namespace SongLibrary {
  /**
   * `auto` = the song's own storage. `device` = local copy only (keeps the cloud copy). `cloud` = cloud copy only.
   * `everywhere` = both.
   */
  export type DeleteScope = "auto" | "device" | "cloud" | "everywhere";
}

/**
 * The info of a new device song that plays `mediaPath`, titled from the file name ("Artist - Title" is split).
 */
function newDeviceInfo(uid: string, mediaPath: string): ISong {
  const fileName = mediaPath.split("/").pop() ?? mediaPath;
  const nameNoExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
  // "Artist - Title.mp3", the same rule as a desktop import
  const prettify = (str: string) => str.replace(/[_ ]+/g, " ").trim();
  const separator = nameNoExt.indexOf(" - ");
  return {
    uid,
    ...(separator > -1
      ? { artist: prettify(nameNoExt.slice(0, separator)), title: prettify(nameNoExt.slice(separator + 3)) }
      : { title: nameNoExt }),
    paths: { dirname: uid, media: mediaPath, background: "", subtitles: "", storyboard: "" },
  } as ISong;
}

// Media formats and uid generation live in `Song` / `Toxen`, which the storage layer can't import
LocalSongStorage.instance.setLibraryRules({
  buildInfo: folderPath => Song.buildInfo(folderPath),
  isAudioFile: relPath => Toxen.getSupportedAudioFiles().includes(toxenapi.getFileExtension(relPath).toLowerCase()),
  newHash: () => Song.randomFileHash(),
});

DeviceSongStorage.instance.setLibraryRules({
  buildInfo: newDeviceInfo,
  isAudioFile: relPath => Toxen.getSupportedAudioFiles().includes(toxenapi.getFileExtension(relPath).toLowerCase()),
  newHash: () => Song.randomFileHash(),
});

// The sync engine reads the library through this, since it can't import `Toxen`
SyncEngine.setLibrary({
  getSongs: () => Toxen.songList ?? [],
  getSong: uid => SongLibrary.getSong(uid),
  isComplete: () => !SongLibrary.lastLoadIncomplete,
});

export default SongLibrary;
