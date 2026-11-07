import Settings from "./Settings";
import Song from "./Song";
// import fsp from "fs/promises";
// import fs from "fs";
import { Toxen } from "../ToxenApp";
// import Path from "path";
import type { ModalsContextProps } from "../../types/mantine-modals";
import React from "react";
import { Button, Stack } from "@mantine/core";
import { IconFileImport, IconTrash } from "@tabler/icons-react";
import System, { ToxenFile } from "./System";
import User from "./User";
import { SongLibrary } from "./SongLibrary";
import { SyncState } from "./sync/SyncState";
import type { ItemMerge } from "./sync/ItemMerge";
// import * as remote from "@electron/remote";

export default class Playlist {
  private constructor() { }

  // public static playlists: Playlist[];
  public id?: string;
  public name: string;
  public background?: string;
  public applyBackground?: boolean;
  public songList: Song[];
  public songBackground?: Record<string, string>;
  public lastModified?: number;

  public static create(data: IPlaylist, compareToSongObject?: { [uid: string]: Song }) {
    let pl = new Playlist();
    pl.id = data.id || System.randomString(16);
    pl.name = data.name;
    pl.background = data.background;
    pl.applyBackground = data.applyBackground ?? false;
    pl.songBackground = data.songBackground ?? {};
    pl.lastModified = data.lastModified ?? Date.now();
    if (compareToSongObject) {
      pl.songList = data.songList.map(uid => compareToSongObject[uid]).filter(s => s !== null).filter(a => a);
    }
    else {
      pl.songList = data.songList.map(uid => Toxen.songList.find(s => s.uid === uid)).filter(a => a);
    }
    if (Playlist.keepMissingSongs) {
      const loaded = new Set(pl.songList.map(s => s.uid));
      pl._missingSongUids = data.songList.filter(uid => uid && !loaded.has(uid));
    }

    return pl;
  }

  /**
   * When `true`, playlists created from stored data keep the uids of songs that aren't in `Toxen.songList`, and save
   * them back. Set by `Toxen.loadSongs` when the library loaded incompletely (unreadable folders, a failed listing or no
   * songs at all), so a broken load can't empty `playlists.json`. When `false`, unknown uids are dropped as before.
   */
  public static keepMissingSongs = false;

  /**
   * Uids from the stored playlist whose songs weren't loaded (see `keepMissingSongs`).
   */
  private _missingSongUids: string[] = [];

  /**
   * Uids of every song in the playlist, including songs that are kept but not loaded (see `keepMissingSongs`).
   */
  public getSongUids(): string[] {
    return [...new Set([...this.songList.map(s => s.uid), ...this._missingSongUids])];
  }

  /**
   * Path for the playlists file.
   */
  public static get filePath() {
    if (toxenapi.isDesktop()) {
      return toxenapi.path.resolve(Settings.get("libraryDirectory"), "playlists.json");
    }
    else {
      toxenapi.throwDesktopOnly("Getting file path is not available on web version");
    }
  }

  /**
   * `true` when the playlists couldn't be read (web: the cloud library didn't load). While set, sync never pushes
   * deletions or emptied playlists from this device, so a failed load can't wipe the account's playlists.
   */
  public static remoteLoadFailed = false;

  /**
   * `true` when `playlists.json` couldn't be read and the backup (or nothing) was used instead. Same protection as
   * `remoteLoadFailed`, for the local file.
   */
  public static localLoadFailed = false;

  /**
   * Called after every `save()` (set by the playlist sync, which pushes the change).
   */
  public static onSaved: (() => void) | null = null;

  public touch() {
    this.lastModified = Date.now();
  }

  /**
   * The playlist as the sync merge sees it.
   */
  public toSyncVersion(): ItemMerge.PlaylistVersion {
    return {
      name: this.name ?? "",
      songs: this.getSongUids(),
      background: this.background || null,
      applyBackground: this.applyBackground ?? false,
      songBackground: { ...(this.songBackground ?? {}) },
      updatedAt: this.lastModified ?? 0,
    };
  }

