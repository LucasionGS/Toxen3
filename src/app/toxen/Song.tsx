import React, { useMemo, useState } from "react";
// import { resolve } from "path";
import Settings, { ISettings, VisualizerStyle } from "./Settings";
// import fsp from "fs/promises";
// import { Dir, Dirent } from "fs";
import { Toxen } from "../ToxenApp";
// import Path from "path";
import SongElement from "../components/SongPanel/SongElement";
// import Legacy, { Toxen2SongDetails } from "./Legacy";
import { Failure, Result, Success } from "./Result";
import System, { ToxenFile } from "./System";
import Converter from "./Converter";
import Stats from "./Statistics";
// import navigator, { MediaMetadata } from "../../navigator";
import SubtitleParser from "./SubtitleParser";
//@ts-expect-error 
import ToxenMax from "../../icons/skull_max.png";
import { useModals } from "@mantine/modals";
import { ModalsContextProps, ModalSettings } from "@mantine/modals/lib/context";
import { Checkbox, Menu, RangeSlider, Button, Progress, Group, Stack } from "@mantine/core";
import Playlist from "./Playlist";
import StoryboardParser from "./StoryboardParser";
import User from "./User";
import { hideNotification, updateNotification } from "@mantine/notifications";
// import HueManager from "./philipshue/HueManager";

export default class Song implements ISong {
  public uid: string;
  public artist: string;
  public coArtists: string[];
  public title: string;
  public album: string;
  public genre: string;
  public source: string;
  public tags: string[];
  public paths: ISongPaths;
  public visualizerColor: string;
  public visualizerStyle: VisualizerStyle;
  public visualizerStyleOptions: ISong["visualizerStyleOptions"];
  public visualizerIntensity: number;
  public visualizerNormalize: boolean;
  public visualizerForceRainbowMode: boolean;
  public visualizerGlow: boolean;
  /**
   * `pulse` is forced pulsing.  
   * `pulse-off` is forced no pulsing.  
   * `null` will use the global setting.
   */
  public visualizerPulseBackground: "pulse" | "pulse-off" = null;
  public year: number;
  public language: string;
  public subtitleDelay: number;
  public floatingTitle: boolean;
  public floatingTitleText: string;
  public floatingTitleUnderline: boolean;
  public floatingTitlePosition: ISong["floatingTitlePosition"];
  public floatingTitleReactive: boolean;
  public floatingTitleOverrideVisualizer: boolean;
  public useFloatingTitleSubtitles: boolean;

  // Star rush effect settings
  public starRushEffect: boolean | null; // null = use global setting
  public starRushIntensity: number | null; // null = use global setting

  // Hash used for sync
  public hash: string;
  /**
   * The duration of the song in seconds.
   */
  public duration: number;

  /**
   * The files that are in the song's directory. Maps to an object.
   * The datetime string is the last modified date of the file.
   */
  public files: ISong["files"] = {};

  /**
   * Defines the latest action the file has had. Used for syncing.
   * @param file The relative path of the file.
   * @param action "u" for updated, "d" for deleted. Default is "u".
   * @param datetime The time and date of the file action. Default is the current time.
   */
  public setFile(file: string, action: "u" | "d" = "u", datetime: Date | number = new Date().getTime()) {
    this.files[file] = { action, time: typeof datetime !== "number" ? datetime.getTime() : datetime };
  }

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

  // public async getToxen2Details(): Promise<Toxen2SongDetails> {
  //   if (Settings.isRemote()) {
  //     Toxen.error("Toxen2 migration is not supported on remote library.");
  //     return null;
  //   }
  //   try {
  //     return JSON.parse(await fsp.readFile(this.dirname("details.json"), "utf8"));
  //   } catch (error) {
  //     return null;
  //   }
  // }

  /**
   * Return the full local path of the song folder.
   */
  public dirnameLocal(relativePath?: string) {
    if (toxenapi.isDesktop()) return (this.paths && this.paths.dirname) ? toxenapi.path.resolve(Settings.get("libraryDirectory"), this.paths.dirname, relativePath ?? ".") : null;
    toxenapi.throwDesktopOnly("Unable to get song directory name.");
  }

  /**
   * Return the full path of the song folder.
   */
  public dirname(relativePath?: string) {
    let user = Settings.getUser();
    if (Settings.isRemote() && !user) return null;
    if (Settings.isRemote()) return `${user.getCollectionPath()}/${this.uid}${relativePath ? "/" + relativePath : ""}`;
    return this.dirnameLocal(relativePath);
  }

  /**
   * Return the full path of the media file.
   */
  public mediaFile() {
    if (Settings.isRemote()) return this.paths.media ? `${this.dirname()}/${this.paths.media}` : "";
    else if (toxenapi.isDesktop()) return (this.paths && this.paths.media) ? toxenapi.path.resolve(this.dirname(), this.paths.media || "") : "";
    toxenapi.throwDesktopOnly("Unable to get media file.");
  }

