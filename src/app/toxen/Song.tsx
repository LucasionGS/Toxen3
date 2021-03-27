import React from "react";
import { resolve } from "node:path";

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