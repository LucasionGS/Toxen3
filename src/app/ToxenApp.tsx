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
import System from "./toxen/System";
import SidepanelSectionHeader from "./components/Sidepanel/SidepanelSectionHeader";
import SearchField from "./components/SongPanel/SearchField";
import Converter from "./toxen/Converter";

//#region Define variables used all over the ToxenApp process.
/**
 * Handler for events during runtime.
 */
export class Toxen {
  public static whenReady() {
    return this.resolvedOnReady;
  }

  private static resolvedOnReady = new Promise<void>(resolve => Toxen._resolveWhenReady = resolve);

  public static _resolveWhenReady: () => void;

  public static log(message: any) { console.log(message); }
  public static warn(message: any) { console.warn(message); }
  public static error(message: any) { console.error(message); }

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

  // public static sidePanel.setSectionId(sectionId: any) {
  //   this.sidePanel.setSectionId(sectionId);
  // }

  public static sidePanel: Sidepanel;
  public static songPanel: SongPanel;
  public static musicPlayer: MusicPlayer;
  public static musicControls: MusicControls;

  // Forms
  public static settingsForm: Form;
  public static editSongForm: Form;

  /**
   * Applies the current GUI settings to the GUI.
   */
  public static updateSettings() {
    let curSong = Song.getCurrent();
    Toxen.sidePanel.setVertical(Settings.get("panelVerticalTransition") ?? false);
    Toxen.sidePanel.setDirection(Settings.get("panelDirection") ?? "left");
    Toxen.sidePanel.setExposeIcons(Settings.get("exposePanelIcons") ?? false);
    
    (Settings.get("visualizerStyle") || Settings.set("visualizerStyle", VisualizerStyle.ProgressBar /* Default */));
    
    Toxen.musicControls.setVolume(Settings.get("volume") ?? 50);
  }

  public static loadingScreen: LoadingScreen;
  public static background: Background;

  public static songSearch = "";
  public static songList: Song[];
  public static setSongList(songList: Song[]) {
    Toxen.songList = songList;
  }

