// import * as remote from "@electron/remote";
import { EventEmitter } from "events";
import React from "react";
import Background from "./components/Background/Background";
import LoadingScreen from "./components/LoadingScreen";
import MusicControls from "./components/MusicControls";
import MusicPlayer from "./components/MusicPlayer";
import ProgressBar from "./components/ProgressBar";
import Form from "./components/Form/Form";
import Sidepanel from "./components/Sidepanel/Sidepanel";
import SidepanelSection from "./components/Sidepanel/SidepanelSection";
import SongPanel from "./components/SongPanel/SongPanel";
import Settings, { VisualizerStyle } from "./toxen/Settings";
import Song from "./toxen/Song";
import "./ToxenApp.scss";
import "./tx.scss";
import System from "./toxen/System";
import SidepanelSectionHeader from "./components/Sidepanel/SidepanelSectionHeader";
import SearchField from "./components/SongPanel/SearchField";
import Stats from "./toxen/Statistics";
import StoryboardEditorPanel from "./components/StoryboardEditorPanel/StoryboardEditorPanel";
import SubtitleEditorPanel from "./components/SubtitleEditorPanel/SubtitleEditorPanel";
import { MessageCardOptions } from "./components/MessageCard/MessageCards";
import ExternalUrl from "./components/ExternalUrl/ExternalUrl";
import showdown from "showdown";
import htmlToReactParser, { Element, Text } from "html-react-parser";
import AboutSection from "./components/AboutSection";
import SongQueuePanel from "./components/SongPanel/SongQueuePanel";
import Subtitles from "./components/Subtitles/Subtitles";
import ToxenInteractionMode from "./toxen/ToxenInteractionMode";
import Playlist from "./toxen/Playlist";
import PlaylistPanel from "./components/PlaylistPanel/PlaylistPanel";
import TButton from "./components/Button/Button";
import type Discord from "./toxen/desktop/Discord";
import ThemeContainer from "./components/ThemeContainer/ThemeContainer";
import ThemeEditorPanel from "./components/ThemeEditorPanel/ThemeEditorPanel";
import Theme from "./toxen/Theme";
import AppBar from "./components/AppBar/AppBar";
import EffectsPanel from "./components/EffectsPanel/EffectsPanel";
import { Button } from "@mantine/core";
import { Notifications, showNotification } from "@mantine/notifications";
import SettingsPanel from "./components/Sidepanel/Panels/SettingsPanel/SettingsPanel";
// import MigrationPanel from "./components/Sidepanel/Panels/MigrationPanel/MigrationPanel";
import EditSong from "./components/Sidepanel/Panels/EditSong/EditSong";
import InitialData from "./windows/SubtitleCreator/models/InitialData";
import User from "./toxen/User";
import { IconLayoutNavbarExpand } from "@tabler/icons-react";
// import HueManager from "./toxen/philipshue/HueManager";
import ImportPanel from "./components/Sidepanel/Panels/ImportPanel/ImportPanel";
// import YTDlpWrap from "yt-dlp-wrap";
import StoryboardEditor, { StoryboardEditorController } from "./components/StoryboardEditor/StoryboardEditor";
import SubtitleEditor from "./components/SubtitleEditor/SubtitleEditor";
import { modals } from "@mantine/modals";
import LoginForm from "./components/LoginForm/LoginForm";
import AudioEffects from "./toxen/AudioEffects";
import ImageCache from "./toxen/ImageCache";

//#region Define variables used all over the ToxenApp process.
/**
 * Handler for events during runtime.
 */
export class Toxen {
  public static async getBlob(src: string) {
    return fetch(src).then((r) => r.blob());
  }

  public static setTitle(title: string) {
    Toxen.setAppBarText(title);
    document.title = title;
  }

