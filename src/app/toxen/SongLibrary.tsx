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

/**
 * Loading, importing and deleting songs (moved out of `Song.tsx`: `getSongs`, `getSongCount`, `loadLocalSongs`,
 * `loadRemoteSongs`, `importSong`, `importSongRemote`, `delete`). Works through `StorageSelector`, never `Settings.isRemote()`.
 *
 * Phase 1: `load()` lists `StorageSelector.forLibrary()` only, exactly as today.
 * Phase 4: `load()` lists both storages on desktop, merges by uid and sets `song.location`; cloud-only songs are built
 * from `SyncState` bases. Web lists the cloud only.
 */
export class SongLibrary {
  private constructor() { }

  /**
   * Load every song, sorted as `Song.sortSongs` does today.
   * @param onEach Called once per song folder or track as it loads (loading screen), with `null` for entries that are
   * skipped because they have no playable media. Throttle UI updates on the caller side (plan P5).
   * @throws If the cloud library can't be loaded, so `Toxen.loadSongs` can fall back to the local library.
   */
  public static async load(onEach?: (song: Song | null) => void): Promise<Song[]> {
    return SongLibrary.loadFrom(StorageSelector.forLibrary(), onEach);
  }

  /**
   * Load every song of one storage. `load()` uses the library storage; the old sync uses this to list the local
   * library while browsing the cloud (removed with it in Phase 4).
   * @param onEach See `load`.
   */
  public static async loadFrom(storage: SongStorage, onEach?: (song: Song | null) => void): Promise<Song[]> {
    const created = new Map<ISong, Song>();
    let infos: ISong[];
    try {
      infos = await storage.listSongs(info => {
        const song = Song.create(info);
        created.set(info, song);
        onEach?.(SongLibrary._isPlayable(song) ? song : null);
      });
    } catch (error) {
      // Cloud errors go up so `Toxen.loadSongs` can fall back to the local library
      if (storage.kind === SongStorage.Kind.Cloud) throw error;
      Toxen.error(error?.message ?? String(error));
      return [];
    }

    const songs: Song[] = [];
    for (const info of infos) {
      const song = created.get(info) ?? Song.create(info);
      if (SongLibrary._isPlayable(song)) songs.push(song);
      else if (storage.kind === SongStorage.Kind.Local) SongLibrary._notifyMissingMedia(song);
    }
    return Song.sortSongs(songs);
  }

  /**
   * Total for the loading screen. `0` if it can't be counted.
   */
  public static async count(): Promise<number> {
    return StorageSelector.forLibrary().countSongs().catch(error => {
      console.error("Unable to count songs", error);
      return 0;
    });
  }

  /**
   * Import a dropped or picked media file as a new song into `StorageSelector.forLibrary()`.
   */
  public static async importMedia(file: File | ToxenFile): Promise<Result<Song>> {
    const ext = toxenapi.getFileExtension(file.name).toLowerCase();
    if (!Toxen.getSupportedMediaFiles().includes(ext)) return new Failure(file.name + " isn't a valid file");

    const storage = StorageSelector.forLibrary();
    try {
      return storage.kind === SongStorage.Kind.Local
        ? await SongLibrary._importLocal(file)
        : await SongLibrary._importCloud(storage, file);
    } catch (error) {
      console.error(error);
      return new Failure(error?.message ?? `Unable to import ${file.name}`);
    }
  }

  /**
   * Delete a song. Phase 1 only supports `"auto"`: the song's own storage, so a local delete never touches the cloud.
   * Phase 4 adds the explicit scopes of the Delete dialog (plan §2.1).
   */
  public static async delete(song: Song, scope: SongLibrary.DeleteScope = "auto"): Promise<void> {
    if (scope !== "auto") throw new Error(`Deleting a song with the "${scope}" scope needs sync v2. Use "auto" until then.`);

    // Play the next song if this is the current song
    const current = Song.getCurrent();
    if (current && current.uid === song.uid) {
      await Toxen.musicPlayer.playNext();
    }

    try {
      await song.storage.deleteSong(song);
    } catch (error) {
      console.error(error);
      Toxen.error("Failed to delete song: " + song.getDisplayName());
    }

    Toxen.songList = Toxen.songList.filter(s => s !== song);
    Toxen.songPanel.update();
  }

  private static _isPlayable(song: Song): boolean {
    return Boolean(song.paths) && song.hasPlayableMedia();
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
    const song = Song.create({ ...info, files: draft.files });
    await song.saveInfo();
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

// Media formats and uid generation live in `Song` / `Toxen`, which the storage layer can't import
LocalSongStorage.instance.setLibraryRules({
  buildInfo: folderPath => Song.buildInfo(folderPath),
  isAudioFile: relPath => Toxen.getSupportedAudioFiles().includes(toxenapi.getFileExtension(relPath).toLowerCase()),
});

export default SongLibrary;
