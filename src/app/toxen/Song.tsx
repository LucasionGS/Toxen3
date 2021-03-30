import React from "react";
import { resolve } from "path";
import Settings from "./Settings";
import fsp from "fs/promises";
import { Dirent } from "fs";
import { Toxen } from "../ToxenApp";

export default class Song implements ISong {
  public id: number;
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
      <div key={this.id}>
        {this.artist} - {this.title}
      </div>
    );
  }

  public static create(data: ISong) {
    let song = new Song();
    song.id = data.id ?? Song.generateId();
    song.artist = data.artist;
    song.coArtists = data.coArtists;
    song.title = data.title;
    song.paths = data.paths;

    return song;
  }

  private static generateId() {
    let list = Song.songList.map(t => t).sort((a, b) => a.id - b.id);
    let last = list.length > 0 ? list[0] : null;
    if (last) {
      return last.id + 1;
    }

    return 1;
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
            
            continue;
          }
          
          let song = Song.create(info);
          songs.push(song);
          if (typeof forEach === "function") forEach(song);
        }
      }

      await dir.close();
      return songs.sort((a, b) => a.id - b.id);
    });
  }
}

export interface ISong {
  id: number;
  artist: string;
  coArtists: string[];
  title: string;
  paths: ISongPaths;
}

interface ISongPaths {
  dirname: string;
  media: string;
  background: string;
}