  public static cleanPath(path: string) {
    // Remove unsupported characters
    const cleaner = /[*?"<>|]/g;
    return path.replace(cleaner, "_")
  }

  // private static reloadables: Record<string, () => void> = {};
  // public static setReloadable(id: string, callback: () => void) { Toxen.reloadables[id] = callback; }
  // public static removeReloadable(id: string) { delete Toxen.reloadables[id]; }

  // public static reloadReloadable(id?: string) {
  //   if (id) {
  //     console.log(Toxen.reloadables);
  //     try {
  //       console.log("Reloading", id);
  //       Toxen.reloadables[id]();
  //     } catch (error) {
  //       Toxen.error(error.message);
  //     }
  //     return;
  //   }
  //   for (const id in Toxen.reloadables) {
  //     Toxen.reloadables[id]();
  //   }
  // }

  public static setAppBarText: (text: string) => void = () => void 0;
  public static setAppBarUser: (user: User) => void = () => void 0;

  private static mode: ToxenInteractionMode = ToxenInteractionMode.Player;
  public static getMode(): ToxenInteractionMode {
    return Toxen.mode;
  }

  public static setMode(mode: "StoryboardEditor", song: Song): void;
  public static setMode(mode: ToxenInteractionMode.StoryboardEditor, song: Song): void;
  public static setMode(mode: "SubtitlesEditor", song: Song): void;
  public static setMode(mode: ToxenInteractionMode.SubtitlesEditor, song: Song): void;
  public static setMode(mode: ToxenInteractionMode | keyof typeof ToxenInteractionMode): void;
  public static setMode(mode: ToxenInteractionMode | keyof typeof ToxenInteractionMode, data?: any) {
    if (typeof mode == "string") {
      mode = ToxenInteractionMode[mode];
    }
    Toxen.mode = mode;
    // Actions on specific modes
    Toxen.sidePanel.setHidden(false);
    switch (mode) {
      case ToxenInteractionMode.Player: {
        Toxen.sidePanel.setSectionId("songPanel");
        if (Toxen.subtitleEditorOpen) {
          Toxen.subtitleEditorOpen = false;
          Toxen.appRenderer?.forceUpdate();
        }
        break;
      }

      case ToxenInteractionMode.StoryboardEditor: {
        (Toxen.editingSong = data as Song).play();
        // Toxen.sidePanel.setSectionId("storyboardEditor");
        Toxen.sidePanel.setHidden(true);
        Toxen.storyboardEditorController.start();
        break;
      }

      case ToxenInteractionMode.SubtitlesEditor: {
        Toxen.editingSong = data as Song;
        if (Toxen.editingSong) {
          Toxen.editingSong.play();
        }
        Toxen.sidePanel.setHidden(true);
        Toxen.subtitleEditorOpen = true;
        // Force re-render to show subtitle editor
        Toxen.appRenderer?.forceUpdate();
        break;
      }

      case ToxenInteractionMode.ThemeEditor: {
        Toxen.sidePanel.setSectionId("themeEditor");
        break;
      }
    }
  }

  public static isMode(mode: ToxenInteractionMode | keyof typeof ToxenInteractionMode) {
    if (typeof mode == "string") {
    } else {
      return Toxen.mode == mode;
    }
    return Toxen.mode == ToxenInteractionMode[mode];
  }

  /**
   * Used for fetching URLs and supports tx:// and txs:// URLs. (Gets converted to http(s)://)
   */
  public static fetch(input: string, init?: RequestInit) {
    return fetch(Toxen.txToHttp(input), {
      credentials: "include",
      ...init,
    });
  }

  public static async getChangeLogs() {
    return Toxen.changeLogs = Toxen.changeLogs ?? await fetch("https://raw.githubusercontent.com/LucasionGS/Toxen3/master/changenotes.md")
      .then(res => res.text())
      .then(text => {
        console.log("Parsing changelog...");
        const converter = new showdown.Converter();
        const html = converter.makeHtml(text);
        return htmlToReactParser(html, {
          replace: (domNode: Element) => {
            if (domNode.name == "a" && !domNode.attribs.href.startsWith("#")) {
              return <ExternalUrl href={domNode.attribs.href}>{domNode.children.map((c: Text) => c.data)}</ExternalUrl>;
            }
          }
        });
      })
  }
  public static resetChangeLogs() {
    Toxen.changeLogs = undefined;
  }
  private static changeLogs: string | JSX.Element | JSX.Element[];

  /**
   * Converts a http(s) URL to a tx(s) URL.
   */
  public static httpToTx(url: string) {
    return url.replace(/^http(s)?:\/\//, (_: string, $1: string) => `tx${$1 || ""}://`);
  }

  /**
   * Converts a tx(s) URL to a http(s) URL.
   */
  public static txToHttp(url: string) {
    return url.replace(/^tx(s)?:\/\//, (_: string, $1: string) => `http${$1 || ""}://`);
  }

  public static whenReady() {
    return this.resolvedOnReady;
  }

  public static _resolveWhenReady: () => void;
  private static resolvedOnReady = new Promise<void>(resolve => Toxen._resolveWhenReady = resolve);


  public static log(message: React.ReactNode, expiresIn?: number) {
    console.log(message);
    return Toxen.notify({
      title: "Info",
      content: message,
      expiresIn: expiresIn,
      type: "normal",
    });
  }
  public static warn(message: React.ReactNode, expiresIn?: number) {
    console.warn(message);
    Toxen.notify({
      title: "Warning",
      content: message,
      expiresIn: expiresIn,
      type: "warning",
    });
  }
  public static error(message: React.ReactNode, expiresIn?: number) {
    console.error(message);
    Toxen.notify({
      title: "Error",
      content: message,
      expiresIn: expiresIn,
      type: "error",
    });
  }

  private static presetErrors = {
    CURRENTLY_EDITING_SONG: ["You are currently editing a song. Please save or cancel your changes.", 5000],
    CURRENTLY_EDITING_THEME: ["You are currently editing a theme. Please save or cancel your changes.", 5000],
    CURRENTLY_EDITING_SUBTITLES: ["You are currently editing subtitles. Please save or cancel your changes.", 5000],
  }
  public static sendError(error: keyof typeof Toxen.presetErrors) {
    const [message, expiresIn] = Toxen.presetErrors[error] as [string, number];
    return Toxen.error(message, expiresIn);
  }

  public static sendModeError(mode: ToxenInteractionMode | keyof typeof ToxenInteractionMode) {
    if (typeof mode == "string") {
      mode = ToxenInteractionMode[mode];
    }

    switch (mode) {
      case ToxenInteractionMode.StoryboardEditor:
        if (Toxen.isMode(ToxenInteractionMode.StoryboardEditor)) {
          Toxen.error("You are currently editing a storyboard. Please save or cancel your changes.");
          return;
        }
        break;
      case ToxenInteractionMode.SubtitlesEditor:
        if (Toxen.isMode(ToxenInteractionMode.SubtitlesEditor)) {
          Toxen.error("You are currently editing subtitles. Please save or cancel your changes.");
          return;
        }
        break;
      case ToxenInteractionMode.ThemeEditor:
        if (Toxen.isMode(ToxenInteractionMode.ThemeEditor)) {
          Toxen.sendError("CURRENTLY_EDITING_THEME");
          return;
        }
        break;
      case ToxenInteractionMode.Player:
        if (!Toxen.isMode(ToxenInteractionMode.Player)) {
          Toxen.error("You are not in player mode. Please switch to player mode to perform this action.");
          return;
        }
        break;
    }
  }

  public static async filterSupportedFiles(path: string, supported: string[]) {
    return (
      Settings.isRemote() ? await Toxen.fetch(path).then(res => res.json()) as { name: string }[]
        : await System.recursive(path)
    )
      .filter(f => {
        let ext = toxenapi.getFileExtension(f.name);
        return supported.includes(ext);
      }).map(f => f.name);
  }

  public static getSupportedConvertableAudioFiles() {
    return [
      ".wma",
    ];
  }

  public static getSupportedAudioFiles() {
    return [
      ".mp3",
      ".flac",
      ".ogg",
      ".wav",

      // To be converted
      ...Toxen.getSupportedConvertableAudioFiles(),
    ];
  }

  public static getSupportedVideoFiles() {
    return [
      ".mp4"
    ];
  }

  public static getSupportedMediaFiles() {
    return Toxen.getSupportedAudioFiles().concat(Toxen.getSupportedVideoFiles());
  }

  public static getSupportedImageFiles() {
    return [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webm",
      ".webp",
      ".jfif",
    ];
  }

  public static getSupportedSubtitleFiles() {
    return [
      ".srt",
      ".tst",
      ".lrc",
      ".vtt"
    ];
  }

  public static getSupportedStoryboardFiles() {
    return [
      ".tsb",
    ];
  }

  public static async showCurrentSong() {
    if (!Toxen.sidePanel.isShowing()) await Toxen.sidePanel.show(true);
    if (Toxen.sidePanel.state.sectionId !== "songPanel") await Toxen.sidePanel.setSectionId("songPanel");
    let song = Song.getCurrent();
    if (song) song.scrollTo();
  }

  // Objects
  public static sidePanel: Sidepanel;
  public static songPanel: SongPanel;
  public static songQueuePanel: SongQueuePanel;
  public static playlistPanel: PlaylistPanel;
  public static musicPlayer: MusicPlayer;
  public static musicControls: MusicControls;
  public static audioEffects: AudioEffects;
  public static subtitles: Subtitles;
  public static themeContainer: ThemeContainer;
  public static updateSongPanels() {
    Toxen.songQueuePanel?.update();
    Toxen.songPanel?.update();
  }
  /**
   * Send a message to the Toxen message cards.
   */
  public static notify(notification: Omit<Omit<MessageCardOptions, "createdAt">, "uniqueId">) {
    // this.messageCards.addMessage(notification);
    const id = Math.random().toString(36).substring(2);
    showNotification({
      id,
      message: notification.content,
      // disallowClose: notification.disableClose ?? false,
      withCloseButton: !(notification.disableClose ?? false),
      autoClose: notification.expiresIn ?? false,
      title: notification.title,
      color: notification.type == "error" ? "red" : notification.type == "warning" ? "yellow" : "green",
    });
    return id;
  }

  // Forms
  public static settingsForm: Form;
  public static editSongForm: Form;

  public static saveSettings() {
    setTimeout(() => {
      try {
        Toxen.settingsForm.submit();
        Toxen.updateSettings();
      } catch (error) {

      }
    }, 100);
  }

  /**
   * Applies the current GUI settings to the GUI.
   */
  public static updateSettings() {
    // let curSong = Song.getCurrent();
    Toxen.sidePanel.setVertical(Settings.get("panelVerticalTransition") ?? false);
    Toxen.sidePanel.setDirection(Settings.get("panelDirection") ?? "left");
    Toxen.sidePanel.setExposeIcons(
      document.body.classList.toggle("exposed-icons", Settings.get("exposePanelIcons") ?? false)
    );
    Toxen.setAllVisualColors(Toxen.background.storyboard.getVisualizerColor());
    (Settings.get("visualizerStyle") || Settings.set("visualizerStyle", VisualizerStyle.ProgressBar /* Default */));

    Toxen.musicControls.setVolume(Settings.get("volume") ?? 50);

    document.body.classList.toggle("advanced", Settings.isAdvanced());

    // Disable hueEnabled while its still broken.
    // if (Settings.get("hueEnabled")) Settings.set("hueEnabled", false);
    
    // if (toxenapi.isDesktop() && Settings.get("hueEnabled") && !HueManager.instance) {
    //   HueManager.init({
    //     ip: Settings.get("hueBridgeIp"),
    //     username: Settings.get("hueUsername"),
    //     clientkey: Settings.get("hueClientkey"),
    //   });

    //   if (Settings.get("hueEntertainmentAreaId")) {
    //     HueManager.instance.getEntertainmentArea(
    //       Settings.get("hueEntertainmentAreaId")
    //     ).then(area => {
    //       HueManager.setCurrentArea(area);
    //     }).catch(err => {
    //       HueManager.setCurrentArea(null);
    //       Toxen.error(err);
    //     });
    //   }
    // }

    Toxen.discord?.setPresence();
  }

  public static themes: Theme[] = [];
  public static theme: Theme = null;
  
  public static setTheme(theme: Theme) {
    Toxen.theme = theme;
    Toxen.themeContainer.setTheme(theme);
    Settings.set("theme", theme?.name ?? null);
    Settings.save({
      suppressNotification: true,
    });
  }

  public static setThemeByName(name: string) {
    let theme = Toxen.themes.find(t => t.name === name);
    if (!theme && name) Toxen.error(`Theme ${name} not found.`);
    Toxen.setTheme(theme || null);
  }

  /**
   * Creates an autogenerated theme based on the visualizer color
   */
  public static createAutogeneratedTheme(visualizerColor: string): Theme {
    // Parse the visualizer color
    const hexMatch = visualizerColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!hexMatch) {
      console.warn('Invalid visualizer color format:', visualizerColor);
      return Theme.createDefaultTheme();
    }

    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);

    // Create a theme based on the current theme or default theme
    const baseTheme = Toxen.theme || Theme.createDefaultTheme();
    
    const autogenTheme = Theme.create({
      name: `Autogenerated (${visualizerColor})`,
      displayName: `Autogenerated Theme`,
      description: `Automatically generated theme based on visualizer color ${visualizerColor}`,
      styles: { ...baseTheme.styles },
      customCSS: baseTheme.customCSS
    });

    // Override the accent colors with the visualizer color
    if (autogenTheme.styles['accentColor']) {
      autogenTheme.styles['accentColor'].value = [r, g, b];
    }
    if (autogenTheme.styles['accentColorRgb']) {
      autogenTheme.styles['accentColorRgb'].value = [r, g, b];
    }
    
    // Also update related colors that should follow the accent
    if (autogenTheme.styles['borderPrimary']) {
      autogenTheme.styles['borderPrimary'].value = [r, g, b];
    }
    if (autogenTheme.styles['borderFocus']) {
      autogenTheme.styles['borderFocus'].value = [r, g, b];
    }
    if (autogenTheme.styles['playerPlaying']) {
      autogenTheme.styles['playerPlaying'].value = [r, g, b];
    }

    return autogenTheme;
  }

  /**
   * Applies an autogenerated theme if enabled for the current song
   */
  public static applyAutogeneratedThemeIfEnabled() {
    const currentSong = Song.getCurrent();
    if (!currentSong || (
      currentSong.getEffectiveSettings().autogeneratedTheme !== true
      && !Settings.get("autogeneratedTheme", false)
    )) {
      Toxen.restoreOriginalTheme();
      return;
    }

    // Check if autogenerated theme is enabled for this song
    // First check song-specific setting, then fall back to global setting
    const songAutogenEnabled = Toxen.background.storyboard.getAutogeneratedTheme();
    const globalAutogenEnabled = Settings.get("autogeneratedTheme");
    
    // Song-specific setting takes precedence: 
    // - If song has true/false explicitly set, use that
    // - If song has null/undefined, use global setting
    const autogenEnabled = songAutogenEnabled !== null && songAutogenEnabled !== undefined 
      ? songAutogenEnabled 
      : globalAutogenEnabled;

    if (autogenEnabled) {
      // Get the current visualizer color
      const visualizerColor = Toxen.background.storyboard.getVisualizerColor();
      
      // Apply the autogenerated theme as an overlay, don't replace the main theme
      Toxen.applyAutogeneratedThemeOverlay(visualizerColor);
    } else {
      // Remove the autogenerated theme overlay
      Toxen.removeAutogeneratedThemeOverlay();
    }
  }

  /**
   * Applies an autogenerated theme as an overlay on top of the current theme
   */
  public static applyAutogeneratedThemeOverlay(visualizerColor: string) {
    // Parse the visualizer color
    const hexMatch = visualizerColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i);
    if (!hexMatch) {
      console.warn('Invalid visualizer color format:', visualizerColor);
      return;
    }

    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);
    // alpha is not used here

