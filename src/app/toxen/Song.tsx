import React from "react";
import { resolve } from "path";
import Settings, { VisualizerStyle } from "./Settings";
import fsp from "fs/promises";
import { Dir, Dirent } from "fs";
import { Toxen } from "../ToxenApp";
import Path from "path";
import SongElement from "../components/SongPanel/SongElement";
import Legacy from "./Legacy";
import Debug from "./Debug";
import { remote } from "electron";
import { Failure, Result, Success } from "./Result";
import System from "./System";

declare class MediaMetadata {
  constructor(object: {
    title: string;
    artist: string;
    album: string;
    artwork: { src: string, sizes: string, type: string }[];
  });
}

export default class Song implements ISong {
  public uid: string;
  public artist: string;
  public coArtists: string[];
  public title: string;
  public album: string;
  public source: string;
  public tags: string[];
  public paths: ISongPaths;
  public visualizerColor: string;
  public visualizerStyle: VisualizerStyle;


  /**
   * Return the full path of the song folder.
   */
  public dirname(relativePath?: string) {
    // if (Settings.isRemote()) `${Settings.get("libraryDirectory")}/${this.paths.dirname}`;
    // else
    return this.paths && this.paths.dirname ? resolve(Settings.get("libraryDirectory"), this.paths.dirname, relativePath ?? ".") : null;
  }

  /**
   * Return the full path of the media file.
   */
  public mediaFile() {
    if (Settings.isRemote())`${this.dirname()}/${this.paths.media}`;
    else return this.paths && this.paths.media ? resolve(this.dirname(), this.paths.media) : null;
  }

  /**
   * Return the full path of the media file.
   */
  public backgroundFile() {
    if (Settings.isRemote())`${this.dirname()}/${this.paths.background}`;
    else return this.paths && this.paths.background ? resolve(this.dirname(), this.paths.background) : "";
  }

  public getDisplayName() {
    return (
      ((this.artist ?? ((this.coArtists && this.coArtists[0]) ? this.coArtists[0] : null)) ?? "Unknown Artist") // Artist
      + " - " +
      (this.title ?? "Unknown Title") // Title
    );
  }

  /**
   * React element of Song.
   */
  public Element(): JSX.Element;
  public Element(getRef: (ref: SongElement) => void): JSX.Element;
  public Element(getRef?: (ref: SongElement) => void) {
    return (
      <SongElement playing={this.isPlaying()} key={this.uid} song={this} getRef={getRef} ref={ref => this.currentElement = ref} />
    );
  }

  public static create(data: Partial<ISong>) {
    let song = new Song();
    
    for (const key in data) {
      if (key in data) {
        const v = (data as any)[key];
        (song as any)[key] = v;
      }
    }
    song.uid = data.uid ?? Song.generateUID();

    return song;
  }

  public toISong(): ISong {
    return {
      uid: this.uid,
      artist: this.artist,
      title: this.title,
      coArtists: this.coArtists,
      paths: this.paths,
      source: this.source,
      tags: this.tags,
      album: this.album,
      visualizerColor: this.visualizerColor,
      visualizerStyle: this.visualizerStyle,
    }
  }