  /**
   * Take over a version from sync. Uids of songs that aren't in the library (yet) are kept, so saving the playlist
   * never drops them.
   */
  public applySyncVersion(version: ItemMerge.PlaylistVersion): void {
    this.name = version.name;
    this.background = version.background ?? undefined;
    this.applyBackground = version.applyBackground;
    this.songBackground = { ...version.songBackground };
    this.lastModified = version.updatedAt;
    const byUid = new Map((Toxen.songList ?? []).map(song => [song.uid, song]));
    this.songList = version.songs.map(uid => byUid.get(uid)).filter(song => song);
    const loaded = new Set(this.songList.map(song => song.uid));
    this._missingSongUids = version.songs.filter(uid => !loaded.has(uid));
  }

  /**
   * A playlist created from sync (a playlist from another device).
   */
  public static fromSyncVersion(id: string, version: ItemMerge.PlaylistVersion): Playlist {
    const pl = Playlist.create({ id, name: version.name, songList: [] });
    pl.applySyncVersion(version);
    return pl;
  }

  /**
   * Write the playlists locally without telling sync (sync writing what it pulled).
   */
  public static async saveLocal() {
    localStorage.setItem("playlists-backup", Playlist.toString());
    if (!toxenapi.isDesktop()) return;
    try {
      await toxenapi.atomicWriteFile(Playlist.filePath, Playlist.toString());
    } catch (error) {
      Toxen.error(error);
    }
  }

  /**
   * Save Toxen's current playlists.
   */
  public static async save() {
    console.log("Saving playlists...");
    localStorage.setItem("playlists-backup", Playlist.toString());
    if (toxenapi.isDesktop()) {
      try {
        toxenapi.fs.writeFileSync(Playlist.filePath, Playlist.toString());
      } catch (error) {
        Toxen.error(error);
      }
    }
    Playlist.onSaved?.();
  }

  /**
   * Save Toxen's playlists from `filePath`.
   */
  /**
   * `true` while `load()` runs. The playlist sync waits for it, so a half-loaded list never reads as deletions.
   */
  public static isLoading = false;

  public static async load(): Promise<Playlist[]> {
    Playlist.isLoading = true;
    return Promise.resolve().then(async () => {
      if (!toxenapi.isDesktop()) {
        // Web: the playlists come from the changelog, which the cloud library listing just read
        if (SongLibrary.lastLoadIncomplete) {
          Playlist.remoteLoadFailed = true;
          Toxen.error("Unable to load playlists from the server. Playlist changes aren't synced until they load.");
          return [];
        }
        Playlist.remoteLoadFailed = false;
        const playlists = Object.entries(SyncState.data.playlists)
          .filter(([, state]) => state.remote && !state.remote.deleted)
          .map(([id, state]) => Playlist.fromSyncVersion(id, {
            name: state.remote.name,
            songs: state.remote.songs,
            background: state.remote.background,
            applyBackground: state.remote.applyBackground,
            songBackground: state.remote.songBackground,
            updatedAt: state.remote.updatedAt,
          }));
        return playlists.sort((a, b) => a.name.localeCompare(b.name));
      }
      else {
        if (toxenapi.isDesktop()) {
          // Local
          if (!(await toxenapi.fs.promises.stat(Playlist.filePath).then(() => true).catch(() => false))) {
            await Playlist.save();
          }
          try {
            let data = await toxenapi.fs.promises.readFile(Playlist.filePath, "utf8");
            let iPlaylists: IPlaylist[] = JSON.parse(data);
            let playlists: Playlist[] = iPlaylists.map(pl => Playlist.create(pl));
            Playlist.localLoadFailed = false;
            // Sort that shit
            return playlists.sort((a, b) => a.name.localeCompare(b.name));
          } catch (error) {
            Playlist.localLoadFailed = true;
            // Use localStorage backup
            if (localStorage.getItem("playlists-backup")) {
              Toxen.warn("Using backup for playlists.", 2500);
              try {
                let data = localStorage.getItem("playlists-backup");
                let iPlaylists: IPlaylist[] = JSON.parse(data);
                let playlists: Playlist[] = iPlaylists.map(pl => Playlist.create(pl));
                // Sort that shit
                return playlists.sort((a, b) => a.name.localeCompare(b.name));
              } catch (error) {
                Toxen.error("Unable to parse playlists file.\nPlaylists have been reset.");
                Playlist.save();
                return [];
              }
            }
            else {
              Toxen.error("Unable to parse playlists file.\nPlaylists have been reset.");
              Playlist.save();
              return [];
            }
          }
        }
      }
    }).finally(() => {
      Playlist.isLoading = false;
    });
  }

