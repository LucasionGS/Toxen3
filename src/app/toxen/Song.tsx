import React, { useMemo, useState } from "react";
import { resolve } from "path";
import Settings, { VisualizerStyle } from "./Settings";
import fsp from "fs/promises";
import { Dir, Dirent, createReadStream, createWriteStream } from "fs";
import { Toxen } from "../ToxenApp";
import Path from "path";
import SongElement from "../components/SongPanel/SongElement";
import Legacy, { Toxen2SongDetails } from "./Legacy";
import * as remote from "@electron/remote";
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
import { Checkbox, Menu, RangeSlider, Button, Progress, Group, Stack } from "@mantine/core";
import Playlist from "./Playlist";
import TButton from "../components/Button/Button";
import Ffmpeg from "./Ffmpeg";
import Time from "./Time";
import StoryboardParser from "./StoryboardParser";
import archiver from "archiver";
import { } from "buffer";
import { hashElement } from "folder-hash";
import User from "./User";
import { hideNotification, updateNotification } from "@mantine/notifications";
import HueManager from "./philipshue/HueManager";
// import ToxenInteractionMode from "./ToxenInteractionMode";

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
  public visualizerIntensity: number;
  public visualizerNormalize: boolean;
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
  public floatingTitle: boolean;
  public floatingTitleText: string;
  public floatingTitleUnderline: boolean;
  public floatingTitlePosition: ISong["floatingTitlePosition"];
  public floatingTitleReactive: boolean;
  public floatingTitleOverrideVisualizer: boolean;

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
    if (Settings.isRemote()) return `${user.getCollectionPath()}/${this.uid}${relativePath ? "/" + relativePath : ""}`;
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
    if (Settings.isRemote()) return (this.paths && this.paths.storyboard) ? `${this.dirname()}/${this.paths.storyboard}` : "";
    else return (this.paths && this.paths.storyboard) ? resolve(this.dirname(), this.paths.storyboard) : "";
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
        fsp.readFile(this.storyboardFile(), "utf8").then(data => {
          resolve(StoryboardParser.parseStoryboard(data, validateFields));
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
      "visualizerIntensity",
      "visualizerNormalize",
      "visualizerForceRainbowMode",
      "visualizerPulseBackground",
      "year",
      "language",
      "subtitleDelay",
      "floatingTitle",
      "floatingTitleText",
      "floatingTitleUnderline",
      "floatingTitlePosition",
      "floatingTitleReactive",
      "floatingTitleOverrideVisualizer",
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
    while (!skipCheck && Toxen.songList && Toxen.songList.length > 0 && Toxen.songList.some(s => s.uid === uid));
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
      if (HueManager.isEnabled()) {
        HueManager.start().catch((error) => Toxen.error(error.message));
      }
      else {
        HueManager.stop();
      }
      if (Settings.isRemote() && this.isVideo()) Toxen.log("Streaming a video can take some time to load... Using audio files is much faster.", 3000);
      if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
      let bg = this.backgroundFile();

      if (!Settings.isRemote()) {
        // Check if needs conversion
        const convertable = Toxen.getSupportedConvertableAudioFiles();
        if (convertable.includes(Path.extname(src).toLowerCase())) {
          const id = Toxen.notify({
            title: "Converting " + this.getDisplayName() + " to MP3",
            content: `0% complete`,
          });
          Ffmpeg.convertToMp3(this, (progress) => { // Purposely don't await, let it run in the background
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

  public static async convertAllNecessary(songs: Song[]) {
    if (!Settings.isRemote()) {
      // Check if needs conversion

      const globalId = Toxen.notify({
        title: "Converting all necessary",
        content: `0% complete`,
      });

      async function convertSong(song: Song) {
        const id = Toxen.notify({
          title: "Converting " + song.getDisplayName() + " to MP3",
          content: `0% complete`
        });
        await Ffmpeg.convertToMp3(song, (progress) => {
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
      songs = songs.filter(s => convertable.includes(Path.extname(s.mediaFile()).toLowerCase()))

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
    // cref?: React.RefObject<HTMLDivElement>,
    isSelected?: boolean,
    children?: React.ReactNode,
  }) {
    props ?? (props = {});
    const selectedSongs = Song.getSelected();
    const [opened, setOpened] = useState(false);

    const modals = useModals();

    let isSelected = props.isSelected ?? this.selected ?? false;

    if (!isSelected) {
      return (
        <Menu
          trigger="click"
          opened={opened}
          // onClose={() => setOpened(false)}
          closeOnClickOutside
        >
          {props.children ? (
            <Menu.Target>
              {props.children}
            </Menu.Target>
          ) : null}
          
          <Menu.Dropdown>
            <Menu.Item disabled={true}>
              {this.getDisplayName()}
            </Menu.Item>
            <Menu.Item leftSection={<i className="fas fa-edit"></i>} onClick={() => {
              if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
              if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
              Toxen.editSong(this);
            }}>
              Edit info
            </Menu.Item>
            <Menu.Item leftSection={<i className="fas fa-th-list"></i>} onClick={() => {
              modals.openModal(this.createManagePlaylists());
            }}>
              Manager playlists
            </Menu.Item>
            {!props.noQueueOption ? (this.inQueue ? (
              <Menu.Item leftSection={<i className="fas fa-minus"></i>} onClick={() => this.removeFromQueue()}>
                Remove from queue
              </Menu.Item>
            ) : (
              <Menu.Item leftSection={<i className="fas fa-plus"></i>} onClick={() => this.addToQueue()}>
                Add to queue
              </Menu.Item>
            )) : undefined}
            <Menu.Item leftSection={<i className="fas fa-search"></i>} onClick={async () => {
              if (Toxen.isMode("ThemeEditor")) return Toxen.sendError("CURRENTLY_EDITING_THEME");
              if (!Toxen.isMode("Player")) return Toxen.sendError("CURRENTLY_EDITING_SONG");
              await Toxen.sidePanel.show(true);
              await Toxen.sidePanel.setSectionId("songPanel");
              this.scrollTo();
            }}>
              Show song in list
            </Menu.Item>
            <Menu.Item leftSection={<i className="fas fa-trash-alt"></i>} color="red" onClick={() => {
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
            </Menu.Item>
            <Menu.Item leftSection={<i className="fas fa-cut"></i>} onClick={() => {
              modals.openModal(this.createTrimSongModal());
            }}>
              Trim
            </Menu.Item>
            {
              User.getCurrentUser()?.premium && !Settings.isRemote() && (
                <Menu.Item leftSection={<i className="fas fa-sync"></i>} onClick={() => {
                  this.sync();
                }}>
                  Sync to remote
                </Menu.Item>
              )
            }
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
                {/* <Menu.Item onClick={() => {
                const recorder = new ScreenRecorder();
                recorder.startRecording();
              }}>
                Record (Experimental)
              </Menu.Item> */}
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      )
    }
    else if (selectedSongs.length > 0) {
      return (
        <Menu>
          {/* <Menu.Item disabled={true}>
            Multiple songs
          </Menu.Item> */}
          <Menu.Item leftSection={<i className="far fa-check-square"></i>} onClick={() => {
            Song.deselectAll();
          }}>
            Deselect all
          </Menu.Item>
          <Menu.Item leftSection={<i className="fas fa-th-list"></i>} onClick={() => {
            const selectedSongs = Song.getSelected();
            // selectedSongs.forEach(s => s.addToPlaylist());
            // Currently disabled
            modals.openModal(Song.createManageMultiSongsPlaylists(selectedSongs));
          }}>
            Manage playlists
          </Menu.Item>
          <Menu.Item leftSection={<i className="fas fa-plus"></i>} onClick={async () => {
            const selectedSongs = Song.getSelected();
            selectedSongs.forEach(s => s.addToQueue());
          }}>
            Add to queue
          </Menu.Item>
          <Menu.Item leftSection={<i className="fas fa-minus"></i>} onClick={() => {
            const selectedSongs = Song.getSelected();
            selectedSongs.forEach(s => s.removeFromQueue());
          }}>
            Remove from queue
          </Menu.Item>
          {
            User.getCurrentUser()?.premium && !Settings.isRemote() && (
              <Menu.Item leftSection={<i className="fas fa-sync"></i>} onClick={async () => {
                const selectedSongs = Song.getSelected();
                for (const song of selectedSongs) {
                  await song.sync();
                }
              }}>
                Sync to remote
              </Menu.Item>
            )
          }
          <Menu.Item leftSection={<i className="fas fa-trash-alt"></i>} color="red" onClick={() => {
            const selectedSongs = Song.getSelected();
            modals.openConfirmModal({
              title: "Delete songs",
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
        <Menu>
          <Menu.Item disabled={true}>
            Empty
          </Menu.Item>
        </Menu>
      );
    }
  }

  // Replacement for ContextMenu, will be a modal instead
  public contextMenuModal(modals: ModalsContextProps) {

    const close = () => modals.closeModal(modalId);
    
    const modalId = modals.openModal({
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
          <Button onClick={() => {
            close();
            modals.openModal(this.createTrimSongModal());
          }}>
            Trim
          </Button>
          {
            User.getCurrentUser()?.premium && !Settings.isRemote() && (
              <Button onClick={() => {
                close();
                this.sync();
              }}>
                Sync to remote
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
              <Button onClick={() => {
                close();
                remote.shell.openPath(this.dirname());
              }}>
                Open in file explorer
              </Button>
            </>
          )}
        </Stack>
      )
    });
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
    if (this.currentElement) this.currentElement.setState({ playing: mode });
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
      let iSongs: ISong[] = await Toxen.fetch(user.getCollectionPath()).then(res => res.json()).catch(() => []);
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
        if (ent.isDirectory() && !ent.name.startsWith(".")) { // Is music folder
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
            // Attempt Locate media file
            const files = await System.recursive(songFolder);
            const sMedia = Toxen.getSupportedAudioFiles();
            let mediaFile = files.find(f => sMedia.includes(Path.extname(f.name)))?.name;

            let song = Song.create(info);
            if (mediaFile) {
              song.paths.media = mediaFile;
              songs.push(song);
              song.saveInfo();
              if (typeof forEach === "function") forEach(song);
            }

            if (typeof forEach === "function") forEach(null);
            console.warn(`Song "${songFolder}" is missing a media file. Excluding from song list.`);
            const nId = Toxen.notify({
              title: "Song missing media file",
              content: <div>
                <p>The song <b>{song.getDisplayName()}</b> is missing a media file. </p>
                <p>Do you want to remove it from the library?</p>
                <Group>
                  <Button color="red" onClick={() => {
                    hideNotification(nId);
                    song.delete();
                  }}>Delete</Button>
                  <Button color="green" onClick={() => hideNotification(nId)}>Ask later</Button>
                  <Button color="blue" onClick={() => {
                    remote.shell.openPath(song.dirname());
                  }}>Show Folder</Button>
                </Group>
              </div>,
              type: "warning",
            })
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
    let iSongs: ISong[] = await Toxen.fetch(user.getCollectionPath()).then(res => res.json());
    const songs: Song[] = iSongs.map(iSong => Song.create(iSong)).filter(s => s.paths && s.paths.media);
    if (forEach) {
      songs.forEach(forEach);
    }
    return Song.sortSongs(songs);
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
      // Play the next song if this is the current song
      let cur = Song.getCurrent();
      if (cur && cur.uid === this.uid) {
        await Toxen.musicPlayer.playNext();
      }
      try {
        await fsp.rm(this.dirname(), { recursive: true });
      } catch (error) {
        try {
          await fsp.rm(this.dirname(), { recursive: true, }); // Try again
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
      return await Toxen.fetch(user.getCollectionPath() + "/" + this.uid + "/info.json", {
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
    const ensureValidName = (path: string) => path.replace(/[^:\\\/a-z0-9\(\)\[\]\{\}\.\-\_\s]/gi, "_");
    return Promise.resolve().then(async () => {
      let supported = Toxen.getSupportedMediaFiles();
      if (!supported.some(s => Path.extname(file.name) === s)) return new Failure(file.name + " isn't a valid file");

      let libDir = Settings.get("libraryDirectory");
      let nameNoExt = Converter.trimChar(Path.basename(file.name, Path.extname(file.name)), ".");
      let newFolder = Path.resolve(libDir, nameNoExt);

      // Validate folder name
      newFolder = ensureValidName(newFolder);

      let increment = 0;
      while (await System.pathExists(newFolder)) {
        newFolder = Path.resolve(libDir, nameNoExt + ` (${++increment})`);
      }

      await fsp.mkdir(newFolder, { recursive: true });
      await fsp.copyFile(file.path, ensureValidName(Path.resolve(newFolder, file.name)));

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

  public async sync({ silenceValidated = false } = {}): Promise<void> {
    const user = Settings.getUser();
    if (!user.premium) return Toxen.notify({
      title: "Sync failed",
      content: "You must be a premium user to sync songs.",
      expiresIn: 5000,
      type: "error"
    }) && null;

    if (Settings.isRemote()) return;
    this.setProgressBar(0.10);
    try {
      const upToDate = await this.validateAgainstRemote();

      if (upToDate) {
        if (!silenceValidated) {
          this.completeProgressBar();
          Toxen.notify({
            title: "Update-to-date",
            content: <p><code>{this.getDisplayName()}</code> is already up to date.</p>,
            expiresIn: 1000
          });
        }
        return;
      }
    } catch (error) {
      this.completeProgressBar();
      return Toxen.notify({
        title: "Failed to validate against remote",
        content: error.message,
        expiresIn: 5000,
        type: "error"
      }) && null;
    }

    // Sync from disk to remote (Using archiver to zip the folder in memory)
    this.setProgressBar(0.25);
    const zip = new yazl.ZipFile();

    const zipPathTmp = Path.resolve(os.tmpdir(), "toxen-sync-" + Math.random().toString().substring(2) + ".zip");
    const zipStream = createWriteStream(zipPathTmp);

    const addFiles = async (dir: string, startingDir: string = dir) => {
      const files = await fsp.readdir(dir);
      for (const file of files) {
        const filePath = Path.resolve(dir, file);
        const stat = await fsp.stat(filePath);
        const relativePath = Path.relative(startingDir, filePath);
        if (stat.isDirectory()) {
          zip.addEmptyDirectory(relativePath);
          await addFiles(filePath, startingDir);
        } else {
          zip.addReadStream(createReadStream(filePath), relativePath);
        }
      }
    };

    await addFiles(this.dirname());

    zip.outputStream.pipe(zipStream);

    zip.end();
    this.setProgressBar(0.5);

    return await new Promise((resolve, reject) => {
      zipStream.on("finish", resolve);
      zipStream.on("error", reject);
    }).then(async () => {
      const formData = new FormData();
      // Insert as blob
      formData.append("file", new Blob([await fsp.readFile(zipPathTmp)]), "sync.zip");
      formData.append("data", JSON.stringify(this.toISong()));
      return Toxen.fetch(user.getCollectionPath() + "/" + this.uid, {
        method: "PUT",
        body: formData
      });
    }).then(async res => {
      if (res.ok) {
        this.completeProgressBar();
        Toxen.notify({
          title: "Synced",
          content: this.getDisplayName(),
          expiresIn: 5000
        });
        return fsp.unlink(zipPathTmp);
      } else {
        this.setProgressBar(0);
        Toxen.notify({
          title: "Sync failed",
          content: await res.text(),
          expiresIn: 5000,
          type: "error"
        });
      }
    }).catch(error => {
      this.setProgressBar(0);
      Toxen.error("Something went wrong writing the exported zip file.");
      console.error(error);
      return fsp.unlink(zipPathTmp);
    });
  }

  public async validateAgainstRemote() {
    const user = Settings.getUser();
    if (!user.premium) throw new Error("You must be a premium user to validate a synced song.");

    if (!Settings.isRemote()) {
      // Has from disk to remote
      const { hash: localHash } = await hashElement(this.dirname(), {
        folders: {
          ignoreBasename: true,
        }
      });
      console.log("Local hash", localHash);
      const remoteHash: string = await Toxen.fetch(user.getCollectionPath() + "/" + this.uid, {
        method: "OPTIONS"
      }).then(res => res.json()).then(res => res.hash).catch(() => null);
      console.log("Remote hash", remoteHash);
      return localHash === remoteHash;
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
      const _currentTime = Toxen.musicPlayer.media.currentTime;
      const _duration = Toxen.musicPlayer.media.duration;
      const _overHalfWay = _currentTime > _duration / 2;

      const [start, setStart] = useState<number>(_overHalfWay ? 0 : Toxen.musicPlayer.media.currentTime * 1000);
      const [end, setEnd] = useState<number>(_overHalfWay ? Toxen.musicPlayer.media.currentTime * 1000 : _duration * 1000);
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
  visualizerIntensity: number;
  visualizerNormalize: boolean;
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