import React from "react";
import { resolve } from "path";
import Settings from "./Settings";
import fsp from "fs/promises";
import { Dirent } from "fs";
import { Toxen } from "../ToxenApp";
import Path from "path";

export default class Song implements ISong {
  public uid: string;
  public artist: string;
  public coArtists: string[];
  public title: string;
  public paths: ISongPaths;

  /**
   * Return the full path of the song folder.
   */
  public dirname() {
    return resolve(this.paths.dirname);
  }

  /**
   * Return the full path of the media file.
   */
  public mediaFile() {
    return resolve(this.dirname(), this.paths.media);
  }

  /**
   * React element of Song.
   */
  public Element() {
    return (
      <div key={this.uid}>
        {this.artist} - {this.title}
      </div>
    );
  }

  public static create(data: ISong) {
    let song = new Song();
    song.uid = data.uid ?? Song.generateUID();
    song.artist = data.artist;
    song.coArtists = data.coArtists;
    song.title = data.title;
    song.paths = data.paths;

    return song;
  }

  public static async buildInfoFromFolder(path: string) {
    return Promise.resolve().then(async () => {
      let info: ISong = {
        uid: Song.generateUID(),
        artist: null,
        title: null,
        coArtists: null,
        paths: {
          dirname: Path.resolve(path),
          background: null,
          media: null
        },
      };
      let dir = await fsp.opendir(path);
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isFile()) {
          switch (Path.extname(ent.name).toLowerCase()) {
            case ".mp3":
            case ".mp4":
              if (!info.paths.media) info.paths.media = ent.name;
              break;

            case ".png":
            case ".jpg":
            case ".jpeg":
            case ".gif":
            case ".webm":
              if (!info.paths.background) info.paths.background = ent.name;
              break;
            default:
              break;
          }
        }
      }

      await dir.close();
      return info;
    });
  }

  private static generateUID() {
    let items = "QWERTYUIOPASDFGHJKLZXCVBNM";
    let uid: string = "";
    do {
      for (let i = 0; i < items.length; i++) {
        uid += items[Math.floor(Math.random() * items.length)];
      }
    }
    while (Toxen.songList && !Toxen.songList.some(s => s.uid));
    return uid;
  }

  public static songList: Song[] = [];

  public static async getSongs(reload?: boolean, forEach?: (song: Song) => void): Promise<Song[]> {
    return Promise.resolve().then(async () => {
      if ((reload ?? false) && Toxen.songList) {
        return Toxen.songList;
      }
      let songs: Song[] = [];
      let dirName = Settings.get("libraryDirectory");
      if (!dirName) {
        return [];
      }
      let dir = await fsp.opendir(dirName);
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isDirectory()) { // Is music folder
          let songFolder = resolve(dirName, ent.name);

          try {
            var info: ISong = JSON.parse(await fsp.readFile(resolve(songFolder, "info.json"), "utf8"));
          } catch (error) {
            console.error("Failed to load info.json file in song: " + songFolder);
            let info = await Song.buildInfoFromFolder(songFolder)
            let s = Song.create(info);
            await s.saveInfo();

            continue;
          }

          info.paths ?? ((info.paths as any) = {})
          info.paths.dirname = songFolder;

          let song = Song.create(info);
          songs.push(song);
          if (typeof forEach === "function") forEach(song);
        }
      }

      await dir.close();
      return songs.sort();
      // return songs.sort((a, b) => a.artist.localeCompare(b.artist));
    });
  }

  public toISong(): ISong {
    return {
      uid: this.uid,
      artist: this.artist,
      title: this.title,
      coArtists: this.coArtists,
      paths: this.paths,
    }
  }

  public async saveInfo() {
    if (!this.paths || !this.paths.dirname) return null;
    return fsp.writeFile(Path.resolve(this.paths.dirname, "info.json"), JSON.stringify(this.toISong()));
  }
}

export interface ISong {
  uid: string;
  artist: string;
  coArtists: string[];
  title: string;
  paths: ISongPaths;
}

interface ISongPaths {
  /**
   * Full directory Path.
   */
  dirname: string;
  media: string;
  background: string;
}