  public static getCurrent() {
    return Toxen.playlist ?? null;
  }

  public static addPlaylist(playlist: Playlist) {
    if (!Toxen.playlists) Toxen.playlists = [];
    Toxen.playlists.push(playlist);
    Playlist.save();
  }

  /**
  * Returns a stringified version of `IPlaylist`.
  */
  public static toString() {
    const playlists: IPlaylist[] = (Toxen.playlists ?? []).map(pl => {
      return {
        id: pl.id,
        name: pl.name,
        background: pl.background,
        applyBackground: pl.applyBackground,
        songBackground: pl.songBackground,
        songList: pl.getSongUids(),
        lastModified: pl.lastModified,
      }
    });
    return JSON.stringify(playlists, null, 2);
  }

  public async addSong(song: Song): Promise<void>;
  public async addSong(...songs: Song[]): Promise<void>;
  public async addSong(...songs: Song[]): Promise<void> {
    songs = songs.filter(s => !this.songList.includes(s));
    this.songList.push(...songs);
    this.songList = Song.sortSongs(this.songList);
    this.touch();
    if (Toxen.sidePanel.getSectionId() === "songPanel" && Toxen.playlist === this) Toxen.reloadSection();
  }

  public async removeSong(song: Song): Promise<void>;
  public async removeSong(...songs: Song[]): Promise<void>;
  public async removeSong(...songs: Song[]): Promise<void> {
    this.songList = this.songList.filter(s => !songs.includes(s));
    this.touch();
    if (Toxen.sidePanel.getSectionId() === "songPanel" && Toxen.playlist === this) Toxen.reloadSection(); await Playlist.save();
  }

  public promptSetBackground(modals: ModalsContextProps, song?: Song) {
    const promptImage = () => {
      if (toxenapi.isDesktop()) {
        let paths = toxenapi.remote.dialog.showOpenDialogSync(toxenapi.remote.getCurrentWindow(), {
          properties: [
            "openFile"
          ],
          filters: [
            {
              name: "Media files",
              extensions: Toxen.getSupportedImageFiles().map(ext => ext.replace(".", ""))
            },
          ],
        });
  
        if (!paths || paths.length == 0) return;
  
        const files: ToxenFile[] = paths.map(p => ({
          name: toxenapi.path.basename(p),
          path: p
        }));
  
        const playlistBackgroundsDir = Playlist.getPlaylistBackgroundsDir(true);
        let randomizedName: string;
        do {
          randomizedName = System.randomString(16) + toxenapi.path.extname(files[0].name);
        } while (toxenapi.fs.existsSync(toxenapi.path.join(playlistBackgroundsDir, randomizedName)));
        
        // Electron 32 removed File.path — resolve through the controller instead.
        toxenapi.fs.copyFileSync(toxenapi.getFilePath(files[0]), toxenapi.path.join(playlistBackgroundsDir, randomizedName));
  
        if (song) {
          if (!this.songBackground) this.songBackground = {};
          if (this.songBackground[song.uid]) {
            toxenapi.fs.unlinkSync(toxenapi.path.join(playlistBackgroundsDir, this.songBackground[song.uid]));
          }
          this.songBackground[song.uid] = randomizedName;
        }
        else {
          if (this.background) {
            toxenapi.fs.unlinkSync(toxenapi.path.join(playlistBackgroundsDir, this.background));
          }
          this.background = randomizedName;
        }


        this.touch();
        Playlist.save();
        Toxen.playlistPanel.update();
        modals.closeModal(modalId);
      }
    }

    if (song) {
      if (!this.songBackground) this.songBackground = {};
      promptImage();
      return;
    }
    
    const modalId = modals.openModal({
      title: "Change playlist background",
      children: (
        <div>
          <p>Choose a background image for the playlist.</p>
          <Stack>
            <Button
              leftSection={<IconFileImport size="1em" />}
              onClick={promptImage}
            >Set background</Button>
            <Button
              color="red"
              leftSection={<IconTrash size="1em" />}
              onClick={() => {
                this.removeBackground();;
                Toxen.playlistPanel.update();
                modals.closeModal(modalId);
              }}
            >Remove background</Button>
          </Stack>
        </div>
      )
    });
  }

