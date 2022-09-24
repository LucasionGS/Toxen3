import React, { useMemo, useState } from "react";
import { resolve } from "path";
import Settings, { VisualizerStyle } from "./Settings";
import fsp from "fs/promises";
import { Dir, Dirent, createReadStream, createWriteStream } from "fs";
import { Toxen } from "../ToxenApp";
import Path from "path";
import SongElement from "../components/SongPanel/SongElement";
import Legacy, { Toxen2SongDetails } from "./Legacy";
import { remote } from "electron";
import { Failure, Result, Success } from "./Result";
import System, { ToxenFile } from "./System";
import Converter from "./Converter";
import Stats from "./Statistics";
// import navigator, { MediaMetadata } from "../../navigator";
import SubtitleParser from "./SubtitleParser";
//@ts-expect-error 
import ToxenMax from "../../icons/skull_max.png";
import ScreenRecorder from "./ScreenRecorder";
import yazl from "yazl";
import yauzl from "yauzl";
import os from "os";
import { useModals } from "@mantine/modals";
import { ModalsContextProps, ModalSettings } from "@mantine/modals/lib/context";
import { Checkbox, Menu, RangeSlider, Button, Progress } from "@mantine/core";
import Playlist from "./Playlist";
import TButton from "../components/Button/Button";
import Ffmpeg from "./Ffmpeg";
import Time from "./Time";
import StoryboardParser from "./StoryboardParser";
// import ToxenInteractionMode from "./ToxenInteractionMode";

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
  /**
   * `pulse` is forced pulsing.  
   * `pulse-off` is forced no pulsing.  
   * `null` will use the global setting.
   */
  public visualizerPulseBackground: "pulse" | "pulse-off" = null;
  public year: number;
  public language: string;
  public subtitleDelay: number;

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

  public async getToxen2Details(): Promise<Toxen2SongDetails> {
    if (Settings.isRemote()) {
      Toxen.error("Toxen2 migration is not supported on remote library.");
      return null;
    }
    try {
      return JSON.parse(await fsp.readFile(this.dirname("details.json"), "utf8"));
    } catch (error) {
      return null;
    }
  }

  /**
   * Return the full path of the song folder.
   */
  public dirname(relativePath?: string) {
    let user = Settings.getUser();
    if (Settings.isRemote() && !user) return null;
    if (Settings.isRemote()) return `${user.getUserCollectionPath()}/${this.uid}${relativePath ? "/" + relativePath : ""}`;
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
          // Replace dumb characters
          data = data
            .replace(/\r\n/g, "\n")
            .replace(/‚/g, ",") // Why the fuck are these two characters different?
            ;

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

  public readStoryboardFile() {
    return new Promise<StoryboardParser.StoryboardConfig>((resolve, reject) => {
      if (!this.storyboardFile()) {
        resolve(null);
        return;
      }

      if (Settings.isRemote()) {
        Toxen.fetch(this.storyboardFile()).then(async res => {
          if (res.status === 200) {
            resolve(StoryboardParser.parseStoryboard(await res.text()));
          } else {
            Toxen.error("Failed to fetch storyboard from server.");
            resolve(null);
          }
        });
      }
      else {
        fsp.readFile(this.storyboardFile(), "utf8").then(data => {
          resolve(StoryboardParser.parseStoryboard(data));
        }).catch(err => {
          Toxen.error("Failed to load storyboard from storage.");
          resolve(null);
        });
      }
    });
  }

  public async applyStoryboard() {
    let storyboard = await this.readStoryboardFile();
    if (!storyboard) return StoryboardParser.setStoryboard(null);

    StoryboardParser.setStoryboard(storyboard);
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

  public set selected(v) {
    if (this.currentElement) this.currentElement.select(v);
  }

  public get selected() {
    return this.currentElement ? this.currentElement.state.selected : false;
  }

  public select(force?: boolean) {
    if (this.currentElement) this.currentElement.select(force);
  }

  public static getSelected() {
    return Toxen.songList.filter(song => song.selected);
  }

  public static deselectAll() {
    Toxen.songList.forEach(song => song.selected ? (song.selected = false) : null);
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
      // SONG SETTINGS
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
      "visualizerPulseBackground",
      "year",
      "language",
      "subtitleDelay",
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
      info.paths.dirname = Path.basename(fullPath);
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isFile()) {
          let ext = Path.extname(ent.name).toLowerCase();
          if (Toxen.getSupportedMediaFiles().includes(ext)) {
            info.paths.media = ent.name;
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
          }
          else if (Toxen.getSupportedImageFiles().includes(ext)) {
            if (!info.paths.background) info.paths.background = ent.name;
          }
          else if (Toxen.getSupportedSubtitleFiles().includes(ext)) {
            if (!info.paths.subtitles) info.paths.subtitles = ent.name;
          }
          else if (Toxen.getSupportedStoryboardFiles().includes(ext)) {
            if (!info.paths.storyboard) info.paths.storyboard = ent.name;
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

    if (!Toxen.isMode("Player") && Toxen.editingSong && Toxen.editingSong.uid !== this.uid) {
      Toxen.sendError("CURRENTLY_EDITING_SONG");
      return;
    }

    options ?? (options = {});
    let src = this.mediaFile();
    if (Toxen.musicPlayer.state.src != src) {
      if (Settings.isRemote() && this.isVideo()) Toxen.log("Streaming a video can take some time to load... Using audio files is much faster.", 3000);
      if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
      let bg = this.backgroundFile();
      this.applySubtitles();
      this.applyStoryboard();
      if (!options.disableHistory) Song.historyAdd(this);
      Toxen.musicPlayer.setSource(src, true);
      await Toxen.background.setBackground(bg);
      Stats.set("songsPlayed", (Stats.get("songsPlayed") ?? 0) + 1)
      Toxen.setAllVisualColors(this.visualizerColor);
      Toxen.background.storyboard.setSong(this);
      Toxen.background.visualizer.update();
      let img = new Image();
      img.src = Toxen.background.getBackground() || ToxenMax;
      this.setCurrent();
      this.setAppTitle();
      const addToMetadata = (blob?: Blob) => {
        Toxen.discord.setPresence(this);
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

  /**
   * Sets the Toxen's title to this song's title.
   */
  setAppTitle() {
    Toxen.setTitle(this.getDisplayName());
  }

  async applySubtitles() {
    let subFile = this.subtitleFile();
    if (subFile) {
      let subs: SubtitleParser.SubtitleArray = null;
      const supported = Toxen.getSupportedSubtitleFiles();
      const type = Path.extname(subFile);
      const data = await this.readSubtitleFile();
      if (supported.includes(type)) {
        try {
          subs = SubtitleParser.parseByExtension(data, type);
        } catch (error) {
          Toxen.error(error);
        }
      }
      if (subs) subs.song = this;
      Toxen.subtitles.setSubtitles(subs);
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
    if (!Toxen.songQueue.includes(this)) Toxen.songQueue.push(this);
    // if (this.isPlaying()) this._isPlaying = false;
    this.inQueue = true;
    this.selected = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Song.sortSongs(Toxen.songQueue);
  }

  public removeFromQueue() {
    let id = Toxen.songQueue.findIndex(s => s == this);
    if (id != -1) Toxen.songQueue.splice(id, 1);
    this.inQueue = false;
    this.selected = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Toxen.songQueue;
  }

  public inQueue: boolean = false;

  public ContextMenu(props?: {
    noQueueOption?: boolean,
    cref?: React.RefObject<HTMLDivElement>,
    isSelected?: boolean,
  }) {
    props ?? (props = {});
    const selectedSongs = Song.getSelected();

    const modals = useModals();

    let isSelected = props.isSelected ?? this.selected ?? false;

    if (!isSelected) {
      // Single song context menu
      //   const singleMenu: Electron.MenuItemConstructorOptions[] = [
      //     {
      //       label: this.getDisplayName(),
      //       enabled: false
      //     },
      //     {
      //       label: "Edit info",
      //       click: () => {
      //         if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
      //         if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
      //         Toxen.editSong(this);
      //       }
      //     },
      //     !opts.noQueueOption ? (this.inQueue ? {
      //       label: "Remove from queue",
      //       click: () => this.removeFromQueue()
      //     } : {
      //       label: "Add to queue",
      //       click: () => this.addToQueue()
      //     }) : undefined,
      //     {
      //       label: "Add to playlist",
      //       submenu: Toxen.playlists ? Toxen.playlists.map(p => ({
      //         label: p.name,
      //         click: () => {
      //           p.addSong(this);
      //         },
      //         visible: !p.songList.find(s => s.uid === this.uid)
      //       })) : []
      //     },
      //     {
      //       label: "Remove from playlist",
      //       submenu: Toxen.playlists ? Toxen.playlists.map(p => ({
      //         label: p.name,
      //         click: () => {
      //           p.removeSong(this);
      //         },
      //         visible: !!p.songList.find(s => s.uid === this.uid)
      //       })) : []
      //     },
      //     {
      //       label: "Show song in list",
      //       click: async () => {
      //         if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
      //         if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
      //         await Toxen.sidePanel.show(true);
      //         await Toxen.sidePanel.setSectionId("songPanel");
      //         this.scrollTo();
      //       }
      //     },
      //     Settings.isAdvanced<Electron.MenuItemConstructorOptions>({
      //       label: "Extra options",
      //       submenu: [
      //         {
      //           label: "Copy UID",
      //           click: () => this.copyUID()
      //         },
      //         {
      //           label: "Open in file explorer",
      //           click: () => {
      //             remote.shell.openPath(this.dirname());
      //           },
      //           enabled: !Settings.isRemote(),
      //         },
      //         {
      //           label: "Record (Experimental)",
      //           click: () => {
      //             const recorder = new ScreenRecorder();
      //             recorder.startRecording();
      //           }
      //         },
      //       ]
      //     }),
      //     {
      //       type: "separator"
      //     },
      //     {
      //       label: "Toxen",
      //       enabled: false
      //     },
      //     {
      //       label: "Toggle fullscreen",
      //       click: () => {
      //         Toxen.toggleFullscreen();
      //       }
      //     }
      //   ].filter(a => a) as Electron.MenuItemConstructorOptions[];
      //   remote.Menu.buildFromTemplate(singleMenu).popup();

      return (
        <Menu ref={props.cref} className="song-context-menu">
          <Menu.Item disabled={true}>
            {this.getDisplayName()}
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-edit"></i>} onClick={() => {
            if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
            if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
            Toxen.editSong(this);
          }}>
            Edit info
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-th-list"></i>} onClick={() => {
            modals.openModal(this.createManagePlaylists());
          }}>
            Manager playlists
          </Menu.Item>
          {!props.noQueueOption ? (this.inQueue ? (
            <Menu.Item icon={<i className="fas fa-minus"></i>} onClick={() => this.removeFromQueue()}>
              Remove from queue
            </Menu.Item>
          ) : (
            <Menu.Item icon={<i className="fas fa-plus"></i>} onClick={() => this.addToQueue()}>
              Add to queue
            </Menu.Item>
          )) : undefined}
          <Menu.Item icon={<i className="fas fa-search"></i>} onClick={async () => {
            if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
            if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
            await Toxen.sidePanel.show(true);
            await Toxen.sidePanel.setSectionId("songPanel");
            this.scrollTo();
          }}>
            Show song in list
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-trash-alt"></i>} color="red" onClick={() => {
            modals.openConfirmModal({
              title: <h2>Delete song</h2>,
              children: `Are you sure you want to delete "${this.title}"?`,
              onConfirm: async () => {
                try {
                  await this.delete();
                } catch (error) {
                  Toxen.error(error);
                }
              },
              labels: {
                confirm: "Delete",
                cancel: "Cancel"
              },
              confirmProps: {
                color: "red"
              }
            });
          }}>
            Delete
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-cut"></i>} onClick={() => {
            modals.openModal(this.createTrimSongModal());
          }}>
            Trim
          </Menu.Item>
          {Settings.isAdvanced<JSX.Element>(
            <>
              <Menu.Item disabled={true}>
                Extra options
              </Menu.Item>
              <Menu.Item onClick={() => this.copyUID()}>
                Copy UID
              </Menu.Item>
              <Menu.Item onClick={() => remote.shell.openPath(this.dirname())}>
                Open in file explorer
              </Menu.Item>
              <Menu.Item onClick={() => {
                const recorder = new ScreenRecorder();
                recorder.startRecording();
              }}>
                Record (Experimental)
              </Menu.Item>
            </>
          )}
        </Menu>
      )
    }
    else if (selectedSongs.length > 0) {
      // Multi-selected song context menu
      // const multiMenu: Electron.MenuItemConstructorOptions[] = [
      //   {
      //     label: "Deselect all",
      //     click: () => {
      //       Song.deselectAll();
      //     }
      //   },
      //   {
      //     type: "separator"
      //   },
      //   {
      //     label: "Add to playlist",
      //     submenu: Toxen.playlists ? Toxen.playlists.map(p => ({
      //       label: p.name,
      //       click: () => {
      //         p.addSong(...selectedSongs);
      //       }
      //     })) : []
      //   },
      //   {
      //     label: "Remove from playlist",
      //     submenu: Toxen.playlists ? Toxen.playlists.map(p => ({
      //       label: p.name,
      //       click: () => {
      //         p.removeSong(...selectedSongs);
      //       }
      //     })) : []
      //   },
      //   {
      //     type: "separator"
      //   },
      //   {
      //     label: "Add to queue",
      //     click: () => {
      //       selectedSongs.forEach(s => s.addToQueue());
      //     }
      //   },
      //   {
      //     label: "Remove from queue",
      //     click: () => {
      //       selectedSongs.forEach(s => s.removeFromQueue());
      //     }
      //   }
      // ].filter(a => a) as Electron.MenuItemConstructorOptions[];
      // remote.Menu.buildFromTemplate(multiMenu).popup();

      return (
        <Menu ref={props.cref} className="song-context-menu">
          {/* <Menu.Item disabled={true}>
            Multiple songs
          </Menu.Item> */}
          <Menu.Item icon={<i className="far fa-check-square"></i>} onClick={() => {
            Song.deselectAll();
          }}>
            Deselect all
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-th-list"></i>} onClick={() => {
            const selectedSongs = Song.getSelected();
            // selectedSongs.forEach(s => s.addToPlaylist());
            // Currently disabled
            modals.openModal(Song.createManageMultiSongsPlaylists(selectedSongs));
          }}>
            Manage playlists
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-plus"></i>} onClick={async () => {
            const selectedSongs = Song.getSelected();
            selectedSongs.forEach(s => s.addToQueue());
          }}>
            Add to queue
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-minus"></i>} onClick={() => {
            const selectedSongs = Song.getSelected();
            selectedSongs.forEach(s => s.removeFromQueue());
          }}>
            Remove from queue
          </Menu.Item>
          <Menu.Item icon={<i className="fas fa-trash-alt"></i>} color="red" onClick={() => {
            const selectedSongs = Song.getSelected();
            modals.openConfirmModal({
              title: <h2>Delete songs</h2>,
              children: <>
                <p>
                  Are you sure you want to delete these {selectedSongs.length} songs?
                  <hr />
                  The following songs will be deleted:
                  {
                    selectedSongs.map(s => (
                      <div key={s.uid}>
                        <i className="fas fa-music"></i>
                        &nbsp;
                        <span>{s.getDisplayName()}</span>
                      </div>
                    ))
                  }
                </p>
              </>,
              onConfirm: async () => {
                try {
                  await this.delete();
                } catch (error) {
                  Toxen.error(error);
                }
              },
              labels: {
                confirm: "Delete all",
                cancel: "Cancel"
              },
              confirmProps: {
                color: "red"
              }
            });
          }}>
            Delete
          </Menu.Item>
        </Menu>
      )
    }
    else {
      // Empty context menu
      return (
        <Menu ref={props.cref} className="song-context-menu">
          <Menu.Item disabled={true}>
            Empty
          </Menu.Item>
        </Menu>
      );
    }
  }

  public existingElements: SongElement[] = [];
  /**
   * Remove the top element from the list of existing elements.
   */
  public popExistingElement() {
    return this.existingElements.pop();
  }
  public currentElement: SongElement;

  public createManagePlaylists(): ModalSettings {
    return {
      title: <h2>Manage playlists</h2>,
      children: (
        <>
          {
            Toxen.playlists.map(p => (
              <span>
                <Checkbox style={{ marginTop: 8 }} size={"lg"} label={p.name} defaultChecked={p.songList.includes(this)} onChange={async (e) => {
                  e.target.checked ? p.addSong(this) : p.removeSong(this);
                  await Playlist.save();
                }} />
              </span>
            ))
          }
        </>
      )
    }
  }

  public static createManageMultiSongsPlaylists(songs: Song[]): ModalSettings {
    return {
      title: <h2>Manage playlists</h2>,
      children: (
        <>
          {
            Toxen.playlists.map(p => {
              const result = songs.reduce<boolean>((prev, cur) => {
                if (prev === null) return null;
                const next = p.songList.includes(cur);

                return prev || next;
              }, false);

              return (
                <span>
                  <Checkbox style={{ marginTop: 8 }} size={"lg"} label={p.name} defaultChecked={result} onChange={async (e) => {
                    e.target.checked ? songs.forEach(s => p.addSong(s)) : songs.forEach(s => p.removeSong(s));
                    await Playlist.save();
                  }} />
                </span>
              );
            })
          }
        </>
      )
    }
  }

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
      let iSongs: ISong[] = await Toxen.fetch(user.getUserCollectionPath()).then(res => res.json()).catch(() => []);
      return iSongs.length;
    }
    else {
      return fsp.readdir(dirName, { withFileTypes: true }).then(files => files.filter(ent => ent.isDirectory()).length).catch(() => 0);
    }
  }

  public static async getSongs(reload?: boolean, forEach?: (song: Song) => void): Promise<Song[]> {
    if (Settings.isRemote()) {
      return Song.loadRemoteSongs(reload, forEach);
    }
    else return Song.loadLocalSongs(reload, forEach);
  }

  public static async loadLocalSongs(reload?: boolean, forEach?: (song: Song) => void) {
    return Promise.resolve().then(async () => {
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

  public static async loadRemoteSongs(reload?: boolean, forEach?: (song: Song) => void) {
    let user = Settings.getUser();
    if (!user) {
      return [];
    }
    let iSongs: ISong[] = await Toxen.fetch(user.getUserCollectionPath()).then(res => res.json());
    const songs: Song[] = iSongs.map(iSong => Song.create(iSong)).filter(s => s.paths && s.paths.media);
    if (forEach) {
      songs.forEach(forEach);
    }
    return Song.sortSongs(songs);
  }

  public async delete(force?: boolean) {
    if (Settings.isRemote()) {
      Toxen.notify({
        title: "Export not implemented",
        content: "This feature is not yet implemented for remote users.",
        expiresIn: 5000,
        type: "error"
      });
      return;
    }
    else {
      // Play the next song if this is the current song
      let cur = Song.getCurrent();
      if (cur && cur.uid === this.uid) {
        await Toxen.musicPlayer.playNext();
      }
      try {
        await fsp.rm(this.dirname(), { recursive: true });
      } catch (error) {
        try {
          await fsp.rm(this.dirname(), { recursive: true }); // Try again
        } catch (error) {
          Toxen.error("Failed to delete song: " + this.dirname());
        }
      }
      Toxen.songList = Toxen.songList.filter(s => s !== this);
      Toxen.songPanel.update();
    }
  }

  public async saveInfo(): Promise<void> {
    const curSong = Song.getCurrent();
    if (curSong === this) {
      curSong.setAppTitle();
    }
    if (Settings.isRemote()) {
      let info = this.toISong();
      let user = Settings.getUser();
      if (!user) {
        return;
      }
      return await Toxen.fetch(user.getUserCollectionPath() + "/" + this.uid + "/info.json", {
        method: "PUT",
        body: JSON.stringify(info),
        headers: {
          "Content-Type": "application/json"
        }
      }).then(() => {
        // Toxen.notify({
        //   title: "Song saved",
        //   content: this.getDisplayName(),
        //   expiresIn: 3000
        // });
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
      // Toxen.notify({
      //   title: "Song saved",
      //   content: this.getDisplayName(),
      //   expiresIn: 3000
      // });
    } catch (error) {
      Toxen.notify({
        title: "Failed to save Song",
        content: this.getDisplayName(),
        expiresIn: 5000,
        type: "error"
      });
    }
  }

  public static async importSong(file: File | ToxenFile): Promise<Result<Song>> {
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

      // Build info
      const info = await Song.buildInfo(newFolder);
      let s = Song.create(info);
      await s.saveInfo();

      return new Success(s);
    });
  }

  /**
   * Copy the song's UID to the clipboard.
   */
  public copyUID(): void {
    remote.clipboard.write({
      text: this.uid
    });
    Toxen.log("Copied UID to clipboard", 2000);
  }

  /**
   * Returns whether the song's media file is a video. If false, it's an audio file.
   */
  public isVideo() {
    const mediaFile = this.mediaFile();
    if (!mediaFile) return false;
    return Toxen.getSupportedVideoFiles().includes(Path.extname(mediaFile).toLowerCase());
  }

  public static async export(...songs: Song[]) {
    if (Settings.isRemote()) {
      // TODO: Implement
      Toxen.notify({
        title: "Export not implemented",
        content: "This feature is not yet implemented for remote users.",
        expiresIn: 5000,
        type: "error"
      });
      return;
    }

    // Zip all songs into one file, in separate folders
    const zip = new yazl.ZipFile();
    const zipPathTmp = Path.resolve(os.tmpdir(), "toxen-export-" + Math.random().toString().substr(2) + ".zip");
    // Pipe the zip file to the file system
    const zipStream = createWriteStream(zipPathTmp);
    zip.outputStream.pipe(zipStream);

    for (const song of songs) {
      const songPath = Path.resolve(song.dirname());
      zip.addReadStream(createReadStream(songPath), Path.basename(song.uid || songPath));
    }

    zip.end();

    // Wait for the zip file to be written
    return await new Promise((resolve, reject) => {
      zipStream.on("finish", resolve);
      zipStream.on("error", reject);
    })
      .then(() => {
        // Open the zip file in the user's default program
        return open(zipPathTmp);
      }).then(() => {
        // Delete the zip file
        return fsp.unlink(zipPathTmp);
      }).catch(error => {
        Toxen.error("Something went wrong writing the exported zip file.");
        console.error(error);
        return fsp.unlink(zipPathTmp);
      });
  }

  // TODO: Fix this and/or figure out a better way to have the trimmer.
  // Use a function to create children to use useState for time values?
  public createTrimSongModal(): ModalSettings {
    // const values = {
    //   start: 0,
    //   end: Toxen.musicPlayer.media.duration ? Toxen.musicPlayer.media.duration * 1000 : 60000,
    // }
    const TrimSong = () => {
      const [start, setStart] = useState<number>(0);
      const [end, setEnd] = useState<number>(Toxen.musicPlayer.media.currentTime * 1000);
      const [loading, setLoading] = useState(false);
      const [showMilliseconds, setShowMilliseconds] = useState(false);
      const [progress, setProgress] = useState(0);
      const modals = useModals();
      const browser = useMemo(() => remote.getCurrentWindow(), []);

      let attempts = 0;

      const startTrim = async () => {
        attempts++;
        setLoading(true);
        const result = await Ffmpeg.installFFmpeg();
        if (!result)
          return Toxen.error("FFmpeg could not be installed.");
        try {
          await Ffmpeg.trimSong(this, start / 1000, end / 1000, p => {
            browser.setProgressBar(p.percent / 100);
            setProgress(p.percent);
          });
          browser.setProgressBar(0);
        }
        catch {
          setLoading(false);
          if (attempts <= 3) {
            // Toxen.error("Something went wrong trimming... Retrying: " + attempts, 2000);
            setTimeout(() => {
              startTrim();
            }, 1000);
          }
          else {
            attempts = 0;
            Toxen.error("Something went wrong trimming the song. Please try again", 5000);
          }
          browser.setProgressBar(0);
          return;
        }
        attempts = 0;
        setLoading(false);
        modals.closeModal("trim-song-modal");
        Toxen.log("Trimmed song: " + this.getDisplayName(), 2000);
      };
      
      // const [end, setEnd] = React.useState<number>(Toxen.musicPlayer.media.duration ? Toxen.musicPlayer.media.duration * 1000 : 60000);
      return (<div className="trim-song-panel">
        <h2>Trimming {this.getDisplayName()}</h2>
        {/* {!Settings.get("progressBarShowMs") ? (<sup>
          Tip: Enable "Show milliseconds" in the settings to make it easier to trim precisely.
        </sup>): null} */}
        <p>Pick the start and end times of the song.</p>
        <RangeSlider
          min={0}
          max={Toxen.musicPlayer.media.duration * 1000}
          value={[start, end]}
          onChange={([start, end]) => {
            setStart(start);
            setEnd(end);
          }}
          label={v => Converter.numberToTime(v).toTimestamp(showMilliseconds ? "hh?:mm:ss:ms" : "hh?:mm:ss")}
          labelAlwaysOn
        />
        <br />
        <Checkbox label="Show milliseconds" checked={showMilliseconds} onChange={e => setShowMilliseconds(e.currentTarget.checked)} />
        <br />
        {
          progress > 0 ? (
            <>
            <Progress value={progress} animate color="green" />
            <br />
            </>
          ) : null
        }
        <Button loading={loading} onClick={startTrim}>
          Trim
        </Button>
      </div>)
    };

    return {
      title: "Trim Song",
      children: <TrimSong />,
      id: "trim-song-modal"
    }
  }
}

export interface ISong {
  // SONG SETTINGS
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
  /**
   * `pulse` is forced pulsing.  
   * `pulse-off` is forced no pulsing.  
   * `null` will use the global setting.
   */
  visualizerPulseBackground: "pulse" | "pulse-off";
  paths: ISongPaths;
  year: number;
  language: string;
  subtitleDelay: number;
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