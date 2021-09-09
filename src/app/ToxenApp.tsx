import { remote } from "electron";
import React from "react";
import fsp from "fs/promises";
import Path from "path";
import Background from "./components/Background/Background";
import LoadingScreen from "./components/LoadingScreen";
import MusicControls from "./components/MusicControls";
import MusicPlayer from "./components/MusicPlayer";
import ProgressBar from "./components/ProgressBar";
import Form from "./components/Form/Form";
import FormInput from "./components/Form/FormInputFields/FormInput";
import Sidepanel from "./components/Sidepanel/Sidepanel";
import SidepanelSection from "./components/Sidepanel/SidepanelSection";
import SongPanel from "./components/SongPanel/SongPanel";
import JSONX from "./toxen/JSONX";
import Settings, { VisualizerStyle } from "./toxen/Settings";
import Song from "./toxen/Song";
import "./ToxenApp.scss";
import "./tx.scss";
import System, { ToxenFile } from "./toxen/System";
import SidepanelSectionHeader from "./components/Sidepanel/SidepanelSectionHeader";
import SearchField from "./components/SongPanel/SearchField";
import Converter from "./toxen/Converter";
import Stats from "./toxen/Statistics";
import Time from "./toxen/Time";
import StoryboardEditorPanel from "./components/StoryboardEditorPanel/StoryboardEditorPanel";
import { Dirent } from "fs";
import User from "./toxen/User";
import LoginForm from "./components/LoginForm/LoginForm";
import { MessageCardOptions, MessageCards } from "./components/MessageCard/MessageCards";
import ExternalUrl from "./components/ExternalUrl/ExternalUrl";
import showdown from "showdown";
import htmlToReactParser, { Element, Text } from "html-react-parser";
import AboutSection from "./components/AboutSection";
import SongQueuePanel from "./components/SongPanel/SongQueuePanel";
import Subtitles from "./components/Subtitles/Subtitles";
import SubtitleParser from "./toxen/SubtitleParser";
import ToxenInteractionMode from "./toxen/ToxenInteractionMode";

//#region Define variables used all over the ToxenApp process.
/**
 * Handler for events during runtime.
 */
export class Toxen {

  private static mode: ToxenInteractionMode = ToxenInteractionMode.Player;