  public async removeBackground(song?: Song) {
    if (Settings.isRemote()) {
      // Remote: delete background from server
      const filename = song ? this.songBackground?.[song.uid] : this.background;
      if (filename) {
        await Toxen.fetch(`${Settings.getUser().getPlaylistsPath()}/${filename}`, { method: "DELETE" });
      }
      if (song) {
        if (this.songBackground?.[song.uid]) delete this.songBackground[song.uid];
      } else {
        this.background = null;
      }
      this.touch();
      await Playlist.save();
    } else if (toxenapi.isDesktop()) {
      if (song) {
        if (!this.songBackground) this.songBackground = {};
        if (this.songBackground[song.uid]) {
          toxenapi.fs.unlinkSync(toxenapi.path.join(Playlist.getPlaylistBackgroundsDir(), this.songBackground[song.uid]));
          delete this.songBackground[song.uid];
        }
      }
      else {
        if (this.background) {
          toxenapi.fs.unlinkSync(toxenapi.path.join(Playlist.getPlaylistBackgroundsDir(), this.background));
          this.background = null;
        }
      }
      this.touch();
      Playlist.save();
    }
  }
  
  public static getLocalPlaylistBackgroundsDir(ensureExisting = false) {
    if (toxenapi.isDesktop()) {
      const playlistBackgroundsDir = toxenapi.path.resolve(Settings.get("libraryDirectory"), ".playlistBackgrounds");
      if (ensureExisting && !toxenapi.fs.existsSync(playlistBackgroundsDir)) toxenapi.fs.mkdirSync(playlistBackgroundsDir);
      return playlistBackgroundsDir;
    }
    else {
      toxenapi.throwDesktopOnly("Getting local playlist backgrounds directory is not available on web version");
    }
  }

  public static getRemotePlaylistBackgroundsDir() {
    const playlistBackgroundsDir = `${Settings.getServer()}/playlist`;
    return playlistBackgroundsDir;
  }
  
  public static getPlaylistBackgroundsDir(ensureExisting = false) {
    const remote = Settings.isRemote();
    return remote ? Playlist.getRemotePlaylistBackgroundsDir() : Playlist.getLocalPlaylistBackgroundsDir(ensureExisting);
  }

  /**
   * The playlist's own background as a disk path or plain server URL, without the auth token.
   * `null` when the playlist has no background or doesn't apply it.
   */
  public getBackgroundLocation(): string | null {
    if (!this.applyBackground || !this.background) return null;
    if (Settings.isRemote()) return `${Playlist.getPlaylistBackgroundsDir()}/${this.background}`;
    if (!toxenapi.isDesktop()) return null;
    return toxenapi.path.resolve(Playlist.getPlaylistBackgroundsDir(), this.background).replace(/\\/g, "/");
  }

  private _cachedBackgroundPath: string;
  private _cachedBackgroundName: string;
  public getBackgroundPath(onlyGlobal = false, ignoreApply = false) {
    const remote = Settings.isRemote();
    const song = Toxen.background.storyboard.state.song;
    const songBg = onlyGlobal ? null : song?.getPlaylistSettings(Toxen.playlist?.name)?.paths?.background;
    const bgUsed = songBg ?? this.background;

    if (songBg) {
      this._cachedBackgroundName = songBg;
      const path = song.dirname(songBg);
      return remote ? User.appendAuth(path) : path;
    }
    
    if (!songBg && (!this.applyBackground && !ignoreApply)) return null;
    
    if (bgUsed === this._cachedBackgroundName) return this._cachedBackgroundPath;
    if (!bgUsed) return null;
    this._cachedBackgroundName = bgUsed;

    if (!remote && !toxenapi.isDesktop()) {
      toxenapi.warnDesktopOnly("Getting background path is not available on web version");
      return null;
    }

    return this._cachedBackgroundPath = (remote ? (
      User.appendAuth(`${Playlist.getPlaylistBackgroundsDir()}/${bgUsed}`)
    ) : (
      toxenapi.path.resolve(Playlist.getPlaylistBackgroundsDir(), bgUsed).replace(/\\/g, "/")
    ));
  }
}

interface IPlaylist {
  id?: string;
  name: string;
  background?: string;
  applyBackground?: boolean;
  songList: string[];
  songBackground?: Record<string, string>;
  lastModified?: number;
}