  public static async loadSongs() {
    Toxen.loadingScreen.show(true);
    let songCount = 0;
    let totalSongCount = await Song.getSongCount();
    Toxen.setSongList(await Song.getSongs(true, () => {
      let ref: ProgressBar;
      let content = (
        <>
          <p>Loading songs...<br />{++songCount}/{totalSongCount}</p>
          <div>
            <ProgressBar ref={_ref => ref = _ref} max={totalSongCount} />
          </div>
        </>
      );


      Toxen.loadingScreen.setContent(content);
      ref.setValue(songCount);
      ref.setMin(0);
      ref.setMax(totalSongCount);
    }));
    Toxen.loadingScreen.show(false);
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

  public static reloadSection() {
    let id = Toxen.sidePanel.state.sectionId;
    Toxen.sidePanel.setSectionId("$empty");
    setTimeout(() => {
      Toxen.sidePanel.setSectionId(id);
    }, 0);
  }

  /**
   * Applies the same color to all visual UI elements. Things like Audio visualizer, and song progress bar.
   */
  public static setAllVisualColors(color: string) {
    color = color || Settings.get("visualizerColor");
    Toxen.musicControls.progressBar.setFillColor(color);
  };
}

//#endregion

//#region ToxenApp Layout
export default class ToxenApp extends React.Component {
  componentDidMount() {
    Promise.resolve()
      .then(Settings.load) // Load settings and apply them.
      .then(async () => {
        Toxen.updateSettings();

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
        Toxen.loadingScreen.show(false);
        Toxen.musicPlayer.playRandom();
        Toxen.background.visualizer.start();
      })
      .then(() => Toxen._resolveWhenReady())
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
      >
        {/* Empty object for refreshing */}
        <SidepanelSection key="$empty" id="$empty"/>
        {/* Song Panel */}
        <SidepanelSection key="songPanel" id="songPanel" title="Music" icon={<i className="fas fa-music"></i>}>
          <SidepanelSectionHeader>
            <h1>Songs</h1>
            <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
              await Toxen.loadSongs();
              Toxen.songPanel.update();
            }}><i className="fas fa-redo"></i>&nbsp;Reload Library</button>
            &nbsp;
            <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
              Toxen.showCurrentSong();
            }}><i className="fas fa-search"></i>&nbsp;Show playing</button>
            <br />
            <SearchField />
          </SidepanelSectionHeader>
          <SongPanel ref={s => Toxen.songPanel = s} songs={Toxen.songList} />
        </SidepanelSection>

        {/* Import Panel */}
        <SidepanelSection key="importSong" id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>}>
          <h1>Import song</h1>
          <button className="tx-btn"><i className="fas fa-file-import"></i>&nbsp;Import song from Files</button>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection key="playlist" id="playlist" title="Playlist" icon={<i className="fas fa-th-list"></i>}>
          <h1>Playlists</h1>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection key="adjust" id="adjust" title="Adjust" icon={<i className="fas fa-sliders-h"></i>}>
          <h1>Audio Adjustments</h1>
        </SidepanelSection>

        {/* Keep settings tab at the bottom */}
        <SidepanelSection key="settings" id="settings" title="Settings" icon={<i className="fas fa-cog"></i>} separator>
          <SidepanelSectionHeader>
            <h1>Settings</h1>
            <button className="tx-btn tx-btn-action" onClick={() => Toxen.settingsForm.submit()}>
              <i className="fas fa-save"></i>
              &nbsp;Save settings
            </button>
          </SidepanelSectionHeader>
          <Form hideSubmit ref={ref => Toxen.settingsForm = ref} saveButtonText="Save settings" onSubmit={(_, params) => {
            Settings.apply(params);
            Settings.save();
            Toxen.updateSettings();
          }}>
            {/* General settings */}
            <h2>General</h2>
            <FormInput type="folder" name="libraryDirectory*string" displayName="Music Library" />
            <sup>Music Library to fetch songs from.</sup>
            <button className="tx-btn tx-btn-action" onClick={() => remote.shell.openPath(Settings.get("libraryDirectory"))}>
              <i className="fas fa-save"></i>
              &nbsp;Open library folder
            </button>

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
            <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" type="color"
            // onChange={v => Toxen.setAllVisualColors(v)}
            />
            <sup>Default color for the visualizer if a song specific isn't set.</sup>
            <br/>
            <FormInput type="select" name="visualizerStyle*string" displayName="VisualizerStyle" >
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
            <sup>Select which style for the visualizer to use</sup>
          </Form>
        </SidepanelSection>

        {/* No-icon panels. Doesn't appear as a clickable panel, instead only accessible by custom action */}
        {/* Edit song Panel */}
        <SidepanelSection key="editSong" id="editSong">
          <SidepanelSectionHeader>
            <h1>Edit music details</h1>
            <button className="tx-btn tx-btn-action" onClick={() => Toxen.editSongForm.submit()}>
              <i className="fas fa-save"></i>
              &nbsp;Save
            </button>
            &nbsp;
            <button className="tx-btn" onClick={() => remote.shell.openPath(Toxen.editingSong.dirname())}>Open music folder</button>
            &nbsp;
            <button className="tx-btn" onClick={() => Toxen.reloadSection()}>Reload data</button>
          </SidepanelSectionHeader>
          <Form hideSubmit ref={ref => Toxen.editSongForm = ref} saveButtonText="Save song" onSubmit={(_, formValues) => {
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
                      // Toxen.musicPlayer.setSubtitles(current.subtitlesFile(), true); // Not yet implemented
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

            Toxen.editingSong.saveInfo();
          }}>
            <h2>General information</h2>
            {/* <FormInput displayName="Location" name="paths.dirname*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" readOnly /> */}
            <FormInput displayName="Artist" name="artist*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Title" name="title*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Co-Artists" name="coArtists*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
            <FormInput displayName="Album" name="album*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Source" name="source*string" getValueTemplateCallback={() => Toxen.editingSong} type="text" />
            <FormInput displayName="Tags" name="tags*array" getValueTemplateCallback={() => Toxen.editingSong} type="list" />
            <hr />
            <h2>Song-specific visuals</h2>
            <FormInput nullable displayName="Visualizer Color" name="visualizerColor*string" getValueTemplateCallback={() => Toxen.editingSong} type="color"
            onChange={v => Toxen.setAllVisualColors(v)}
            />
            <hr />
            <h2></h2>
            <FormInput displayName="Media File" name="paths.media*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedMediaFiles();

                return (await System.recursive(path))
                  .filter(f => {
                    let ext = Path.extname(f.name);
                    return supported.includes(ext);
                  }).map(f => f.name);
              })}
            />
            <FormInput nullable displayName="Background file" name="paths.background*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedImageFiles();
                return (await System.recursive(path))
                  .filter(f => {
                    let ext = Path.extname(f.name);
                    return supported.includes(ext);
                  }).map(f => f.name);
              })}
            />
            <FormInput nullable displayName="Subtitle file" name="paths.subtitles*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedSubtitleFiles();
                return (await System.recursive(path))
                  .filter(f => {
                    let ext = Path.extname(f.name);
                    return supported.includes(ext);
                  }).map(f => f.name);
              })}
            />
            <FormInput nullable displayName="Storyboard file" name="paths.storyboard*string" getValueTemplateCallback={() => Toxen.editingSong} type="selectAsync"
              values={(async () => {
                let song = Toxen.editingSong;
                if (!song) return [];
                let path = song.dirname();

                let supported = Toxen.getSupportedStoryboardFiles();
                return (await System.recursive(path))
                  .filter(f => {
                    let ext = Path.extname(f.name);
                    return supported.includes(ext);
                  }).map(f => f.name);
              })}
            />

            <FormInput type="select" name="visualizerStyle*string" displayName="VisualizerStyle" getValueTemplateCallback={() => Toxen.editingSong}>
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
        </SidepanelSection>
      </Sidepanel>
    </div>
  )
}
//#endregion

