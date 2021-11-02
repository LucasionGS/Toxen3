import Settings from "./Settings";
import Song from "./Song";
import fsp from "fs/promises";
import fs from "fs";
import CrossPlatform from "./CrossPlatform";
import { Toxen } from "../ToxenApp";
import Path from "path";

export default class Playlist {
  private constructor() { }

  // public static playlists: Playlist[];
  public name: string;
  public songList: Song[];

  public static create(data: IPlaylist, compareToSongObject?: { [uid: string]: Song }) {
    let pl = new Playlist();
    pl.name = data.name;
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
  /**
   * Save Toxen's current playlists.
   */
  public static async save() {
    console.log("Saving playlists...");

    if (Settings.isRemote()) {
      // Remote server
      // new Error("Saving playlists remotely not yet implemented");
      console.log(
        JSON.stringify(
          Toxen.playlists
        )
      );

      await Toxen.fetch(Settings.getUser().getPlaylistsPath(), {
        method: "PUT",
        body: JSON.stringify(Toxen.playlists),
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    else {
      try {
        let ws = fs.createWriteStream(Playlist.filePath);
        ws.write(Buffer.from(Playlist.toString()));
        ws.close();
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
          return playlists;
        } catch (error) {
          Toxen.error("Unable to parse playlists file.\nPlaylists have been reset.");
          Playlist.save();
          return [];
        }
      }
    })
  }

  public static getCurrent() {
    return Toxen.playlist;
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
        songList: [... new Set(pl.songList.map(s => s.uid))]
      }
    });
    return JSON.stringify(playlists, null, 2);
  }

  public addSong(song: Song): void;
  public addSong(...songs: Song[]): void;
  public addSong(...songs: Song[]): void {
    const existingUIDs = this.songList.map(s => s.uid);
    songs = songs.filter(s => !existingUIDs.includes(s.uid));
    this.songList.push(...songs);
    this.songList = Song.sortSongs(this.songList);
    if (Toxen.sidePanel.getSectionId() === "songPanel") Toxen.reloadSection();
    Playlist.save();
  }

  public removeSong(song: Song): void;
  public removeSong(...songs: Song[]): void;
  public removeSong(...songs: Song[]): void {
    this.songList = this.songList.filter(s => !songs.includes(s));
    if (Toxen.sidePanel.getSectionId() === "songPanel") Toxen.reloadSection();
    Playlist.save();
  }
}

interface IPlaylist {
  name: string;
  songList: string[];
}