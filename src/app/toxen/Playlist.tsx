import Settings from "./Settings";
import Song from "./Song";
// import fsp from "fs/promises";
// import fs from "fs";
import { Toxen } from "../ToxenApp";
// import Path from "path";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import React from "react";
import { Button, Stack } from "@mantine/core";
import System, { ToxenFile } from "./System";
import User from "./User";
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

    return pl;
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

  public static async saveRemote() {
    await Toxen.fetch(Settings.getUser().getPlaylistsPath(), {
      method: "PUT",
      body: Playlist.toString(),
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  public touch() {
    this.lastModified = Date.now();
  }

  public static async syncPlaylists() {
    if (Settings.isRemote()) return;
    if (!toxenapi.isDesktop()) return;

    try {
      Toxen.log("Syncing playlists...", 2000);

      // Collect local background filenames
      const playlistBackgroundsDir = Playlist.getLocalPlaylistBackgroundsDir();
      let localBackgrounds: string[];
      try {
        localBackgrounds = toxenapi.fs.readdirSync(playlistBackgroundsDir);
      } catch {
        localBackgrounds = [];
      }

      // Build sync input
      const localPlaylists: IPlaylist[] = (Toxen.playlists ?? []).map(pl => ({
        id: pl.id,
        name: pl.name,
        background: pl.background,
        applyBackground: pl.applyBackground,
        songBackground: pl.songBackground,
        songList: [...new Set(pl.songList.map(s => s.uid))],
        lastModified: pl.lastModified,
      }));

      // POST to sync endpoint
      const syncUrl = `${Settings.getUser().getPlaylistsPath()}/sync`;
      const res = await Toxen.fetch(syncUrl, {
        method: "POST",
        body: JSON.stringify({ playlists: localPlaylists, localBackgrounds }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Sync failed");
      }

      const result = await res.json();

      // Upload backgrounds the server needs
      const bgDir = Playlist.getLocalPlaylistBackgroundsDir();
      for (const bg of result.backgroundsToUpload) {
        const fileData = await toxenapi.fs.promises.readFile(toxenapi.path.join(bgDir, bg));
        await Toxen.fetch(`${Settings.getUser().getPlaylistsPath()}/${bg}`, {
          method: "PUT",
          body: fileData,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }

      // Download backgrounds the client needs
      const ensuredBgDir = Playlist.getLocalPlaylistBackgroundsDir(true);
      for (const bg of result.backgroundsToDownload) {
        const bgRes = await Toxen.fetch(`${Settings.getUser().getPlaylistsPath()}/${bg}`);
        if (bgRes.ok) {
          const buffer = await bgRes.arrayBuffer();
          await toxenapi.fs.promises.writeFile(
            toxenapi.path.join(ensuredBgDir, bg),
            Buffer.from(buffer)
          );
        }
      }

      // Apply merged playlists locally
      const mergedPlaylists = (result.mergedPlaylists as IPlaylist[]).map(pl => Playlist.create(pl));
      Toxen.playlists = mergedPlaylists.sort((a, b) => a.name.localeCompare(b.name));

      // Save locally (without pushing back to remote, since server already has the merged result)
      localStorage.setItem("playlists-backup", Playlist.toString());
      if (toxenapi.isDesktop()) {
        toxenapi.fs.writeFileSync(Playlist.filePath, Playlist.toString());
      }

      // Refresh UI
      Toxen.playlistPanel?.update();

      const uploaded = result.backgroundsToUpload.length;
      const downloaded = result.backgroundsToDownload.length;
      Toxen.log(`Playlists synced (${uploaded} bg uploaded, ${downloaded} bg downloaded)`, 3000);
    } catch (error) {
      Toxen.error(`Failed to sync playlists: ${error.message}`, 5000);
    }
  }
  
  /**
   * Save Toxen's current playlists.
   */
  public static async save() {
    console.log("Saving playlists...");
    localStorage.setItem("playlists-backup", Playlist.toString());

    if (Settings.isRemote()) {
      // Remote server
      await Playlist.saveRemote();
    }
    else {
      if (toxenapi.isDesktop()) {
        try {
          toxenapi.fs.writeFileSync(Playlist.filePath, Playlist.toString());
        } catch (error) {
          Toxen.error(error);
        }
        // Sync on edit: push playlist changes to remote server
        if (Settings.get("remoteSyncOnSongEdit") && User.getCurrentUser()?.premium) {
          Playlist.syncPlaylists();
        }
      }
    }
  }

  /**
   * Save Toxen's playlists from `filePath`.
   */
  public static async load(): Promise<Playlist[]> {
    return Promise.resolve().then(async () => {
      if (Settings.isRemote()) {
        // Remote server
        if (!(await Toxen.fetch(Settings.getUser().getPlaylistsPath()
        ).then((r) => r.ok).catch(() => false))) {
          await Playlist.save();
        }
        try {
          let iPlaylists: IPlaylist[] = await Toxen.fetch(Settings.getUser().getPlaylistsPath()).then(r => r.json()).catch(() => [] as any);
          let playlists: Playlist[] = iPlaylists.map(pl => Playlist.create(pl));
          return playlists;
        } catch (error) {
          Toxen.error("Unable to parse playlists file.\nPlaylists have been reset.");
          Playlist.save();
          return [];
        }
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
            // Sort that shit
            return playlists.sort((a, b) => a.name.localeCompare(b.name));
          } catch (error) {
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
        else {
          toxenapi.throwDesktopOnly("Loading playlists is not available on web version");
        }
      }
    })
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
        songList: [... new Set(pl.songList.map(s => s.uid))],
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
        
        toxenapi.fs.copyFileSync(files[0].path, toxenapi.path.join(playlistBackgroundsDir, randomizedName));
  
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
              leftSection={<i className="fas fa-file-import"></i>}
              onClick={promptImage}
            >Set background</Button>
            <Button
              color="red"
              leftSection={<i className="fas fa-trash"></i>}
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