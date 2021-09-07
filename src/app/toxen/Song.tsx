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
import System, { ToxenFile } from "./System";
import Converter from "./Converter";
import Stats from "./Statistics";
import navigator, { MediaMetadata } from "../../navigator";
import SubtitleParser from "./SubtitleParser";
//@ts-expect-error 
import ToxenMax from "../../icons/skull_max.png";
import Time from "./Time";
import { SubParser } from "showdown";

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
  public visualizerIntensity: number;
  public visualizerForceRainbowMode: boolean;
  public year: number;
  public language: string;


  private static history: Song[] = [];
  private static historyIndex = 0;
  public static getHistory(): readonly Song[] {
    return Song.history;
  }
  public static historyAdd(song: Song) {
    Song.history.splice(Song.historyIndex + 1);
    if (Song.history.length > 0 && Song.history[Song.history.length - 1] === song) return;
    Song.history.push(song);
    Song.historyIndex = Song.history.length - 1;
  }
  public static historyForward() {
    if (Song.historyIndex < Song.history.length - 1) {
      Song.historyIndex++;
      return Song.history[Song.historyIndex];
    }
    return null;
  }
  public static historyBack() {
    if (Song.historyIndex > 0) {
      Song.historyIndex--;
      return Song.history[Song.historyIndex];
    }
    return null;
  }

  /**
   * Return the full path of the song folder.
   */
  public dirname(relativePath?: string) {
    let user = Settings.getUser();
    if (Settings.isRemote() && !user) return null;
    if (Settings.isRemote()) return `${user.getUserDirectoryCollection()}/${this.uid}${relativePath ? "/" + relativePath : ""}`;
    return (this.paths && this.paths.dirname) ? resolve(Settings.get("libraryDirectory"), this.paths.dirname, relativePath ?? ".") : null;
  }

  /**
   * Return the full path of the media file.
   */
  public mediaFile() {
    if (Settings.isRemote()) return this.paths.media ? `${this.dirname()}/${this.paths.media}` : "";
    else return (this.paths && this.paths.media) ? resolve(this.dirname(), this.paths.media || "") : "";
  }

  /**
   * Return the full path of the background file.
   */
  public backgroundFile() {
    if (Settings.isRemote()) return this.paths.background ? `${this.dirname()}/${this.paths.background}` : "";
    else return (this.paths && this.paths.background) ? resolve(this.dirname(), this.paths.background || "") : "";
  }

  /**
   * Return the full path of the subtitle file.
   */
  public subtitleFile() {
    if (Settings.isRemote()) return this.paths.subtitles ? `${this.dirname()}/${this.paths.subtitles}` : "";
    else return (this.paths && this.paths.subtitles) ? resolve(this.dirname(), this.paths.subtitles || "") : "";
  }

  public readSubtitleFile() {
    return new Promise<string>((resolve, reject) => {
      if (!this.subtitleFile()) {
        resolve(null);
        return;
      }

      if (Settings.isRemote()) {
        Toxen.fetch(this.subtitleFile()).then(res => {
          if (res.status === 200) {
            resolve(res.text());
          } else {
            Toxen.error("Failed to fetch subtitles from server.");
            resolve(null);
          }
        });
      }
      else {
        fsp.readFile(this.subtitleFile(), "utf8").then(data => {
          resolve(data);
        }).catch(err => {
          Toxen.error("Failed to load subtitles from storage.");
          resolve(null);
        });
      }
    });
  }

  /**
   * Return the full path of the storyboard file.
   */
  public storyboardFile() {
    if (Settings.isRemote()) return `${this.dirname()}/${this.paths.storyboard}`;
    else return (this.paths && this.paths.storyboard) ? resolve(this.dirname(), this.paths.storyboard) : "";
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
  public Element() {
    return (
      <SongElement playing={this.isPlaying()} key={this.uid} song={this} ref={ref => this.currentElement = ref} />
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
    const keys: Exclude<keyof ISong, number>[] = [
      "uid",
      "artist",
      "title",
      "coArtists",
      "paths",
      "source",
      "tags",
      "album",
      "visualizerColor",
      "visualizerStyle",
      "visualizerIntensity",
      "visualizerForceRainbowMode",
      "year",
      "language",
    ];
    const obj = {} as any;
    keys.forEach(key => {
      obj[key] = this[key] as any;
    })
    return obj;
  }

  public static async buildInfo(fullPath: string) {
    return Promise.resolve().then(async () => {
      let info: Partial<ISong> = {
        uid: Song.generateUID(),
        // Other settings...
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
            info = await Legacy.toxen2SongDetailsToInfo(JSON.parse(await fsp.readFile(path, "utf8")), info as ISong)
          }
        } catch (error) {
          Toxen.error("There was an error trying to convert details.json into info.json");
        }
      }

      await dir.close();
      return info as ISong;
    });
  }

  public static generateUID(skipCheck = false) {
    let items = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
    let uid: string = "";
    do {
      for (let i = 0; i < 16; i++) {
        uid += items[Math.floor(Math.random() * items.length)];
      }
    }
    while (!skipCheck && Toxen.songList && !Toxen.songList.some(s => s.uid));
    return uid;
  }

  private lastBlobUrl: string;

  public async play(options?: {
    /**
     * Prevent this play from being added to the history
     */
    disableHistory?: boolean
  }) {

    // Toxen.messageCards.addMessage({
    //   content: "Playing " + this.getDisplayName(),
    //   type: "normal",
    //   expiresIn: 2000
    // });

    options ?? (options = {});
    let src = this.mediaFile();
    if (Toxen.musicPlayer.state.src != src) {
      if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
      let bg = this.backgroundFile();
      this.applySubtitles();
      if (!options.disableHistory) Song.historyAdd(this);
      Toxen.musicPlayer.setSource(src, true);
      await Toxen.background.setBackground(bg);
      Stats.set("songsPlayed", (Stats.get("songsPlayed") ?? 0) + 1)
      Toxen.setAllVisualColors(this.visualizerColor);
      Toxen.background.storyboard.setSong(this);
      Toxen.background.visualizer.update();
      let img = new Image();
      img.src = Toxen.background.getBackground() || ToxenMax;
      console.log(img);
      this.setCurrent();
      const addToMetadata = (blob?: Blob) => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.title ?? "Unknown Title",
          artist: this.artist ?? "Unknown Artist",
          album: this.album ?? "",
          artwork: blob ? [
            { src: (this.lastBlobUrl = URL.createObjectURL(blob)), sizes: `${img.naturalWidth}x${img.naturalHeight}`, type: "image/png" }
          ] : undefined
        });
      }

      if (Toxen.getSupportedImageFiles().includes(Path.extname(bg).toLowerCase())) {
        const onLoad = () => {
          let canvas = document.createElement("canvas");
          let ctx = canvas.getContext("2d");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          try { ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight); } catch (error) {
            console.error(error);
            return addToMetadata();
          }
          canvas.toBlob(addToMetadata);
        }
        img.addEventListener("load", onLoad);
      }
      else addToMetadata();
    }
  }
  async applySubtitles() {
    let subFile = this.subtitleFile();
    if (subFile) {
      if (Settings.isRemote()) {
        throw new Error("Remote playback does not support subtitles.");
      }
      else {
        let subs: SubtitleParser.SubtitleArray = null;
        const supported = Toxen.getSupportedSubtitleFiles();
        const type = Path.extname(subFile);
        const data = await this.readSubtitleFile();
        if (supported.includes(type)) {
          const subParsers = {
            ".srt": SubtitleParser.parseSrt,
            ".tst": SubtitleParser.parseTst
          };
          subs = (subParsers as any)[type] ? (subParsers as any)[type](data) : null;
        }
        Toxen.subtitles.setSubtitles(subs);
      }
    }
    else Toxen.subtitles.setSubtitles(null);
  }

  public static sortSongs(songs: Song[], by: "artist" | "title" | "album" = "artist") {
    switch (by) {
      case "artist":
        return songs.sort((a, b) => a.artist && b.artist ? a.artist.localeCompare(b.artist) : -1);
      case "title":
        return songs.sort((a, b) => a.title && b.title ? a.title.localeCompare(b.title) : -1);
      case "album":
        return songs.sort((a, b) => a.album && b.album ? a.album.localeCompare(b.album) : -1);
    }
  }

  public static clearQueue() {
    Toxen.songQueue.forEach(s => s.inQueue = false);
    Toxen.songQueue = [];
    Toxen.updateSongPanels();
  }

  public addToQueue() {
    Toxen.songQueue.push(this);
    this.inQueue = true;
    // if (this.isPlaying()) this._isPlaying = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Song.sortSongs(Toxen.songQueue);
  }

  public removeFromQueue() {
    let id = Toxen.songQueue.findIndex(s => s == this);
    if (id != -1) Toxen.songQueue.splice(id, 1);
    this.inQueue = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Toxen.songQueue;
  }

  public inQueue: boolean = false;

  public contextMenu(opts?: {
    noQueueOption?: boolean
  }) {
    opts ?? (opts = {});
    const menu: Electron.MenuItemConstructorOptions[] = [
      {
        label: this.getDisplayName(),
        enabled: false
      },
      {
        label: "Edit info",
        click: () => {
          Toxen.editSong(this);
        }
      },
      !opts.noQueueOption ? (this.inQueue ? {
        label: "Remove from queue",
        click: () => this.removeFromQueue()
      } : {
        label: "Add to queue",
        click: () => this.addToQueue()
      }) : undefined,
      {
        label: "Show song in list",
        click: async () => {
          await Toxen.sidePanel.show(true);
          await Toxen.sidePanel.setSectionId("songPanel");
          this.scrollTo();
        }
      },
      {
        type: "separator"
      },
      {
        label: "Toxen",
        enabled: false
      },
      {
        label: "Toggle fullscreen",
        click: () => {
          Toxen.toggleFullscreen();
        }
      }
    ].filter(a => a) as Electron.MenuItemConstructorOptions[];
    remote.Menu.buildFromTemplate(menu).popup();
  }

  public existingElements: SongElement[] = [];
  /**
   * Remove the top element from the list of existing elements.
   */
  public popExistingElement() {
    return this.existingElements.pop();
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
    let songs = (Toxen.getAllSongs() || []);
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
    if (Settings.isRemote()) {
      let user = Settings.getUser();
      if (!user) {
        return 0;
      }
      let iSongs: ISong[] = await Toxen.fetch(user.getUserDirectoryCollection()).then(res => res.json()).catch(() => []);
      return iSongs.length;
    }
    else {
      return fsp.readdir(dirName, { withFileTypes: true }).then(files => files.filter(ent => ent.isDirectory()).length).catch(() => 0);
    }
  }

  public static async getSongs(reload?: boolean, forEach?: (song: Song) => void): Promise<Song[]> {
    if (Settings.isRemote()) {
      let user = Settings.getUser();
      if (!user) {
        return [];
      }
      let iSongs: ISong[] = await Toxen.fetch(user.getUserDirectoryCollection()).then(res => res.json());
      const songs: Song[] = iSongs.map(iSong => Song.create(iSong));
      if (forEach) {
        songs.forEach(forEach);
      }
      return Song.sortSongs(songs);
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
        Toxen.error(error);

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
      return Song.sortSongs(songs);
    });
  }

  public async saveInfo(): Promise<void> {
    if (Settings.isRemote()) {
      let info = this.toISong();
      let user = Settings.getUser();
      if (!user) {
        return;
      }
      return await Toxen.fetch(user.getUserDirectoryCollection() + "/" + this.uid + "/info.json", {
        method: "PUT",
        body: JSON.stringify(info),
        headers: {
          "Content-Type": "application/json"
        }
      }).then(() => {
        Toxen.notify({
          title: "Song saved",
          content: this.getDisplayName(),
          expiresIn: 3000
        });
      }).catch(error => {
        console.error(error);
        Toxen.notify({
          title: "Failed to save Song",
          content: this.getDisplayName(),
          expiresIn: 5000,
          type: "error"
        });
      });
    }
    if (!this.paths || !this.paths.dirname) return;
    try {
      await fsp.writeFile(Path.resolve(this.dirname(), "info.json"), JSON.stringify(this.toISong()));
      Toxen.notify({
        title: "Song saved",
        content: this.getDisplayName(),
        expiresIn: 3000
      });
    } catch (error) {
      Toxen.notify({
        title: "Failed to save Song",
        content: this.getDisplayName(),
        expiresIn: 5000,
        type: "error"
      });
    }
  }

  public static async importSong(file: File | ToxenFile): Promise<Result<void>> {
    return Promise.resolve().then(async () => {
      let supported = Toxen.getSupportedMediaFiles();
      if (!supported.some(s => Path.extname(file.name) === s)) return new Failure(file.name + " isn't a valid file");

      let libDir = Settings.get("libraryDirectory");
      let nameNoExt = Converter.trimChar(Path.basename(file.name, Path.extname(file.name)), ".");
      let newFolder = Path.resolve(libDir, nameNoExt);
      let increment = 0;
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
  visualizerIntensity: number;
  visualizerForceRainbowMode: boolean;
  paths: ISongPaths;
  year: number;
  language: string;
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