  public static async buildInfo(fullPath: string) {
    return Promise.resolve().then(async () => {
      let info: ISong = {
        uid: Song.generateUID(),
        artist: null,
        title: null,
        album: null,
        coArtists: null,
        source: null,
        tags: null,
        visualizerColor: null,
        visualizerStyle: null,
        paths: {
          dirname: null,
          background: null,
          media: null,
          subtitles: null,
          storyboard: null,
        },
      };
      const dir = await fsp.opendir(fullPath);
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isFile()) {
          let ext = Path.extname(ent.name).toLowerCase();
          switch (ext) {
            case ".mp3":
            case ".mp4":
              if (!info.paths.media || info.paths.media.toLowerCase().endsWith(".mp3")) info.paths.media = ent.name;
              if (!info.title && !info.artist) {
                const name = Path.basename(ent.name, Path.extname(ent.name))
                if (ent.name.indexOf(" - ") > -1) {
                  let [artist, title] = name.split(" - ");

                  info.artist = artist;
                  info.title = title;
                }
                else {
                  info.title = name;
                }
              }

              break;

            case ".png":
            case ".jpg":
            case ".jpeg":
            case ".gif":
            case ".webm":
              if (!info.paths.background) info.paths.background = ent.name;
              break;
            
            case ".srt":
              if (!info.paths.subtitles) info.paths.subtitles = ent.name;
              break;
            
            case ".tsb":
              if (!info.paths.storyboard) info.paths.storyboard = ent.name;
              break;
          }
        }

        // Toxen2 backwards compatibility.
        try {
          if (await fsp.stat(Path.resolve(fullPath, "details.json")).then(() => true).catch(() => false)) {
            let path = Path.resolve(fullPath, "details.json");
            info = await Legacy.toxen2SongDetailsToInfo(JSON.parse(await fsp.readFile(path, "utf8")), info)
          }
        } catch (error) {
          console.error("There was an error trying to convert details.json into info.json");
        }
      }

      await dir.close();
      return info;
    });
  }

  public static generateUID(skipCheck = false) {
    let items = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
    let uid: string = "";
    do {
      for (let i = 0; i < items.length; i++) {
        uid += items[Math.floor(Math.random() * items.length)];
      }
    }
    while (!skipCheck && Toxen.songList && !Toxen.songList.some(s => s.uid));
    return uid;
  }

  private lastBlobUrl: string;

  public play() {
    if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
    let src = this.mediaFile();
    let bg = this.backgroundFile();
    if (Toxen.musicPlayer.state.src != src) {
      Toxen.musicPlayer.setSource(src, true);
      Toxen.background.setBackground(bg);
      Toxen.setAllVisualColors(this.visualizerColor);
      Toxen.background.storyboard.setSong(this);
      Toxen.background.visualizer.update();
      let img = new Image();
      img.src = bg;
      img.addEventListener("load", () => {
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        canvas.toBlob(blob => {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: this.title ?? "Unknown Title",
            artist: this.artist ?? "Unknown Artist",
            album: this.album ?? "",
            artwork: [
              { src: (this.lastBlobUrl = URL.createObjectURL(blob)), sizes: `${img.naturalWidth}x${img.naturalHeight}`, type: "image/png" }
            ]
          });
        });
      });
    }

    this.setCurrent();
  }

  public contextMenu() {
    remote.Menu.buildFromTemplate([
      {
        label: "Edit info",
        click: () => {
          Toxen.editSong(this);
        }
      }
    ]).popup();
  }

  public currentElement: SongElement;

  public setCurrent(): void;
  public setCurrent(force: boolean): void;
  public setCurrent(force?: boolean) {
    const mode = force ?? true;
    if (!this._isPlaying && mode) {
      let cur = Song.getCurrent();
      if (cur) cur.setCurrent(false);
    }
    this._isPlaying = mode;
    if (this.currentElement) this.currentElement.setState({ playing: mode });
  }

  public scrollTo() {
    if (this.currentElement) (this.currentElement.divElement as any).scrollIntoViewIfNeeded();
  }

  public static getCurrent() {
    let songs = (Toxen.songList || []);
    return songs.find(s => s.isPlaying());
  }

  public isPlaying() {
    return this._isPlaying;
  }

  private _isPlaying = false;

  public static async getSongCount() {
    let dirName = Settings.get("libraryDirectory");
    if (!dirName) {
      return 0;
    }
    return (await fsp.readdir(dirName, { withFileTypes: true })).filter(ent => ent.isDirectory()).length;
  }

  public static async getSongs(reload?: boolean, forEach?: (song: Song) => void): Promise<Song[]> {
    if (Settings.isRemote()) {

    }
    else return Promise.resolve().then(async () => {
      if (reload !== true && Toxen.songList) {
        return Toxen.songList;
      }

      let songs: Song[] = [];
      let dirName = Settings.get("libraryDirectory");
      if (!dirName) {
        return [];
      }
      let dir: Dir;
      try {
        dir = await fsp.opendir(dirName);
      } catch (error) {
        console.error(error);

        return [];
      }
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isDirectory()) { // Is music folder
          let songFolder = resolve(dirName, ent.name);

          try {
            var info: ISong = JSON.parse(await fsp.readFile(resolve(songFolder, "info.json"), "utf8"));
          } catch (error) {
            console.error("Failed to load info.json file in song: " + songFolder);
            info = await Song.buildInfo(songFolder);
            let s = Song.create(info);
            await s.saveInfo();
          }

          info.paths ?? ((info.paths as any) = {})
          let isDifferent = info.paths.dirname !== ent.name;
          if (isDifferent) info.paths.dirname = ent.name;


          if (info.paths.media) {
            let song = Song.create(info);
            songs.push(song);
            if (isDifferent) song.saveInfo();
            if (typeof forEach === "function") forEach(song);
          }
          else {
            if (typeof forEach === "function") forEach(null);
            console.warn(`Song "${songFolder}" is missing a media file. Excluding from song list.`);
          }
        }
      }

      await dir.close();
      return songs.sort((a, b) => a.artist && b.artist ? a.artist.localeCompare(b.artist) : -1);
    });
  }

  public async saveInfo() {
    if (!this.paths || !this.paths.dirname) return null;
    return fsp.writeFile(Path.resolve(this.dirname(), "info.json"), JSON.stringify(this.toISong()));
  }

  public static async importSong(file: File): Promise<Result<void>> {
    return Promise.resolve().then(async () => {
      let supported = Toxen.getSupportedMediaFiles();
      if (!supported.some(s => Path.extname(file.name) === s)) return new Failure(file.name + " isn't a valid file");

      let libDir = Settings.get("libraryDirectory");
      let nameNoExt = Path.basename(file.name, Path.extname(file.name));
      let newFolder = Path.resolve(libDir, nameNoExt);
      let increment = 0;
      debugger;
      while (await System.pathExists(newFolder)) {
        newFolder = Path.resolve(libDir, nameNoExt + ` (${++increment})`);
      }

      await fsp.mkdir(newFolder, { recursive: true });
      await fsp.copyFile(file.path, Path.resolve(newFolder, file.name));
      
      return new Success();
    });
  }
}

export interface ISong {
  uid: string;
  artist: string;
  coArtists: string[];
  title: string;
  album: string;
  source: string;
  tags: string[];
  visualizerColor: string;
  visualizerStyle: VisualizerStyle;
  paths: ISongPaths;
}

interface ISongPaths {
  /**
   * Directory basename.
   */
  dirname: string;
  /**
   * A supported audio/video file.
   */
  media: string;
  /**
   * A supported image file.
   */
  background: string;
  /**
   * A supported subtitle file.
   */
  subtitles: string;
  /**
   * A *.tsb (Toxen Storyboard) file. Actual format is JSON data.
   */
  storyboard: string;
}