  public static setMode(mode: ToxenInteractionMode | keyof typeof ToxenInteractionMode) {
    if (typeof mode == "string") {
      mode = ToxenInteractionMode[mode as keyof typeof ToxenInteractionMode];
    }
    Toxen.mode = mode;
    switch (mode) {
      case ToxenInteractionMode.Player: {
        Toxen.sidePanel.setSectionId("songPanel");
        break;
      }

      case ToxenInteractionMode.StoryboardEditor: {
        Toxen.sidePanel.setSectionId("storyboardEditor");
        break;
      }

      case ToxenInteractionMode.SubtitlesEditor: {
        // Some action here
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
    return fetch(Toxen.txToHttp(input), init);
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

  private static resolvedOnReady = new Promise<void>(resolve => Toxen._resolveWhenReady = resolve);

  public static _resolveWhenReady: () => void;

  public static log(message: any, expiresIn?: number) {
    console.log(message);
    Toxen.notify({
      title: "Info",
      content: message,
      expiresIn: expiresIn,
      type: "normal",
    });
  }
  public static warn(message: any, expiresIn?: number) {
    console.warn(message);
    Toxen.notify({
      title: "Warning",
      content: message,
      expiresIn: expiresIn,
      type: "warning",
    });
  }
  public static error(message: any, expiresIn?: number) {
    console.error(message);
    Toxen.notify({
      title: "Error",
      content: message,
      expiresIn: expiresIn,
      type: "error",
    });
  }

  public static async filterSupportedFiles(path: string, supported: string[]) {
    return (
      Settings.isRemote() ? await Toxen.fetch(path).then(res => res.json()) as Dirent[]
        : await System.recursive(path)
    )
      .filter(f => {
        let ext = Path.extname(f.name);
        return supported.includes(ext);
      }).map(f => f.name);
  }

  public static getSupportedAudioFiles() {
    return [
      ".mp3"
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
    ];
  }

  public static getSupportedSubtitleFiles() {
    return [
      ".srt",
      ".tst",
    ];
  }

  public static getSupportedStoryboardFiles() {
    return [
      ".tsb",
    ];
  }

  public static showCurrentSong() {
    let song = Song.getCurrent();

    if (song) song.scrollTo();
  }

  // Objects
  public static sidePanel: Sidepanel;
  public static songPanel: SongPanel;
  public static songQueuePanel: SongQueuePanel;
  public static musicPlayer: MusicPlayer;
  public static musicControls: MusicControls;
  public static subtitles: Subtitles;
  public static messageCards: MessageCards;
  public static updateSongPanels() {
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
  }
  /**
   * Send a message to the Toxen message cards.
   */
  public static notify(notification: Omit<Omit<MessageCardOptions, "createdAt">, "uniqueId">) {
    this.messageCards.addMessage(notification);
  }

  // Forms
  public static settingsForm: Form;
  public static editSongForm: Form;

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
  }

  public static loadingScreen: LoadingScreen;
  public static background: Background;

  public static songSearch = "";
  public static songList: Song[];
  public static setSongList(songList: Song[]) {
    const cur = Song.getCurrent();
    if (cur) {
      const newCur = songList.find(s => s.uid === cur.uid);
      if (newCur) newCur.setCurrent();
    }
    Toxen.songList = songList;
  }
  public static songQueue: Song[] = [];

  /**
   * Returns all songs in songList and songQueue.
   */
  public static getAllSongs() {
    return (Toxen.songList || []).concat(Toxen.songQueue);
  }

  public static getPlayableSongs(): readonly Song[] {
    if (Toxen.songQueue && Toxen.songQueue.length > 0) return Toxen.songQueue
    if (Toxen.songList && Toxen.songList.length > 0) return Toxen.songList;
    return [];
  }

  public static async loadSongs() {
    Toxen.loadingScreen.toggleVisible(true);
    let songCount = 0;
    let totalSongCount = await Song.getSongCount();
    Toxen.setSongList(await Song.getSongs(true, () => {
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
      ref.setValue(songCount);
      // ref.setMin(0);
      // ref.setMax(totalSongCount);
    }));
    Toxen.loadingScreen.toggleVisible(false);
  }

  public static editingSong: Song = null;
  public static editSong(song: Song) {
    if (Toxen.editingSong == song) {
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
    const w = remote.getCurrentWindow();
    w.setFullScreen(force ?? !w.isFullScreen());
  }

  public static reloadSection() {
    let id = Toxen.sidePanel.state.sectionId;
    Toxen.sidePanel.setSectionId("$empty");
    setTimeout(() => {
      Toxen.sidePanel.setSectionId(id);
    }, 0);
  }

  /**
   * Applies the same color to all RGB visual UI elements. Things like Audio visualizer, and song progress bar.
   */
  public static setAllVisualColors(color: string) {
    color = color || Settings.get("visualizerColor");
    Toxen.musicControls.progressBar.setFillColor(color);
  };
}

//#endregion

//#region ToxenApp Layout
export default class ToxenAppRenderer extends React.Component {
  componentDidMount() {
    Promise.resolve()
      .then(Settings.load) // Load settings and apply them.
      .then(async () => {
        Toxen.updateSettings();
        Stats.load();
        if (Settings.get("restoreWindowSize")) {
          let win = remote.getCurrentWindow();
          // Window initial size
          win.setSize(
            Settings.set("windowWidth", Settings.get("windowWidth") ?? 1280),
            Settings.set("windowHeight", Settings.get("windowHeight") ?? 768)
          );

          let display = remote.screen.getPrimaryDisplay();
          let [winSizeWidth, winSizeheight] = win.getSize();
          win.setPosition(
            Math.floor(display.size.width / 2) - Math.floor(winSizeWidth / 2),
            Math.floor(display.size.height / 2) - Math.floor(winSizeheight / 2),
          );
        }

        await Toxen.loadSongs();
        Toxen.songPanel.update();
        Toxen.sidePanel.show(true);
        Toxen.sidePanel.setWidth(Settings.get("panelWidth"));
        Toxen.loadingScreen.toggleVisible(false);
        Toxen.musicPlayer.playRandom();
        Toxen.background.visualizer.start();
      }).then(() => Toxen._resolveWhenReady())
  }

  render = () => (
    <div>
      <Background ref={ref => Toxen.background = ref} />
      <MusicControls ref={ref => Toxen.musicControls = ref} />
      <LoadingScreen ref={ls => Toxen.loadingScreen = ls} initialShow={true} />
      <div className="song-panel-toggle hide-on-inactive" onClick={() => Toxen.sidePanel.show()}>
        &nbsp;
        <i className="fas fa-bars"></i>
        <span className="song-panel-toggle-title">Menu</span>
      </div>
      <Sidepanel sectionId="songPanel" // Default panel
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
            <h1>Songs</h1>
            <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
              await Toxen.loadSongs();
              Toxen.songPanel.update();
            }}>
              <i className="fas fa-redo"></i>&nbsp;
              Reload Library
            </button>
            <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
              Toxen.showCurrentSong();
            }}><i className="fas fa-search"></i>&nbsp;Show playing</button>
            <br />
            <SearchField />
          </SidepanelSectionHeader>
          <SongQueuePanel ref={s => Toxen.songQueuePanel = s} />
          <SongPanel ref={s => Toxen.songPanel = s} />
        </SidepanelSection>