    // Create or update the autogenerated theme overlay
    const overlayId = 'autogenerated-theme-overlay';
    let overlayElement = document.getElementById(overlayId);
    
    if (!overlayElement) {
      overlayElement = document.createElement('style');
      overlayElement.id = overlayId;
      document.head.appendChild(overlayElement);
    }

    // Create CSS variables for the autogenerated colors
    const css = `
      :root {
        --accent-color: ${visualizerColor};
        --accent-color-rgb: ${r}, ${g}, ${b};
        --accent-color-dim: rgba(${r}, ${g}, ${b}, 0.15);
        --accent-color-hover: rgba(${r}, ${g}, ${b}, 0.25);
        --accent-color-active: rgba(${r}, ${g}, ${b}, 0.4);
        --border-primary: rgba(${r}, ${g}, ${b}, 0.15);
        --border-focus: ${visualizerColor};
        --player-playing: ${visualizerColor};
        --shadow-accent: rgba(${r}, ${g}, ${b}, 0.2);
      }
    `;

    overlayElement.textContent = css;
  }

  /**
   * Removes the autogenerated theme overlay
   */
  public static removeAutogeneratedThemeOverlay() {
    const overlayId = 'autogenerated-theme-overlay';
    const overlayElement = document.getElementById(overlayId);
    
    if (overlayElement) {
      overlayElement.remove();
    }
  }

  /**
   * Restores the original theme if an autogenerated theme is currently applied
   */
  public static restoreOriginalTheme() {
    // With the overlay approach, we just remove the overlay
    Toxen.removeAutogeneratedThemeOverlay();
  }

  public static loadingScreen: LoadingScreen;
  public static background: Background;
  public static storyboardEditorController: StoryboardEditorController;
  public static subtitleEditorOpen: boolean = false;
  public static appRenderer: React.Component;

  public static songSearch = "";
  /**
   * The full list of songs loaded.
   */
  public static songList: Song[];
  public static searchedSongList: Song[];
  private static setSongList(songList: Song[]) {
    const cur = Song.getCurrent();
    if (cur) {
      const newCur = songList.find(s => s.uid === cur.uid);
      if (newCur) newCur.setCurrent();
    }
    Toxen.songList = songList;
  }
  public static songQueue: Song[] = [];

  public static playlists: Playlist[];
  /**
   * The current playlist being used.
   */
  public static playlist: Playlist;
  private static setPlaylists(playlists: Playlist[]) {
    Toxen.playlists = playlists;
  }

  /**
   * Returns all songs in songList and songQueue.
   */
  public static getAllSongs() {
    return (Toxen.songList || []).concat(Toxen.songQueue);
  }

  public static getPlayableSongs(): readonly Song[] {
    // Priority
    /* Song queue         */ if (Toxen.songQueue && Toxen.songQueue.length > 0) return Toxen.songQueue;
    /* Search result list */ if (Toxen.searchedSongList && Toxen.searchedSongList.length > 0) return Toxen.searchedSongList;
    /* Playlist song list */ if (Toxen.playlist && Toxen.playlist.songList.length > 0) return Toxen.playlist.songList;
    /* Full song list     */ if (Toxen.songList && Toxen.songList.length > 0) return Toxen.songList;
    return [];
  }

  public static async loadSongs() {
    const cur = Song.getCurrent();
    Toxen.loadingScreen.toggleVisible(true);
    let songCount = 0;
    let totalSongCount = await Song.getSongCount();
    const loadingCallback = () => {
      let ref: ProgressBar;
      let content = (
        <>
          <p>Loading songs...<br />{++songCount}/{totalSongCount}</p>
          <div>
            <ProgressBar ref={_ref => ref = _ref} min={0} max={totalSongCount} />
          </div>
        </>
      );


      Toxen.loadingScreen.setContent(content);
      if (ref) {
        ref.setValue(songCount);
        ref.setMin(0);
        ref.setMax(totalSongCount);
      }
    };
    try {
      var songList = await Song.getSongs(true, loadingCallback);
    } catch (error) {
      Settings.set("isRemote", false);
      var songList = await Song.getSongs(true, loadingCallback);
    }

    // Check to ensure all songs have an MD5 hash
    if (!Settings.isRemote()) {
      for (const song of songList) {
        if (!song.hash) {
          console.warn("Song \"" + song.title + "\" does not have an MD5 hash. Generating one now...", 1000);
          song.hash = Song.randomFileHash();
          await song.saveInfo({
            callSync: false
          });
          console.warn("MD5 hash generated for \"" + song.title + "\": " + song.hash, 1000);
        }
      }
    }

    Toxen.setSongList(songList);

    try {
      Toxen.setPlaylists(await Playlist.load());
      await Playlist.save();

      if (Toxen.playlist) {
        Toxen.playlist = Toxen.playlists.find(p => p.name === Toxen.playlist.name); // Recover last playlist
      }
    }
    catch (error) {
      Toxen.error(error.message);
    }
    Toxen.loadingScreen.toggleVisible(false);
    if (cur) {
      const equal = Toxen.songList.find(s => s.uid === cur.uid);
      if (equal) {
        equal.setCurrent();
        equal.scrollTo();
      }
    }
  }

  public static async loadThemes() {
    Toxen.themes = await Theme.load();
    let theme = Toxen.themes.find(t => t.name === Settings.get("theme"));
    if (!Toxen.theme) {
      Settings.set("theme", null);
    }
    Toxen.setTheme(theme ?? null);
  }

  public static editingSong: Song = null;
  public static editSong(song: Song) {
    if (Toxen.editingSong == song) {
      if (!Toxen.isMode("Player")) {
        return Toxen.sidePanel.show(true);
      }
      Toxen.sidePanel.show(true);
      Toxen.sidePanel.setSectionId("editSong");
      return;
    }
    Toxen.editingSong = song;
    if (!Toxen.sidePanel.isShowing()) Toxen.sidePanel.show(true);
    if (Toxen.sidePanel.state.sectionId === "editSong") Toxen.reloadSection();
    else Toxen.sidePanel.setSectionId("editSong");
  }

  public static toggleFullscreen(force?: boolean) {
    if (!toxenapi.isDesktop()) {
      return Toxen.error("Fullscreen is only available on the desktop version of Toxen.", 5000);
    }

    const w = toxenapi.remote.getCurrentWindow();
    const newMode = force ?? !w.isFullScreen();

    if (newMode && Toxen.isMiniplayer()) {
      Toxen.toggleMiniplayer(false);
    }

    w.setFullScreen(newMode);
    document.body.toggleAttribute("fullscreen", newMode);
  }

  private static _widthBeforeMiniplayer: number;
  private static _heightBeforeMiniplayer: number;
  private static _xBeforeMiniplayer: number;
  private static _yBeforeMiniplayer: number;
  private static _maximizedBeforeMiniplayer: boolean;

  private static _miniplayerWidth = 300;
  private static _miniplayerHeight = Math.floor(300 / 16 * 9);

  public static toggleMiniplayer(force?: boolean) {
    if (!toxenapi.isDesktop()) {
      return Toxen.error("Miniplayer is only available on the desktop version of Toxen.", 5000);
    }
    
    const w = toxenapi.remote.getCurrentWindow();
    const newMode = force ?? !Toxen.isMiniplayer();

    if (newMode && w.isFullScreen()) {
      Toxen.toggleFullscreen(false);
    }

    if (newMode && w.isMaximized()) {
      this._maximizedBeforeMiniplayer = true;
      w.unmaximize();
    }

    document.body.toggleAttribute("miniplayer", newMode);

    // If true, set always on top
    if (newMode) {
      w.setAlwaysOnTop(true);
      w.setMaximizable(false);
      const size = w.getSize();
      Toxen._widthBeforeMiniplayer = size[0];
      Toxen._heightBeforeMiniplayer = size[1];
      const pos = w.getPosition();
      Toxen._xBeforeMiniplayer = pos[0];
      Toxen._yBeforeMiniplayer = pos[1];
      w.setSize(Toxen._miniplayerWidth, Toxen._miniplayerHeight);
      w.setPosition(screen.availWidth - Toxen._miniplayerWidth, screen.availHeight - Toxen._miniplayerHeight);
    } else {
      w.setAlwaysOnTop(false);
      w.setMaximizable(true);
      w.setSize(Toxen._widthBeforeMiniplayer, Toxen._heightBeforeMiniplayer);
      w.setPosition(Toxen._xBeforeMiniplayer, Toxen._yBeforeMiniplayer);
      if (Toxen._maximizedBeforeMiniplayer) {
        w.maximize();
        Toxen._maximizedBeforeMiniplayer = false;
      }
    }
  }

  public static isMiniplayer() {
    return document.body.hasAttribute("miniplayer");
  }

  public static async reloadSection() {
    // let id = Toxen.sidePanel.state.sectionId;
    // Toxen.sidePanel.setSectionId("$empty");
    // setTimeout(() => {
    //   Toxen.sidePanel.setSectionId(id);
    // }, 0);
    return Toxen.sidePanel.reloadSection();
  }

  /**
   * Applies the same color to all RGB visual UI elements. Things like Audio visualizer, and song progress bar.
   */
  public static setAllVisualColors(color: string) {
    color = color || Settings.get("visualizerColor");
    Toxen.musicControls.progressBar.setFillColor(color);
  }

  public static get discord(): Discord | null {
    return toxenapi.isDesktop() ? toxenapi.getDiscordInstance() : null;
  }

  public static async syncSongs(songs?: Song[]) {
    // If not logged in, return
    if (!toxenapi.isDesktop()) {
      return toxenapi.throwDesktopOnly();
    }
    const browser = toxenapi.remote.getCurrentWindow();

    const songData = await Song.compareSongsAgainstRemote(songs);
    
    console.log("Syncing songs...", songData);
    
    // return;
    const currentQueue = [...(songs ?? Toxen.songList)];
    const total = currentQueue.length;
    // 5 songs at a time
    let untilFinished = 5;
    const startingQueue = currentQueue.splice(0, untilFinished);

    function syncSong(song: Song) {
      song.sync(songData.result[song.uid]).then(() => {
        const next = currentQueue.shift();
        if (next) {
          syncSong(next);
        }
        else {
          untilFinished--;
        }
        
        browser.setProgressBar((total - currentQueue.length) / total);

        if (untilFinished <= 0) {
          Toxen.log("✅ Synced all songs.", 2500);
          browser.setProgressBar(-1);
        }
        
      }).catch(err => {
        Toxen.error(`Error syncing ${song.getDisplayName()}: ${err.message}`);
      });
    }
    
    for (let i = 0; i < startingQueue.length; i++) {
      syncSong(startingQueue[i]);
    }
  }

  /**
   * Initialize image cache and set up periodic cleanup
   */
  public static initializeImageCache() {
    // Set up cache cleanup every 5 minutes
    setInterval(() => {
      ImageCache.getInstance().cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Invalidate cache when a song's background changes
   */
  public static invalidateSongBackgroundCache(song: Song) {
    if (song.backgroundFile()) {
      const bgFile = `${song.backgroundFile()}?h=${song.hash}`;
      ImageCache.getInstance().invalidate(bgFile);
    }
  }
}

class ToxenEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.on("error", (error) => {
      Toxen.error(error.message);
    });
  }
}

