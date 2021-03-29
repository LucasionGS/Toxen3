import React from "react";
import { resolve } from "node:path";
import Settings from "./Settings";
import fsp from "fs/promises";

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
      <div>
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

  public static async getSongs(): Promise<Song[]> {
    return Promise.resolve().then(() => {
      let songs: Song[];

      let dir = fsp.opendir(Settings.get("libraryDirectory"));
      
      return songs;
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