  /**
   * Return the full path of the background file.
   */
  public backgroundFile() {
    if (Settings.isRemote()) return this.paths.background ? `${this.dirname()}/${this.paths.background}` : "";
    else if (toxenapi.isDesktop()) return (this.paths && this.paths.background) ? toxenapi.path.resolve(this.dirname(), this.paths.background || "") : "";
    toxenapi.throwDesktopOnly("Unable to get background file.");
  }

  /**
   * Return the full path of the subtitle file.
   */
  public subtitleFile() {
    if (Settings.isRemote()) return this.paths.subtitles ? `${this.dirname()}/${this.paths.subtitles}` : "";
    else if (toxenapi.isDesktop()) return (this.paths && this.paths.subtitles) ? toxenapi.path.resolve(this.dirname(), this.paths.subtitles || "") : "";
    toxenapi.throwDesktopOnly("Unable to get subtitle file.");
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
        if (toxenapi.isDesktop()) {
          toxenapi.fs.promises.readFile(this.subtitleFile(), "utf8").then(data => {
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
      }
    });
  }

  /**
   * Return the full path of the storyboard file.
   */
  public storyboardFile() {
    if (Settings.isRemote()) return (this.paths && this.paths.storyboard) ? `${this.dirname()}/${this.paths.storyboard}` : "";
    else return (this.paths && this.paths.storyboard && toxenapi.isDesktop()) ? toxenapi.path.resolve(this.dirname(), this.paths.storyboard) : "";
  }

  public readStoryboardFile(validateFields: boolean = true) {
    return new Promise<StoryboardParser.StoryboardConfig>((resolve, reject) => {
      if (!this.storyboardFile()) {
        resolve(null);
        return;
      }

      if (Settings.isRemote()) {
        Toxen.fetch(this.storyboardFile()).then(async res => {
          if (res.status === 200) {
            resolve(StoryboardParser.parseStoryboard(await res.text(), validateFields));
          } else {
            Toxen.error("Failed to fetch storyboard from server.");
            resolve(null);
          }
        });
      }
      else {
        if (toxenapi.isDesktop()) {
          toxenapi.fs.promises.readFile(this.storyboardFile(), "utf8").then(data => {
            resolve(StoryboardParser.parseStoryboard(data, validateFields));
          }).catch(err => {
            Toxen.error("Failed to load storyboard from storage.");
            resolve(null);
          });
        }
      }
    });
  }

  public async applyStoryboard() {
    let storyboard = await this.readStoryboardFile();
    if (!storyboard) return StoryboardParser.setStoryboard(null, this);

    StoryboardParser.setStoryboard(storyboard, this);
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
  public Element(key?: string) {
    return (
      <SongElement key={key} playing={this.isPlaying()} song={this} ref={ref => this.currentElement = ref} />
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
      "genre",
      "visualizerColor",
      "visualizerStyle",
      "visualizerStyleOptions",
      "visualizerIntensity",
      "visualizerNormalize",
      "visualizerForceRainbowMode",
      "visualizerPulseBackground",
      "visualizerGlow",
      "year",
      "language",
      "subtitleDelay",
      "floatingTitle",
      "floatingTitleText",
      "floatingTitleUnderline",
      "floatingTitlePosition",
      "floatingTitleReactive",
      "floatingTitleOverrideVisualizer",
      "useFloatingTitleSubtitles",
      "starRushEffect",
      "starRushIntensity",
      "files",
      "hash",
      "duration",
    ];
    const obj = {} as any;
    keys.forEach(key => {
      obj[key] = this[key] as any;
    })
    return obj;
  }

  public static async buildInfo(fullPath: string) {
    if (toxenapi.isDesktop()) {
      return toxenapi.buildSongInfo(Toxen, Song, fullPath);
    }
    else {
      toxenapi.throwDesktopOnly("Unable to build song info.");
    }
  }

  public static generateUID(skipCheck = false) {
    let items = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
    let uid: string = "";
    do {
      for (let i = 0; i < 16; i++) {
        uid += items[Math.floor(Math.random() * items.length)];
      }
    }
    while (!skipCheck && Toxen.songList && Toxen.songList.length > 0 && Toxen.songList.some(s => s.uid === uid));
    return uid;
  }

  /**
   * Generates a 32 character long random hex string.
   */
  public static randomFileHash() {
    return Math.random().toString(16).slice(2, 18) + Math.random().toString(16).slice(2, 18);
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
    if (Toxen.musicPlayer.state.src === src) return;
    // if (HueManager.isEnabled()) {
    //   HueManager.start().catch((error) => Toxen.error(error.message));
    // }
    // else {
    //   HueManager.stop();
    // }
    if (Settings.isRemote() && this.isVideo()) Toxen.log("Streaming a video can take some time to load... Using audio files is much faster.", 3000);
    if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
    let bg = this.backgroundFile();

    if (!Settings.isRemote() && toxenapi.isDesktop()) {
      // Check if needs conversion
      const convertable = Toxen.getSupportedConvertableAudioFiles();
      if (convertable.includes(toxenapi.path.extname(src).toLowerCase())) {
        const id = Toxen.notify({
          title: "Converting " + this.getDisplayName() + " to MP3",
          content: `0% complete`,
        });
        toxenapi.ffmpeg.convertToMp3(this, (progress) => { // Purposely don't await, let it run in the background
          updateNotification({
            id,
            message: <div>
              {Math.round(progress.percent)}% complete
              <br />
              {progress.timemark}
            </div>,
          });
        });
      }
    }

    await this.applySubtitles();
    await this.applyStoryboard();
    if (!options.disableHistory) Song.historyAdd(this);
    Toxen.musicPlayer.setSource(src, true);
    await Toxen.background.setBackground(bg + "?h=" + this.hash);
    Stats.set("songsPlayed", (Stats.get("songsPlayed") ?? 0) + 1);
    Toxen.setAllVisualColors(this.visualizerColor);
    Toxen.background.storyboard.setSong(this);
    Toxen.background.visualizer.update();
    let img = new Image();
    img.src = (Toxen.background.getBackground() || ToxenMax)
    this.setCurrent();
    // Reset progress bar when starting a new song
    this.setProgressBar(0);
    this.setAppTitle();
    const addToMetadata = (blob?: Blob) => {
      if (this !== Song.getCurrent()) {
        return;
      }
      
      Toxen.discord?.setPresence(this);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.title ?? "Unknown Title",
        artist: this.artist ?? "Unknown Artist",
        album: this.album ?? "",
        artwork: blob ? [
          { src: (this.lastBlobUrl = URL.createObjectURL(blob)), sizes: `${img.naturalWidth}x${img.naturalHeight}`, type: "image/png" }
        ] : undefined
      });
    }