interface ToxenEventEmitter extends EventEmitter {
  // Error
  on(event: "error", listener: (error: Error) => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  emit(event: "error", error: Error): boolean;

  // Song ended
  on(event: "songEnded", listener: () => void): this;
  once(event: "songEnded", listener: () => void): this;
  off(event: "songEnded", listener: () => void): this;
  emit(event: "songEnded"): boolean;
}

export const ToxenEvent = new ToxenEventEmitter();

//#endregion

//#region ToxenApp Layout
export default class ToxenAppRenderer extends React.Component {
  componentDidMount() {
    // Set reference for force updates
    Toxen.appRenderer = this;
    
    Promise.resolve()
      .then(Settings.load) // Load settings and apply them.
      .then(Stats.load) // Load stats and apply them.
      .then(async () => {
        Toxen.updateSettings();
        if (toxenapi.isDesktop()) {
          let win = toxenapi.remote.getCurrentWindow();
          if (Settings.get("restoreWindowSize")) {
            // Window initial size
            win.setSize(
              Settings.set("windowWidth", Settings.get("windowWidth") ?? 1280),
              Settings.set("windowHeight", Settings.get("windowHeight") ?? 768)
            );
  
            let display = toxenapi.remote.screen.getPrimaryDisplay();
            let [winSizeWidth, winSizeheight] = win.getSize();
            win.setPosition(
              Math.floor(display.size.width / 2) - Math.floor(winSizeWidth / 2),
              Math.floor(display.size.height / 2) - Math.floor(winSizeheight / 2),
            );
          }
  
          Toxen.toggleFullscreen(win.isFullScreen());

          // Initialize taskbar controls
          toxenapi.TaskbarControls.initialize();
  
          try {
            toxenapi.remote.autoUpdater.on("update-available", () => {
              Toxen.log("A new update available and is being installed in the background...", 5000)
            });
  
            toxenapi.remote.autoUpdater.on("update-downloaded", (e, releaseNotes, releaseName, releaseDate, updateURL) => {
              e.preventDefault();
              new toxenapi.remote.Notification({
                title: "Update Downloaded",
                body: `A new update is available: ${releaseName}`
              }).show();
              Toxen.log(<>
                Update downloaded: <code>{releaseName}</code>
                <br />
                <TButton txStyle="action"
                  onClick={() => {
                    toxenapi.remote.autoUpdater.quitAndInstall();
                  }}
                >Update</TButton>
              </>);
            });
  
            toxenapi.remote.autoUpdater.on("error", (error) => {
              console.error(error);
              Toxen.error(`Error while updating: ${error.message}`);
            });
          } catch (error) {
            Toxen.error("Error trying to listen to auto updater.", 5000);
          }
        }

        await Toxen.loadThemes(); // Loads themes
        await Toxen.loadSongs(); // Loads songs

        // Initialize image cache for optimized background thumbnails
        Toxen.initializeImageCache();

        Toxen.songPanel.update();
        // Toxen.sidePanel.show(true);
        Toxen.sidePanel.setWidth(Settings.get("panelWidth"));
        Toxen.loadingScreen.toggleVisible(false);

        if (toxenapi.isDesktop()) {
          Toxen.musicPlayer.playRandom();
        }
        else {
          
          if (User.getCurrentUser()) {
            Toxen.sidePanel.setSectionId("songPanel");
            Toxen.sidePanel.show(true);
          }
          else {
            modals.open({
              title: "Login",
              children: (
                <div>
                  <h2>Not logged in</h2>
                  <LoginForm />
                </div>
              ),
              size: "md"
            })
          }
        }

        if (Settings.get("discordPresence")) Toxen.discord?.connect().then(() => {
          Toxen.discord?.setPresence();
        });

        if (toxenapi.isDesktop()) {
          const ytdlp = toxenapi.getYtdlp();
          if (ytdlp.isYtdlpInstalled()) {
            const ytd = await ytdlp.getYtdlpWrap();
            await ytd.getVersion().then(async (version) => {
              console.log("ytdlp version:", version);
              const latest = (await ytdlp.getGithubReleases()).pop()?.tag_name;
              console.log("ytdlp latest:", latest);
              if (latest?.trim() !== version?.trim()) {
                Toxen.warn("Media Downloader is outdated. Updating...", 2500);
                await ytdlp.installYtdlp(true);
                Toxen.log("Media Downloader updated.", 2500);
              }
            });
          }
        }

      }).then(() => Toxen._resolveWhenReady());
  }