        {/* Import Panel */}
        <SidepanelSection key="importSong" id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>}>
          <h1>Import song</h1>
          <button className="tx-btn"
            onClick={() => {
              let paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
                properties: [
                  "multiSelections",
                  "openFile"
                ],
                filters: [
                  {
                    name: "Media files",
                    extensions: Toxen.getSupportedMediaFiles().map(ext => ext.replace(".", ""))
                  },
                ],

              });

              if (!paths || paths.length == 0) return;

              const promisedFiles: ToxenFile[] = paths.map(p => ({
                name: Path.basename(p),
                path: p
              }));
              Promise.all(promisedFiles).then(files => {
                System.handleImportedFiles(files);
              });
            }}
          ><i className="fas fa-file-import"></i>&nbsp;Import song from Files</button>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection key="playlist" id="playlist" title="Playlist" icon={<i className="fas fa-th-list"></i>}>
          <h1>Playlists</h1>
          <p>Playlists are not yet implemented.</p>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection key="adjust" id="adjust" title="Adjust" icon={<i className="fas fa-sliders-h"></i>}>
          <h1>Audio Adjustments</h1>
          <p>Audio adjustments are not yet implemented.</p>
        </SidepanelSection>

        {/* Keep settings tab at the bottom */}
        <SidepanelSection key="settings" id="settings" title="Settings" icon={<i className="fas fa-cog"></i>} separator>
          <SidepanelSectionHeader>
            <h1>Settings</h1>
            <button className="tx-btn tx-btn-action" onClick={() => { Toxen.settingsForm.submit(); Toxen.reloadSection() }}>
              <i className="fas fa-save"></i>
              &nbsp;Save settings
            </button>
          </SidepanelSectionHeader>
          <LoginForm />
          <Form hideSubmit ref={ref => Toxen.settingsForm = ref} saveButtonText="Save settings" onSubmit={(_, params) => {
            Settings.apply(params);
            Settings.save();
            Toxen.updateSettings();
          }}>
            {/* General settings */}
            <h2>General</h2>
            {(() => {
              let ref = React.createRef<FormInput>();
              return (
                <>
                  <FormInput ref={ref} type="text" name="libraryDirectory*string" displayName="Music Library" />
                  <button className="tx-btn tx-btn-action" onClick={() => ref.current.openFolder()}>
                    <i className="fas fa-folder"></i>
                    &nbsp;Change Music Folder
                  </button>
                  <button className="tx-btn tx-btn-action" onClick={() => remote.shell.openPath(Settings.get("libraryDirectory"))}>
                    <i className="fas fa-folder-open"></i>
                    &nbsp;Open Music Folder
                  </button>
                  <br />
                  <br />
                  <sup>
                    Music Library to fetch songs from.<br />
                    You can use the <code>Change Music Folder</code> button to select a directory or write it in directly. <br />
                    You can also insert a URL to a Toxen Streaming Server that you have an account on. Must begin with <code>http://</code> or <code>https://</code>.
                  </sup>
                </>
              );
            })()}

            {/* Sidepanel settings */}
            <hr />
            <h2>Sidepanel</h2>
            <FormInput type="checkbox" name="panelVerticalTransition*boolean" displayName="Vertical Transition" />
            <sup>Makes the Sidepanel appear from the bottom instead of the side.</sup>

            <FormInput type="checkbox" name="exposePanelIcons*boolean" displayName="Expose Panel Icons" />
            <sup>Exposes the icons when the panel is hidden. Only applies when Vertical Transition is off.</sup>

            <FormInput type="select" name="panelDirection*string" displayName="Panel Direction" >
              <option className="tx-form-field" value="left">Left</option>
              <option className="tx-form-field" value="right">Right</option>
            </FormInput>
            <br />
            <sup>Choose which side the sidepanel should appear on.</sup>

            {/* Window settings */}
            <hr />
            <h2>Window</h2>
            <FormInput type="checkbox" name="restoreWindowSize*boolean" displayName="Restore Window Size On Startup" />
            <sup>Saves and restores the window size from last session.</sup>

            {/* Visuals settings */}
            <hr />
            <h2>Visuals</h2>

            {(() => {
              let ref = React.createRef<FormInput>();
              return (
                <>
                  <FormInput ref={ref} type="text" name="defaultBackground*string" displayName="Default Background" />
                  <button className="tx-btn tx-btn-action" onClick={() => ref.current.openFile()}>
                    <i className="fas fa-folder"></i>
                    &nbsp;Change default background
                  </button>
                  <br />
                  <br />
                  <sup>
                    Set a default background which will apply for songs without one. <br />
                    Click the button <code>Change default background</code> to open a select prompt.
                    You can also set a background for a specific song by clicking the song in the song list. <br />
                  </sup>
                  <br />
                </>
              );
            })()}

            <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" type="color"
            // onChange={v => Toxen.setAllVisualColors(v)}
            />
            <sup>Default color for the visualizer if a song specific isn't set.</sup>
            <br />

            <FormInput type="checkbox" name="visualizerRainbowMode*boolean" displayName="Rainbow Mode" />
            <sup>Override the visualizer color to show a colorful rainbow visualizer.</sup>
            <br />

            <FormInput type="select" name="visualizerStyle*string" displayName="Visualizer Style" >
              {(() => {
                let objs: JSX.Element[] = [];
                for (const key in VisualizerStyle) {
                  if (Object.prototype.hasOwnProperty.call(VisualizerStyle, key)) {
                    const v = (VisualizerStyle as any)[key];
                    objs.push(<option key={key} className="tx-form-field" value={v}>{Converter.camelCaseToSpacing(key)}</option>)
                  }
                }
                return objs;
              })()}
            </FormInput>
            <br />
            <sup>Select which style for the visualizer to use.</sup>
            <br />
          </Form>
        </SidepanelSection>

        {/* About Panel */}
        <SidepanelSection key="stats" id="stats" title="About" icon={<i className="fas fa-info-circle"></i>}
          dynamicContent={AboutSection}
        ></SidepanelSection>


        <SidepanelSection key="changelogs" id="changelogs" title="Changes" icon={<i className="fas fa-envelope-open-text"></i>}
          dynamicContent={async section => {
            return (
              <>
                <SidepanelSectionHeader>
                  <h1>Change logs</h1>
                  <button className="tx-btn tx-btn-action" onClick={() => {
                    Toxen.resetChangeLogs();
                    Toxen.reloadSection();
                  }}>
                    <i className="fas fa-sync-alt"></i>
                    &nbsp;Reset change logs
                  </button>
                </SidepanelSectionHeader>
                <div style={{ width: "100%", whiteSpace: "normal" }}>
                  {
                    await Toxen.getChangeLogs()
                  }
                </div>
              </>
            );
          }}
        />

        {/* No-icon panels. Doesn't appear as a clickable panel, instead only accessible by custom action */}
        {/* Edit song Panel */}
        <SidepanelSection key="editSong" id="editSong">
          <SidepanelSectionHeader>
            <h1>Edit music details</h1>
            <button className="tx-btn tx-btn-action" onClick={() => Toxen.editSongForm.submit()}>
              <i className="fas fa-save"></i>&nbsp;
              Save
            </button>
            <button className="tx-btn" onClick={() => remote.shell.openPath(Toxen.editingSong.dirname())}>
              <i className="fas fa-folder-open"></i>&nbsp;
              Open music folder
            </button>
            <button className="tx-btn" onClick={() => Toxen.reloadSection()}>
              <i className="fas fa-redo"></i>&nbsp;
              Reload data
            </button>
          </SidepanelSectionHeader>
          <Form hideSubmit ref={ref => Toxen.editSongForm = ref} saveButtonText="Save song" onSubmit={async (_, formValues) => {
            let current = Song.getCurrent();
            let preBackground = Toxen.editingSong.paths.background;
            let preMedia = Toxen.editingSong.paths.media;
            let preSubtitles = Toxen.editingSong.paths.subtitles;
            let preStoryboard = Toxen.editingSong.paths.storyboard;
            let preVisualizerColor = Toxen.editingSong.visualizerColor;
            for (const key in formValues) {
              if (Object.prototype.hasOwnProperty.call(formValues, key)) {
                const value = formValues[key];
                JSONX.setObjectValue(Toxen.editingSong, key, value);

                // Special cases
                switch (key) {
                  case "visualizerColor":
                    if (Toxen.editingSong == current && current.visualizerColor !== preVisualizerColor) {
                      Toxen.setAllVisualColors(current.visualizerColor);
                    }
                    break;

                  case "paths.background":
                    if (Toxen.editingSong == current && current.paths.background !== preBackground) {
                      Toxen.background.setBackground(current.backgroundFile());
                    }
                    break;

                  case "paths.media":
                    if (Toxen.editingSong == current && current.paths.media !== preMedia) {
                      Toxen.musicPlayer.setSource(current.mediaFile(), true);
                    }
                    break;

                  case "paths.subtitles":
                    // Update subtitles
                    if (Toxen.editingSong == current && current.paths.subtitles !== preSubtitles) {
                      current.applySubtitles();
                    }
                    break;

                  case "paths.storyboard":
                    // Update storyboard
                    if (Toxen.editingSong == current && current.paths.storyboard !== preStoryboard) {
                      // Toxen.musicPlayer.setStoryboard(current.storyboardFile(), true); // Not yet implemented
                    }
                    break;

                  default:
                    break;
                }

                Toxen.background.storyboard.setSong(current);
              }
            }

            Toxen.editingSong.saveInfo().then(() => Toxen.reloadSection());
          }}>
            <h2>General information</h2>
            {/* <FormInput displayName="Location" name="paths.dirname*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" readOnly /> */}
            <FormInput displayName="Artist" name="artist*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Title" name="title*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Co-Artists" name="coArtists*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
            <FormInput displayName="Album" name="album*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Source" name="source*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Language" name="language*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Release Year" name="year*number" getValueTemplateCallback={() => Toxen.editingSong} type="number" />
            <FormInput displayName="Tags" name="tags*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
            <hr />
            <h2>Song-specific visuals</h2>
            <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" getValueTemplateCallback={() => Toxen.editingSong} type="color"
              onChange={v => Toxen.setAllVisualColors(v)}
            />

            <FormInput type="checkbox" name="visualizerForceRainbowMode*boolean" displayName="Force Visualizer Rainbow Mode" getValueTemplateCallback={() => Toxen.editingSong} />
            <br />
            <sup>Enable to force Rainbow mode onto this song. If disabled, but the global settings have it enabled, this will also be enabled.</sup>
            <hr />
            <h2></h2>
            <FormInput displayName="Media File" name="paths.media*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedMediaFiles();
                return await Toxen.filterSupportedFiles(path, supported);
              })}
            />
            <FormInput nullable displayName="Background file" name="paths.background*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedImageFiles();
                return await Toxen.filterSupportedFiles(path, supported);
              })}
            />
            <FormInput nullable displayName="Subtitle file" name="paths.subtitles*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedSubtitleFiles();
                return await Toxen.filterSupportedFiles(path, supported);
              })}
            />
            <FormInput nullable displayName="Storyboard file" name="paths.storyboard*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedStoryboardFiles();
                return await Toxen.filterSupportedFiles(path, supported);
              })}
            >
              <button className="tx-btn tx-btn-action" onClick={() => {
                if (!Toxen.editingSong) {
                  return Toxen.error("No song has been selected for editing.", 5000);
                }

                Toxen.setMode("StoryboardEditor");
              }}>Edit Storyboard</button>
            </FormInput>

            <FormInput type="select" name="visualizerStyle*string" displayName="Visualizer Style" getValueTemplateCallback={() => Toxen.editingSong}>
              {(() => {
                let objs: JSX.Element[] = [
                  <option key={null} className="tx-form-field" value={""}>{"<Default>"}</option>
                ];
                for (const key in VisualizerStyle) {
                  if (Object.prototype.hasOwnProperty.call(VisualizerStyle, key)) {
                    const v = (VisualizerStyle as any)[key];
                    objs.push(<option key={key} className="tx-form-field" value={v}>{Converter.camelCaseToSpacing(key)}</option>)
                  }
                }
                return objs;
              })()}
            </FormInput>
            <br />
            <sup>Select which style for the visualizer to use for this song.</sup>
          </Form>
          <hr />
          <h2>Export options</h2>
          <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
            remote.Menu.buildFromTemplate(
              (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedMediaFiles())).map(file => {
                file = Toxen.editingSong.dirname(file);
                return {
                  label: (Toxen.editingSong.mediaFile() === file ? "(Current) " : "") + "Export " + file,
                  click: async () => {
                    let fileData: Buffer;
                    try {
                      if (Settings.isRemote()) {
                        fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                      }
                      else {
                        fileData = await fsp.readFile(file);
                      }
                    } catch (error) {
                      return Toxen.error(error);
                    }
                    System.exportFile(Settings.isRemote() ? Path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
                  }
                }
              }),
            ).popup();
          }}><i className="fas fa-file-export"></i>&nbsp;Export Media File</button>

          <br />

          <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
            remote.Menu.buildFromTemplate(
              (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedImageFiles())).map(file => {
                file = Toxen.editingSong.dirname(file);
                return {
                  label: (Toxen.editingSong.backgroundFile() === file ? "(Current) " : "") + "Export " + file,
                  click: async () => {
                    let fileData: Buffer;
                    try {
                      if (Settings.isRemote()) {
                        fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                      }
                      else {
                        fileData = await fsp.readFile(file);
                      }
                    } catch (error) {
                      return Toxen.error(error);
                    }
                    System.exportFile(Settings.isRemote() ? Path.basename(file) : file, fileData, [{ name: "", extensions: [file.split(".").pop()] }]);
                  }
                }
              }),
            ).popup();
          }}><i className="fas fa-file-export"></i>&nbsp;Export Image File</button>

          <br />

          <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
            remote.Menu.buildFromTemplate(
              (await Toxen.filterSupportedFiles(Toxen.editingSong.dirname(), Toxen.getSupportedSubtitleFiles())).map(file => {
                file = Toxen.editingSong.dirname(file);
                return {
                  label: (Toxen.editingSong.subtitleFile() === file ? "(Current) " : "") + "Export " + file,
                  click: async () => {
                    let fileData: Buffer;
                    try {
                      if (Settings.isRemote()) {
                        fileData = Buffer.from(await Toxen.fetch(file).then(res => res.arrayBuffer()));
                      }
                      else {
                        fileData = await fsp.readFile(file);
                      }
                    } catch (error) {
                      return Toxen.error(error);
                    }
                    remote.Menu.buildFromTemplate(
                      Toxen.getSupportedSubtitleFiles().map(ext => {
                        return {
                          label: (Path.extname(file) === ext ? "(Current) " : "") + `Export as ${ext} format`,
                          click: () => {
                            fileData = Buffer.from(SubtitleParser.exportByExtension(SubtitleParser.parseByExtension(fileData.toString(), Path.extname(file)), ext));
                            System.exportFile((Settings.isRemote() ? "" : Path.dirname(file) + "/") + Path.basename(file, Path.extname(file)), fileData, [{ name: "", extensions: [ext.replace(/^\.+/g, "")] }]);
                          }
                        }
                      })
                    ).popup();
                  }
                }
              }),
            ).popup();
          }}><i className="fas fa-file-export"></i>&nbsp;Export Subtitle File</button>
        </SidepanelSection>

        <SidepanelSection key="storyboardEditor" id="storyboardEditor">
          <StoryboardEditorPanel />
        </SidepanelSection>

      </Sidepanel>
      <MessageCards ref={ref => Toxen.messageCards = ref} />
    </div>
  )
}
//#endregion