    if (Toxen.getSupportedImageFiles().includes(toxenapi.getFileExtension(bg).toLowerCase())) {
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
    addToMetadata();

    if (Toxen.background.visualizer.isStopped())
    Toxen.background.visualizer.start();

    if (this.duration) {
      this.duration = await this.calculateDuration();
      this.saveInfo();
    }
  }

  public static async convertAllNecessary(songs: Song[]) {
    if (!Settings.isRemote() && toxenapi.isDesktop()) {
      // Check if needs conversion

      const globalId = Toxen.notify({
        title: "Converting all necessary",
        content: `0% complete`,
      });

      async function convertSong(song: Song) {
        if (!toxenapi.isDesktop()) { toxenapi.throwDesktopOnly(); }
        const id = Toxen.notify({
          title: "Converting " + song.getDisplayName() + " to MP3",
          content: `0% complete`
        });
        await toxenapi.ffmpeg.convertToMp3(song, (progress) => {
          updateNotification({
            id,
            title: "Converting " + song.getDisplayName() + " to MP3",
            message: <div>
              {Math.round(progress.percent)}% complete
              <br />
              {progress.timemark}
            </div>,
            autoClose: false,
          });
        });

        updateNotification({
          id,
          title: "Converting " + song.getDisplayName() + " to MP3",
          message: <div>
            100% complete
          </div>,
          autoClose: 500,
        });

        updateNotification({
          id: globalId,
          title: "Converting all necessary",
          message: <div>
            {Math.round((songs.indexOf(song) / songs.length) * 100)}% complete
          </div>,
          color: "green",
          autoClose: false
        });
      }

      const convertable = Toxen.getSupportedConvertableAudioFiles();
      songs = songs.filter(s => convertable.includes(toxenapi.getFileExtension(s.mediaFile()).toLowerCase()))

      // Convert 3 at a time
      let i = 0;
      let active = 0;
      while (i < songs.length) {
        const song = songs[i];
        if (active < 3) {
          i++;
          active++;
          convertSong(song).then(() => {
            active--;
          });
        }
        if (active >= 3) await new Promise(r => setTimeout(r, 1000));
      }

      while (active > 0) await new Promise(r => setTimeout(r, 1000));

      updateNotification({
        id: globalId,
        title: "Converting all necessary",
        message: <div>
          100% complete
          <br />
          {i} / {songs.length}
        </div>,
        color: "green",
        autoClose: 2000,
      });

      return songs.length;
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
      const type = toxenapi.getFileExtension(subFile);
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

  // Replacement for ContextMenu, will be a modal instead
  public contextMenuModal(modals: ModalsContextProps) {
    const selectedSongs = Song.getSelected();

    let isSelected = this.selected;
    
    let modalId: string;
    const close = () => modals.closeModal(modalId);
    
    // If none are selected
    // or if only one is selected and it's this one
    // or if more than one are selected and this one is not selected
    // Show the single song context menu
    if (selectedSongs.length == 0 || (selectedSongs.length == 1) || (selectedSongs.length > 1 && !isSelected)) {
      modalId = modals.openModal({
        title: this.getDisplayName(),
        children: (
          <Stack>
            <p>
              {this.getDisplayName()}
            </p>
            <Button onClick={() => {
              close();
              if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
              if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
              Toxen.editSong(this);
            }}>
              Edit info
            </Button>
            <Button onClick={() => {
              close();
              modals.openModal(this.createManagePlaylists());
            }}>
              Manage playlists
            </Button>
            <Button onClick={() => {
              close();
              this.inQueue ? this.removeFromQueue() : this.addToQueue();
            }}>
              {this.inQueue ? "Remove from queue" : "Add to queue"}
            </Button>
            <Button onClick={() => {
              close();
              modals.openConfirmModal({
                title: "Delete song",
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
            </Button>
            {!Settings.isRemote() && (
                <Button onClick={() => {
                  close();
                  modals.openModal(this.createTrimSongModal());
                }}>
                  Trim
                </Button>
            )}
            {
              User.getCurrentUser()?.premium && !Settings.isRemote() && (
                <Button onClick={() => {
                  close();
                  this.sync();
                }}>
                  Sync with remote
                </Button>
              )
            }
            {
              User.getCurrentUser()?.premium && Settings.isRemote() && toxenapi.isDesktop() && (
                <Button onClick={async () => {
                  close();
                  // Create the song on local with the info, then sync it

                  // Check if sone already exists locally
                  let localSongs = await Song.loadLocalSongs();
                  
                  const existingSong = localSongs.find(s => s.uid === this.uid);

                  // Create the song locally
                  const localDir = existingSong
                    ? existingSong.dirnameLocal()
                    : toxenapi.path.resolve(Settings.get("libraryDirectory"), this.uid);
                  
                  if ((await toxenapi.fs.promises.stat(localDir).catch(() => false))) {
                    const id = modals.openConfirmModal({
                      title: "Song already exists locally",
                      children: (
                        <Stack>
                          <p>
                            If you continue, the existing song will be deleted and replaced with the remote version. All unsynced local changes will be lost.
                            <br />
                            If you meant to sync the song differences, change to local mode and sync the song.
                          </p>
                        </Stack>
                      ),
                      labels: {
                        confirm: "Delete and redownload song",
                        cancel: "Cancel"
                      },
                      confirmProps: {
                        color: "red"
                      },
                      onConfirm: () => {
                        modals.closeModal(id);
                        this.downloadRemoteToLocal(localDir).then(() => {
                          Toxen.log("Song downloaded to local.", 2000);
                        }).catch(error => {
                          Toxen.error("Failed to download song to local: " + error.message);
                        });
                      },
                      onCancel: () => {
                        modals.closeModal(id);
                      }
                    });
                  }
                  else {
                    this.downloadRemoteToLocal(localDir).then(() => {
                      Toxen.log("Song downloaded to local.", 2000);
                    }).catch(error => {
                      Toxen.error("Failed to download song to local: " + error.message);
                    });
                  }
                }}>
                  Download to local
                </Button>
              )
            }
            {Settings.isAdvanced<JSX.Element>(
              <>
                <Button onClick={() => {
                  close();
                  this.copyUID()
                }}>
                  Copy UID
                </Button>
                {toxenapi.isDesktop() && (
                  <Button onClick={() => {
                    close();
                    toxenapi.remote.shell.openPath(this.dirname());
                  }}>
                    Open in file explorer
                  </Button>
                )}
              </>
            )}
          </Stack>
        )
      });
    }
    // If more than one are selected and this one is selected
    // Show the multi song context menu
    else if (selectedSongs.length > 1) {
      modalId = modals.openModal({
        title: "Manage playlists",
        children: (
          <Stack>
            <p>
              Manage playlists for the {selectedSongs.length} selected songs.
            </p>
            <Button onClick={() => {
              close();
              Song.deselectAll();
            }}>
              Deselect all
            </Button>
            <Button onClick={() => {
              close();
              modals.openModal(Song.createManageMultiSongsPlaylists(selectedSongs));
            }}>
              Manage playlists
            </Button>
            <Button onClick={() => {
              close();
              Song.clearQueue();
              selectedSongs.forEach(s => s.addToQueue());
            }}>
              Add all to queue
            </Button>
            <Button onClick={() => {
              close();
              selectedSongs.forEach(s => s.removeFromQueue());
            }}>
              Remove all from queue
            </Button>
            <Button onClick={() => {
              close();
              modals.openConfirmModal({
                title: "Delete songs",
                children: `Are you sure you want to delete ${selectedSongs.length} songs?`,
                onConfirm: async () => {
                  try {
                    await Promise.all(selectedSongs.map(s => s.delete()));
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
              Delete all
            </Button>
            {
              User.getCurrentUser()?.premium && Settings.isRemote() && toxenapi.isDesktop() && (
                <Button onClick={() => {
                  close();
                  Song.downloadAllMissingRemoteToLocal(selectedSongs);
                }}>
                  Download all missing to local
                </Button>
              )
            }
            {
              User.getCurrentUser()?.premium && !Settings.isRemote() && toxenapi.isDesktop() && (
                <Button onClick={() => {
                  close();
                  Toxen.syncSongs(selectedSongs);
                }}>
                  Sync selected with remote
                </Button>
              )
            }
          </Stack>
        )
      });
    }
  }

  public async downloadRemoteToLocal(): Promise<void>;
  public async downloadRemoteToLocal(localSong: Song): Promise<void>;
  public async downloadRemoteToLocal(localDir: string): Promise<void>;
  public async downloadRemoteToLocal(local?: string | Song) {
    if (!Settings.isRemote() || !toxenapi.isDesktop()) {
      Toxen.error("Cannot download from remote to local when not in remote mode nor on desktop.");
      return;
    }

    // Check if sone already exists locally
    // Create the song locally
    const localDir = local instanceof Song
      ? local.dirnameLocal()
      : typeof local === "string"
      ? toxenapi.path.resolve(Settings.get("libraryDirectory"), local)
      : toxenapi.path.resolve(Settings.get("libraryDirectory"), this.uid);
    // const songByFolder = localSongs.find(s => s.paths.dirname === this.uid);
    
    const tmp = toxenapi.path.resolve(toxenapi.os.tmpdir(), Song.randomFileHash()); // For temporary move location while redownloading, in case something goes wrong.
    
    if ((await toxenapi.fs.promises.stat(localDir).catch(() => false))) {
      await toxenapi.fs.promises.rename(localDir, tmp);
    }
    
    const songData = this.toISong();
    const fileData: {
      name: string;
      isDirectory: boolean;
    }[] = await Toxen.fetch(this.dirname()).then(res => res.json()).catch(() => null as any);
    
    this.setProgressBar(0.10);
    try {
      await toxenapi.fs.promises.mkdir(localDir);
      const fileCount = Object.keys(songData.files).length;
      // for (const filePath in songData.files) {

      let fileNumDone = 0;
      await Promise.all(fileData.map(async (file) => {
        const filePath = file.name;
        const fullPath = toxenapi.path.resolve(localDir, filePath);
        const dir = toxenapi.path.dirname(fullPath);
        if (!(await toxenapi.fs.promises.stat(dir).catch(() => false))) {
          await toxenapi.fs.promises.mkdir(dir, { recursive: true });
        }
        console.log("Syncing file: " + filePath);
        const data = await Toxen.fetch(this.dirname(filePath)).then(
          res => {
            if (res.ok) return res.blob().then(blob => blob.stream());
            else return null;
          }
        ).catch(() => null as any);
        if (data) {
          await toxenapi.fs.promises.writeFile(
            fullPath,
            data
          );
        }
        fileNumDone++;
        this.setProgressBar(fileNumDone / fileCount);
      }));

      this.setProgressBar(1, true);

      if ((await toxenapi.fs.promises.stat(tmp).catch(() => false))) {
        await toxenapi.fs.promises.rmdir(tmp, { recursive: true });
      }
    } catch (error) {
      Toxen.error("Failed to create song locally: " + error.message);
      if (await toxenapi.fs.promises.stat(tmp).catch(() => false)) {
        await toxenapi.fs.promises.rmdir(localDir, { recursive: true });
        await toxenapi.fs.promises.rename(tmp, localDir);
      }
      return;
    }
  }

  public static async downloadAllMissingRemoteToLocal(remoteSongs?: Song[]) {
    if (!Settings.isRemote() || !toxenapi.isDesktop()) {
      Toxen.error("Cannot download from remote to local when not in remote mode nor on desktop.");
      return;
    }

    const localSongs = await Song.loadLocalSongs();
    remoteSongs ??= Toxen.getAllSongs();

    const missingSongs = remoteSongs.filter(s => !localSongs.some(ls => ls.uid === s.uid));

    function DownloadedSongs() {
      const [done, _setDone] = React.useState(0);
      setDone = _setDone;
      return `Downloaded song ${done} / ${count}`;
    }

    let setDone: (done: number) => void;
    
    const count = missingSongs.length;
    let done = 0;
    const notifId = Toxen.notify({
      content: <DownloadedSongs />,
      disableClose: true,
      title: "Downloading missing songs"
    });
    for (const song of missingSongs) {
      let songPath = toxenapi.path.resolve(Settings.get("libraryDirectory"), song.uid)
      while (await toxenapi.fs.promises.stat(songPath).catch(() => false)) {
        songPath = toxenapi.path.resolve(Settings.get("libraryDirectory"), song.uid + "-" + Song.randomFileHash());
      }
      await song.downloadRemoteToLocal(songPath);
      setDone(++done);
    }

    hideNotification(notifId);
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
      title: "Manage playlists",
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
      title: "Manage playlists",
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
    if (this.currentElement) {
      this.currentElement.setState({ playing: mode });
      // Reset progress bar when song stops playing
      if (!mode) {
        this.currentElement.setState({ progressBar: 0 });
      }
    }
  }

  public scrollTo() {
    if (this.currentElement) ((this.currentElement.divPermanentElement ?? this.currentElement.divElement) as any).scrollIntoViewIfNeeded();
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
      let iSongs: ISong[] = await Toxen.fetch(user.getCollectionPath()).then(res => res.json()).catch(() => [] as any);
      return iSongs.length;
    }
    else {
      if (toxenapi.isDesktop()) {
        return toxenapi.fs.promises.readdir(dirName, { withFileTypes: true }).then(files => files.filter(ent => ent.isDirectory()).length).catch(() => 0);
      }
    }
  }

  public static async getSongs(reload?: boolean, forEach?: (song: Song) => void): Promise<Song[]> {
    if (Settings.isRemote()) {
      return Song.loadRemoteSongs(reload, forEach);
    }
    else return Song.loadLocalSongs(reload, forEach);
  }

  public static async loadLocalSongs(reload?: boolean, forEach?: (song: Song) => void) {
    if (toxenapi.isDesktop()) {
      return toxenapi.loadLocalSongs(Toxen, Song, Settings, reload, forEach);
    }
    else {
      toxenapi.throwDesktopOnly("Unable to load local songs on web version.");
    }
  }

  public static async loadRemoteSongs(reload?: boolean, forEach?: (song: Song) => void) {
    let user = Settings.getUser();
    if (!user) {
      return [];
    }
    let iSongs: ISong[] = await Toxen.fetch(user.getCollectionPath()).then(res => res.json());
    const songs: Song[] = iSongs.map(iSong => Song.create(iSong)).filter(s => s.paths && s.paths.media);
    if (forEach) {
      songs.forEach(forEach);
    }
    return Song.sortSongs(songs);
  }

  public async reload() {
    if (Settings.isRemote() || !toxenapi.isDesktop()) {
      return;
    }
    
    let data = await toxenapi.fs.promises.readFile(toxenapi.path.resolve(this.dirname(), "info.json"), "utf8").then(data => JSON.parse(data)).catch(() => null as any);
    for (const key in data) {
      if (key in data) {
        const v = (data as any)[key];
        (this as any)[key] = v;
      }
    }

    return this;
  }

  public async delete(force?: boolean) {
    if (Settings.isRemote()) {
      Toxen.notify({
        title: "Delete not implemented",
        content: "This feature is not yet implemented for remote users.",
        expiresIn: 5000,
        type: "error"
      });
      return;
    }
    else {
      if (toxenapi.isDesktop()) {
        // Play the next song if this is the current song
        let cur = Song.getCurrent();
        if (cur && cur.uid === this.uid) {
          await Toxen.musicPlayer.playNext();
        }
        try {
          await toxenapi.fs.promises.rm(this.dirname(), { recursive: true });
        } catch (error) {
          try {
            await toxenapi.fs.promises.rm(this.dirname(), { recursive: true, }); // Try again
          } catch (error) {
            Toxen.error("Failed to delete song: " + this.dirname());
          }
        }
        Toxen.songList = Toxen.songList.filter(s => s !== this);
        Toxen.songPanel.update();
      }
    }
  }

  public async saveInfo(opts?: {
    callSync?: boolean,
    forceLocal?: boolean,
    touch?: boolean
  }): Promise<void> {
    opts ??= {};
    
    let filetime = Date.now();
    if (opts.touch ?? true) {
      this.setFile("info.json", "u", filetime);
    }
    this.hash = Song.randomFileHash();
    const curSong = Song.getCurrent();
    if (curSong === this) {
      curSong.setAppTitle();
    }
    if (Settings.isRemote() && !opts.forceLocal) {
      let info = this.toISong();
      let user = Settings.getUser();
      if (!user) {
        return;
      }
      return await Toxen.fetch(`${user.getCollectionPath()}/${this.uid}/info.json`, {
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

    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly("Unable to save song info on web version.");
    }
    
    if (!this.paths || !this.paths.dirname) return;
    try {
      const localPath = (this.paths && this.paths.dirname) ? toxenapi.path.resolve(Settings.get("libraryDirectory"), this.paths.dirname) : null;
      if (!localPath) {
        Toxen.error("Failed to save song info: " + this.getDisplayName());
        return;
      }
      await toxenapi.fs.promises.writeFile(toxenapi.path.resolve(localPath, "info.json"), JSON.stringify(this.toISong()));
      if ((opts.callSync ?? true) && Settings.get("remoteSyncOnSongEdit") && User.getCurrentUser()?.premium) {
        await this.sync(null, { silenceValidated: true });
      }
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
    if (Settings.isRemote()) {
      Toxen.notify({
        title: "Import not implemented",
        content: "This feature is not yet implemented for remote users.",
        expiresIn: 5000,
        type: "error"
      });
    }
    
    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly("Unable to import songs on web version.");
    }

    const ensureValidName = (path: string) => path.replace(/[^:\\\/a-z0-9\(\)\[\]\{\}\.\-\_\s]/gi, "_");
    return Promise.resolve().then(async () => {
      let supported = Toxen.getSupportedMediaFiles();
      if (!supported.some(s => toxenapi.path.extname(file.name) === s)) return new Failure(file.name + " isn't a valid file");

      let libDir = Settings.get("libraryDirectory");
      let nameNoExt = Converter.trimChar(toxenapi.path.basename(file.name, toxenapi.path.extname(file.name)), ".");
      let newFolder = toxenapi.path.resolve(libDir, nameNoExt);

      // Validate folder name
      newFolder = ensureValidName(newFolder);

      let increment = 0;
      while (await System.pathExists(newFolder)) {
        newFolder = toxenapi.path.resolve(libDir, nameNoExt + ` (${++increment})`);
      }

      await toxenapi.fs.promises.mkdir(newFolder, { recursive: true });
      await toxenapi.fs.promises.copyFile(file.path, ensureValidName(toxenapi.path.resolve(newFolder, file.name)));

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
    if (toxenapi.isDesktop()) {
      toxenapi.remote.clipboard.write({
        text: this.uid
      });
    }
    else {
      navigator.clipboard.writeText(this.uid);
    }
    Toxen.log("Copied UID to clipboard", 2000);
  }

  /**
   * Returns whether the song's media file is a video. If false, it's an audio file.
   */
  public isVideo() {
    const mediaFile = this.mediaFile();
    if (!mediaFile) return false;
    return Toxen.getSupportedVideoFiles().includes(toxenapi.getFileExtension(mediaFile).toLowerCase());
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

    return toxenapi.exportLocalSongs(...songs);
  }

  /**
   * 
   * @param progress Progress rate from 0 to 1
   * @param doComplete Whether to detect `1` as complete. If true, the progress bar will be hidden after 1 second.
   */
  public setProgressBar(progress: number, doComplete = false) {
    if (this.currentElement) {
      this.currentElement.setState({
        progressBar: progress
      });

      if (doComplete && progress >= 1) {
        this.completeProgressBar();
      }
    }
  }

  public resetProgressBar() {
    this.setProgressBar(0);
  }

  /**
   * Sets the progress bar to 100% and will be hidden after 1 second, resetting the progress bar to 0.
   */
  public completeProgressBar() {
    this.setProgressBar(1);

    // Reset the progress bar after a second
    setTimeout(() => {
      this.setProgressBar(0);
    }, 1000);
  }

  public async sync(diff?: SongDiff, { silenceValidated = false } = {}): Promise<void> {
    const user = Settings.getUser();
    if (!user.premium) return Toxen.notify({
      title: "Sync failed",
      content: "You must be a premium user to sync songs.",
      expiresIn: 5000,
      type: "error"
    }) && null;

    // if (Settings.isRemote()) return;

    if (!diff) {
      diff = (await Song.compareSongsAgainstRemote([this])).result[this.uid];
    }
    
    return toxenapi.syncSong(Toxen, user, this, diff, { silenceValidated })
  }

  public static async createCompareLocalSongsData(songs?: Song[]) {
    const user = Settings.getUser();
    if (user && !user.premium) throw new Error("You must be a premium user to compare songs against the remote.");

    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly();
    }

    let localSongsData: {
      files: Song["files"];
      hash: string
      uid: string
    }[];

    const mapSongToData = (songs: Song[]) => songs.map(s => ({
      uid: s.uid,
      files: s.files,
      hash: s.hash,
    }));
    
    if (Settings.isRemote()) {
      const localSongs = await Song.loadLocalSongs();
      localSongsData = mapSongToData((songs ? (
        songs.map(s => {
          const local = localSongs.find(ls => ls.uid === s.uid);
          return local
        })
      ) : localSongs));
    }
    else {
      localSongsData = mapSongToData((songs ?? await Song.loadLocalSongs()));
    }

    const map = localSongsData.reduce((prev, cur) => {
      prev[cur.uid] = cur;
      delete cur.uid;
      return prev;
    }, {} as Record<string, Omit<(typeof localSongsData)[number], "uid">>);

    return map;
  }

  public static async compareSongsAgainstRemote(songs?: Song[]) {
    const data = await this.createCompareLocalSongsData(songs);

    const user = Settings.getUser();
    if (user && !user.premium) throw new Error("You must be a premium user to compare songs against the remote.");

    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly();
    }

    const remoteData = await toxenapi.compareLocalSongsAgainstRemote(Toxen, user, data);

    const isInverted = Settings.isRemote();
    if (isInverted) {
      for (const uid in remoteData.result) {
        const diff = remoteData.result[uid];
        if (!diff) continue;
        [diff.download, diff.upload] = [diff.upload, diff.download];
      }
    }

    return remoteData;
  }

  public async validateAgainstRemote() {
    const user = Settings.getUser();
    if (!user.premium) throw new Error("You must be a premium user to validate a synced song.");

    if (!Settings.isRemote()) {
      // Has from disk to remote
      return toxenapi.validateSongAgainstRemote(Toxen, user, this);
    }

    throw new Error("You must be on your local machine to validate a synced song.");
  }

  // TODO: Fix this and/or figure out a better way to have the trimmer.
  // Use a function to create children to use useState for time values?
  public createTrimSongModal(): ModalSettings {
    // const values = {
    //   start: 0,
    //   end: Toxen.musicPlayer.media.duration ? Toxen.musicPlayer.media.duration * 1000 : 60000,
    // }
    const TrimSong = () => {
      if (!toxenapi.isDesktop()) {
        toxenapi.throwDesktopOnly();
      }
      const _currentTime = Toxen.musicPlayer.media.currentTime;
      const _duration = Toxen.musicPlayer.media.duration;
      const _overHalfWay = _currentTime > _duration / 2;

      const [start, setStart] = useState<number>(_overHalfWay ? 0 : Toxen.musicPlayer.media.currentTime * 1000);
      const [end, setEnd] = useState<number>(_overHalfWay ? Toxen.musicPlayer.media.currentTime * 1000 : _duration * 1000);
      const [loading, setLoading] = useState(false);
      const [showMilliseconds, setShowMilliseconds] = useState(false);
      const [progress, setProgress] = useState(0);
      const modals = useModals();
      const browser = useMemo(() => toxenapi.remote.getCurrentWindow(), []);

      let attempts = 0;

      const startTrim = async () => {
        attempts++;
        setLoading(true);
        const result = await toxenapi.ffmpeg.installFFmpeg();
        if (!result)
          return Toxen.error("FFmpeg could not be installed.");
        try {
          await toxenapi.ffmpeg.trimSong(this, start / 1000, end / 1000, p => {
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
              <Progress value={progress} animated color="green" />
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

  public getDuration(format: "s" | "ms" = "ms") {
    if (format === "s") return this.duration / 1000;
    return this.duration;
  }

  public async calculateDuration(): Promise<number> {
    const mediaFile = this.mediaFile();
    if (!mediaFile) throw new Error("No media file found for song: " + this.getDisplayName());
    const audio = new Audio(mediaFile);
    return await Song.calculateDurationFrom(audio);
  }

  public static async calculateDurationFrom(audio: HTMLAudioElement): Promise<number> {
    if (!isNaN(audio.duration) && typeof audio.duration === "number") return Math.round(audio.duration * 1000);
    return new Promise<number>((resolve, reject) => {
      audio.addEventListener("loadedmetadata", () => {
        resolve(Math.round(audio.duration * 1000));
      });
      audio.addEventListener("error", reject);
      audio.load();
    });
  }

  private static calculatingFullDuration = false;
  public static isCalculatingFullDuration() { return this.calculatingFullDuration; }
  public static async calculateFullDuration(songs: Song[], callbackPerSong?: (song: Song, duration: number | null, index: number, total: number) => void): Promise<number> {
    Song.calculatingFullDuration = true;
    let total = 0;
    let index = 0;
    let totalSongs = songs.length;
    for (const song of songs) {
      try {
        const duration = (song.duration && !isNaN(song.duration)) ? song.duration : await song.calculateDuration();
        total += duration;
        
        if (song.duration !== duration) {
          song.duration = duration;
          try {
            await song.saveInfo();
          } catch (error) {
            await song.saveInfo({ callSync: false });
          }
        }
        if (callbackPerSong) callbackPerSong(song, duration, index, totalSongs);
      } catch (error) {
        if (callbackPerSong) callbackPerSong(song, null, index, totalSongs);
        Toxen.error("Failed to calculate and save song duration: " + song.getDisplayName());
      }
      index++;
    }
    Song.calculatingFullDuration = false;
    return total;
  }
}

export interface ISong {
  // SONG SETTINGS
  uid: string;
  artist: string;
  coArtists: string[];
  title: string;
  genre: string;
  album: string;
  source: string;
  tags: string[];
  visualizerColor: string;
  visualizerStyle: VisualizerStyle;
  visualizerStyleOptions: ISettings["visualizerStyleOptions"];
  visualizerIntensity: number;
  visualizerNormalize: boolean;
  visualizerForceRainbowMode: boolean;
  /**
   * `pulse` is forced pulsing.  
   * `pulse-off` is forced no pulsing.  
   * `null` will use the global setting.
   */
  visualizerPulseBackground: "pulse" | "pulse-off";
  visualizerGlow: boolean;
  paths: ISongPaths;
  year: number;
  language: string;
  subtitleDelay: number;

  floatingTitle: boolean;
  floatingTitleText: string;
  floatingTitleUnderline: boolean;
  floatingTitlePosition:
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';
  floatingTitleReactive: boolean;
  floatingTitleOverrideVisualizer: boolean;
  useFloatingTitleSubtitles: boolean;

  // Star rush effect settings
  starRushEffect: boolean | null; // null = use global setting
  starRushIntensity: number | null; // null = use global setting

  /**
   * The files that are in the song's directory. Maps to a datetime number.  
   * The datetime number is the last modified date of the file.
   */
  files: {
    [path: string]: {
      time: number;
      action: "d" | "u";
    };
  }

  hash: string;
  duration: number; // In milliseconds
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
   * A *.tsb (Toxen Storyboard) file. Actual format is YAML data.
   */
  storyboard: string;
}

export interface SongDiff {
  upload: Record<string, { action: string, time: number }> | [] | "*",
  download: Record<string, { action: string, time: number }> | [] | "*",
  localHash?: string,
  remoteHash?: string,
}