  render = () => {
    return (
      <div>
        {/* <div className="miniplayer-overlay" onDoubleClick={e => {
          e.preventDefault();
          Toxen.toggleMiniplayer(false);
        }}>
          <div className="miniplayer-overlay-header" />
          <IconLayoutNavbarExpand size="20vh" />
        </div> */}
        <ThemeContainer ref={ref => Toxen.themeContainer = ref} />
        <div
          className="content-container"
          // onClick={() => Settings.get("pauseWithClick") ? Toxen.musicPlayer.toggle() : null}
        >
          <AppBar />
          <Background ref={ref => Toxen.background = ref} />
          <StoryboardEditor controllerSetter={sec => Toxen.storyboardEditorController = sec} />
          {Toxen.subtitleEditorOpen && (
            <div className="subtitle-editor-overlay">
              <SubtitleEditor 
                song={Toxen.editingSong} 
                onClose={() => {
                  Toxen.subtitleEditorOpen = false;
                  Toxen.setMode(ToxenInteractionMode.Player);
                  Toxen.appRenderer?.forceUpdate();
                }} 
              />
            </div>
          )}
          <MusicControls ref={ref => Toxen.musicControls = ref} />
          <LoadingScreen ref={ls => Toxen.loadingScreen = ls} initialShow={true} />
          <div className="song-panel-toggle hide-on-inactive" onClick={() => Toxen.sidePanel.show()}>
            &nbsp;
            <i className="fas fa-bars"></i>
            <span className="song-panel-toggle-title">Menu</span>
          </div>
        </div>
        <Sidepanel
          sectionId="songPanel" // Default panel
          direction="right"
          show={false}
          ref={sidePanel => Toxen.sidePanel = sidePanel}
          onClose={() => Toxen.sidePanel.show()}

          onResizeFinished={w => {
            Settings.set("panelWidth", w);
            Settings.save({ suppressNotification: true });
          }}
        >
          {/* Empty object for refreshing */}
          <SidepanelSection key="$empty" id="$empty" />
          {/* Song Panel */}
          <SidepanelSection key="songPanel" id="songPanel" title="Music" icon={<i className="fas fa-music"></i>}>
            <SidepanelSectionHeader>
              {() => (
                <div style={{ position: "relative" }}>
                  {
                    Toxen.playlist ? (
                      <div
                        style={{
                          overflow: "hidden",
                          backgroundImage: `url(${(Toxen.playlist.getBackgroundPath(true))})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          position: "absolute",
                          top: -16,
                          left: -16,
                          right: -16,
                          bottom: -16,
                          filter: "brightness(0.5) blur(2px)",
                          zIndex: -1,
                        }}
                      ></div>
                    ) : null
                  }
                  <div>
                    <h1 className="song-panel-title">
                      {((Settings.isRemote() ?  "☁ " : "") + (Toxen.playlist ? Toxen.playlist.name : ("All Tracks")))}
                    </h1>
                    <SearchField />
                    <div style={{
                      height: 8
                    }}></div>
                    <Button.Group>
                      {toxenapi.isDesktop() && Settings.getUser()?.premium && typeof Settings.get("isRemote") === "boolean" && (
                        <Button color={Settings.get("isRemote") ? "blue" : "gray"}
                          onClick={() => {
                            Settings.apply({isRemote: !Settings.get("isRemote")}, true).then(() => {
                              Toxen.reloadSection();
                            });
                          }}

                          onContextMenu={() => {
                            // Song.downloadAllMissingRemoteToLocal();
                            modals.openConfirmModal({
                              title: "Download all missing songs",
                              content: "Are you sure you want to download all missing songs?",
                              onConfirm: () => {
                                Song.downloadAllMissingRemoteToLocal().then(async () => {
                                  await Toxen.loadSongs();
                                  Toxen.reloadSection();
                                });
                              },
                              labels: {
                                confirm: "Download",
                                cancel: "Cancel",
                              },
                              confirmProps: {
                                color: "green",
                              },
                            }); 
                          }}
                            
                        >☁</Button>
                      )}
                      {
                        !Settings.isRemote() && toxenapi.isDesktop() && Settings.getUser()?.premium && (
                          <Button color="green" onClick={() => Toxen.syncSongs()}>Sync</Button>
                        )
                      }
                      <Button color="green" onClick={() => Toxen.sidePanel.setSectionId("playlist")}>Change Playlist</Button>
                      <Button
                        leftSection={<i className="fas fa-redo"></i>}
                        onClick={async () => {
                          await Toxen.loadSongs();
                          Toxen.songPanel.update();
                        }}
                      >
                        &nbsp;
                        Reload Library
                      </Button>
                      <Button
                        leftSection={<i className="fas fa-search"></i>}
                        onClick={async () => {
                          Toxen.showCurrentSong();
                        }}
                      >&nbsp;Show playing track</Button>
                    </Button.Group>
                  </div>
                </div>
              )}
            </SidepanelSectionHeader>
            <SongQueuePanel ref={s => Toxen.songQueuePanel = s} />
            <SongPanel ref={s => Toxen.songPanel = s} />
          </SidepanelSection>

          {/* Playlist Management Panel */}
          <SidepanelSection key="playlist" id="playlist" title="Playlist" icon={<i className="fas fa-th-list"></i>}>
            <PlaylistPanel ref={ref => Toxen.playlistPanel = ref} />
          </SidepanelSection>

          {/* Playlist Management Panel */}
          <SidepanelSection key="effects" id="effects" title="Effects" icon={<i className="fa-solid fa-wand-magic-sparkles"></i>}>
            <EffectsPanel />
          </SidepanelSection>

          {/* Import Panel */}
          <SidepanelSection key="importSong" id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>} disabled={!toxenapi.isDesktop()}>
            <ImportPanel />
          </SidepanelSection>

          {/* Keep settings tab at the bottom */}
          <SidepanelSection key="settings" id="settings" title="Settings" icon={<i className="fas fa-cog"></i>} separator>
            <SettingsPanel />
          </SidepanelSection>

          {/* About Panel */}
          <SidepanelSection key="stats" id="stats" title="About" icon={<i className="fas fa-info-circle"></i>}
            dynamicContent={AboutSection}
          ></SidepanelSection>


          <SidepanelSection key="changelogs" id="changelogs" title="Changes" icon={<i className="fas fa-envelope-open-text"></i>}
            dynamicContent={async (section) => {
              return (
                <>
                  <SidepanelSectionHeader>
                    <h1>Change logs</h1>
                    <Button color="green" className="advanced-only" onClick={() => {
                      Toxen.resetChangeLogs();
                      Toxen.reloadSection();
                    }}>
                      <i className="fas fa-sync-alt"></i>
                      &nbsp;Reload change logs
                    </Button>
                  </SidepanelSectionHeader>
                  <div style={{ width: "100%", whiteSpace: "normal" }}>
                    {await Toxen.getChangeLogs()}
                  </div>
                </>
              );
            }} />

          {/* Toxen2 Migration */}
          {/* <SidepanelSection key="migration" id="migration"
            // title="Migration" icon={<i className="fas fa-exchange-alt"></i>}
            dynamicContent={async (section) => {
              return (<MigrationPanel />);
            }} /> */}

          {/* No-icon panels. Doesn't appear as a clickable panel, instead only accessible by custom action */}
          {/* Edit song Panel */}
          <SidepanelSection key="editSong" id="editSong">
            <EditSong />
          </SidepanelSection>

          <SidepanelSection key="storyboardEditor" id="storyboardEditor">
            <StoryboardEditorPanel />
          </SidepanelSection>

          <SidepanelSection key="subtitleEditor" id="subtitleEditor" title="Subtitles" icon={<i className="fas fa-closed-captioning"></i>}>
            <SubtitleEditorPanel />
          </SidepanelSection>

          <SidepanelSection key="themeEditor" id="themeEditor">
            <ThemeEditorPanel />
          </SidepanelSection>

        </Sidepanel>
        <Notifications
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            zIndex: 1000,
            padding: 16,
            minWidth: "15vw",
            maxWidth: "100vw",
            overflowX: "hidden",
            overflowY: "hidden",
          }}
        />
        {/* <MessageCards ref={ref => Toxen.messageCards = ref} /> */}
      </div>
    );
  }
}
//#endregion


setTimeout(async () => {
  // console.log(await Remote.compareLocalAndRemote());
  // console.log(await Legacy.getToxen2Playlists());

  // Toxen.editSong(Song.getCurrent());
  // await new Promise(r => setTimeout(r, 2000));
  // Toxen.setMode("StoryboardEditor");
}, 2000);