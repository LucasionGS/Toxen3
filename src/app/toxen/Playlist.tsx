import Settings from "./Settings";
import Song from "./Song";
import fsp from "fs/promises";
import fs from "fs";
import CrossPlatform from "./CrossPlatform";
import { Toxen } from "../ToxenApp";
import Path from "path";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import React from "react";
import { Button, Stack } from "@mantine/core";
import System, { ToxenFile } from "./System";
import * as remote from "@electron/remote";

export default class Playlist {
  private constructor() { }

  // public static playlists: Playlist[];
  public name: string;
  public background?: string;
  public applyBackground?: boolean;
  public songList: Song[];
  public songBackground?: Record<string, string>;

  public static create(data: IPlaylist, compareToSongObject?: { [uid: string]: Song }) {
    let pl = new Playlist();
    pl.name = data.name;
    pl.background = data.background;
    pl.applyBackground = data.applyBackground ?? false;
    pl.songBackground = data.songBackground ?? {};
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
    return Path.resolve(Settings.get("libraryDirectory"), "playlists.json");
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

  public static async syncToRemote() {
    if (!Settings.isRemote()) return;
    await Playlist.saveRemote();
    // Upload all song backgrounds and playlist backgrounds
    const playlistBackgroundsDir = Playlist.getLocalPlaylistBackgroundsDir();
    
    // Upload playlist backgrounds
    const playlistBackgrounds = fs.readdirSync(playlistBackgroundsDir);
    for (const bg of playlistBackgrounds) {
      const ext = Path.extname(bg);
      const formData = new FormData();
      formData.append("file", new Blob([await fs.promises.readFile(Path.join(playlistBackgroundsDir, bg))], { type: `image/${ext}` }), bg);
      
      await Toxen.fetch(`${Settings.getUser().getPlaylistsPath()}/${bg}`, {
        method: "PUT",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
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
      try {
        // let ws = fs.createWriteStream(Playlist.filePath);
        // ws.write(Buffer.from(Playlist.toString()));
        // ws.close();
        fs.writeFileSync(Playlist.filePath, Playlist.toString());
      } catch (error) {
        Toxen.error(error);
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
          let iPlaylists: IPlaylist[] = await Toxen.fetch(Settings.getUser().getPlaylistsPath()).then(r => r.json()).catch(() => []);
          let playlists: Playlist[] = iPlaylists.map(pl => Playlist.create(pl));
          return playlists;
        } catch (error) {
          Toxen.error("Unable to parse playlists file.\nPlaylists have been reset.");
          Playlist.save();
          return [];
        }
      }
      else {
        // Local
        if (!(await fsp.stat(Playlist.filePath).then(() => true).catch(() => false))) {
          await Playlist.save();
        }
        try {
          let data = await fsp.readFile(Playlist.filePath, "utf8");
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
        name: pl.name,
        background: pl.background,
        applyBackground: pl.applyBackground,
        songBackground: pl.songBackground,
        songList: [... new Set(pl.songList.map(s => s.uid))]
      }
    });
    return JSON.stringify(playlists, null, 2);
  }

  public async addSong(song: Song): Promise<void>;
  public async addSong(...songs: Song[]): Promise<void>;
  public async addSong(...songs: Song[]): Promise<void> {
    // const existingUIDs = this.songList.map(s => s.uid);
    // songs = songs.filter(s => !existingUIDs.includes(s.uid));
    songs = songs.filter(s => !this.songList.includes(s));
    this.songList.push(...songs);
    this.songList = Song.sortSongs(this.songList);
    if (Toxen.sidePanel.getSectionId() === "songPanel" && Toxen.playlist === this) Toxen.reloadSection();
  }

  public async removeSong(song: Song): Promise<void>;
  public async removeSong(...songs: Song[]): Promise<void>;
  public async removeSong(...songs: Song[]): Promise<void> {
    this.songList = this.songList.filter(s => !songs.includes(s));
    if (Toxen.sidePanel.getSectionId() === "songPanel" && Toxen.playlist === this) Toxen.reloadSection(); await Playlist.save();
  }

  public promptSetBackground(modals: ModalsContextProps, song?: Song) {
    const promptImage = () => {
      let paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
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
        name: Path.basename(p),
        path: p
      }));

      const playlistBackgroundsDir = Playlist.getPlaylistBackgroundsDir(true);
      let randomizedName: string;
      do {
        randomizedName = System.randomString(16) + Path.extname(files[0].name);
      } while (fs.existsSync(Path.join(playlistBackgroundsDir, randomizedName)));
      
      fs.copyFileSync(files[0].path, Path.join(playlistBackgroundsDir, randomizedName));

      if (song) {
        if (!this.songBackground) this.songBackground = {};
        if (this.songBackground[song.uid]) {
          fs.unlinkSync(Path.join(playlistBackgroundsDir, this.songBackground[song.uid]));
        }
        this.songBackground[song.uid] = randomizedName;
      }
      else {
        if (this.background) {
          fs.unlinkSync(Path.join(playlistBackgroundsDir, this.background));
        }
        this.background = randomizedName;
      }
      
      
      Playlist.save();
      Toxen.playlistPanel.update();
      modals.closeModal(modalId);
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

  public removeBackground(song?: Song) {
    if (song) {
      if (!this.songBackground) this.songBackground = {};
      if (this.songBackground[song.uid]) {
        fs.unlinkSync(Path.join(Playlist.getPlaylistBackgroundsDir(), this.songBackground[song.uid]));
        delete this.songBackground[song.uid];
      }
    }
    else {
      if (this.background) {
        fs.unlinkSync(Path.join(Playlist.getPlaylistBackgroundsDir(), this.background));
        this.background = null;
      }
    }
    Playlist.save();
  }
  
  public static getLocalPlaylistBackgroundsDir(ensureExisting = false) {
    const playlistBackgroundsDir = Path.resolve(Settings.get("libraryDirectory"), ".playlistBackgrounds");
    if (ensureExisting && !fs.existsSync(playlistBackgroundsDir)) fs.mkdirSync(playlistBackgroundsDir);
    return playlistBackgroundsDir;
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
    const songId = Toxen.background.storyboard.state.song?.uid;
    const songBg = onlyGlobal ? null : this.songBackground[songId];
    const bgUsed = songBg ?? this.background;

    if (!songBg && (!this.applyBackground && !ignoreApply)) return null;
    
    if (bgUsed === this._cachedBackgroundName) return this._cachedBackgroundPath;
    console.log("Getting background path");
    if (!bgUsed) return null;
    this._cachedBackgroundName = bgUsed;
    return this._cachedBackgroundPath = remote ? (
      `${Playlist.getPlaylistBackgroundsDir()}/${bgUsed}`
    ) : (
      Path.resolve(Playlist.getPlaylistBackgroundsDir(), bgUsed).replace(/\\/g, "/")
    );
  }
}

interface IPlaylist {
  name: string;
  background?: string;
  applyBackground?: boolean;
  songList: string[];
  songBackground?: Record<string, string>;
}