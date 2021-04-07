import { remote } from "electron";
import React from "react";
import fsp from "fs/promises";
import Path from "path";
import Background from "./components/Background/Background";
import LoadingScreen from "./components/LoadingScreen";
import MusicControls from "./components/MusicControls";
import MusicPlayer from "./components/MusicPlayer";
import ProgressBar from "./components/ProgressBar";
import SettingsForm from "./components/SettingsForm/SettingsForm";
import SettingsInput from "./components/SettingsForm/SettingsInputFields/SettingsInput";
import Sidepanel from "./components/Sidepanel";
import SidepanelSection from "./components/SidepanelSection";
import SongPanel from "./components/SongPanel/SongPanel";
import JSONX from "./toxen/JSONX";
import Settings from "./toxen/Settings";
import Song from "./toxen/Song";
import Time from "./toxen/Time";
import "./ToxenApp.scss";
import "./tx.scss";


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

  public static supportedAudioFiles = [
    ".mp3"
  ];
  
  public static supportedVideoFiles = [
    ".mp4"
  ];

  public static getSupportedFiles() {
    return Toxen.supportedAudioFiles.concat(Toxen.supportedVideoFiles);
  }
  
  public static sidepanelSetSectionId(sectionId: any) {
    this.sidePanel.setSectionId(sectionId);
  }

  public static sidePanel: Sidepanel;
  public static songPanel: SongPanel;
  public static musicPlayer: MusicPlayer;
  public static musicControls: MusicControls;

  /**
   * Applies the current GUI settings to the GUI.
   */
  public static updateSettings() {
    Toxen.sidePanel.setVertical(Settings.get("panelVerticalTransition") ?? false);
    Toxen.sidePanel.setDirection(Settings.get("panelDirection") ?? "left");
    Toxen.sidePanel.setExposeIcons(Settings.get("exposePanelIcons") ?? false);
  }

  public static loadingScreen: LoadingScreen;
  public static background: Background;

  public static songList: Song[];

  public static setSongList(songList: Song[]) {
    Toxen.songList = songList;
  }

  public static async loadSongs() {
    Toxen.loadingScreen.toggleShow(true);
    let songCount = 0;
    let totalSongCount = await Song.getSongCount();
    Toxen.setSongList(await Song.getSongs(true, s => {
      let ref: ProgressBar;
      let content = (
        <>
          <p>Loading songs...<br/>{++songCount}/{totalSongCount}</p>
          <div>
            <ProgressBar ref={_ref => ref = _ref} max={totalSongCount} />
          </div>
        </>
      );


      Toxen.loadingScreen.setContent(content);
      ref.setValue(songCount);
    }));
    Toxen.loadingScreen.toggleShow(false);
  }

  public static _editingSong: Song = null;
  public static editSong(song: Song) {
    Toxen._editingSong = song;
    Toxen.sidepanelSetSectionId("editSong");
  }
}

//#endregion

//#region ToxenApp Layout
export default class ToxenApp extends React.Component {
  componentDidMount() {
    Promise.resolve()
      .then(Settings.load) // Load settings and apply them.
      .then(async () => {
        Toxen.updateSettings();
        await Toxen.loadSongs();
        Toxen.songPanel.update();
        Toxen.sidePanel.toggle(true);
        Toxen.loadingScreen.toggleShow(false);
        Toxen.musicPlayer.playRandom();
      })
      .then(() => Toxen._resolveWhenReady())
  }

  render = () => (
    <div>
      <Background ref={ref => Toxen.background = ref} />
      <MusicControls ref={ref => Toxen.musicControls = ref} />
      <LoadingScreen ref={ls => Toxen.loadingScreen = ls} initialShow={true} />
      <div className="song-panel-toggle" onClick={() => Toxen.sidePanel.toggle()}>
        &nbsp;
        <i className="fas fa-bars"></i>
        <span className="song-panel-toggle-title">Menu</span>
      </div>
      <Sidepanel sectionId="songPanel" // Default panel
        direction="right"
        show={false}
        ref={sidePanel => Toxen.sidePanel = sidePanel}
        onClose={() => Toxen.sidePanel.toggle()}
      >
        {/* Song Panel */}
        <SidepanelSection id="songPanel" title="Music" icon={<i className="fas fa-music"></i>}>
          <h1>Songs</h1>
          <button className="tx-btn tx-whitespace-nowrap" onClick={async () => {
            await Toxen.loadSongs();
            Toxen.songPanel.update();
          }}><i className="fas fa-redo"></i>&nbsp;Reload Library</button>
          <SongPanel ref={s => Toxen.songPanel = s} songs={Toxen.songList} />
        </SidepanelSection>

        {/* Import Panel */}
        <SidepanelSection id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>}>
          <h1>Import song</h1>
          <button className="tx-btn"><i className="fas fa-file-import"></i>&nbsp;Import song from Files</button>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection id="playlist" title="Playlist" icon={<i className="fas fa-th-list"></i>}>
          <h1>Playlists</h1>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection id="adjust" title="Adjust" icon={<i className="fas fa-sliders-h"></i>}>
          <h1>Audio Adjustments</h1>
        </SidepanelSection>

        {/* Keep settings tab at the bottom */}
        <SidepanelSection id="settings" title="Settings" icon={<i className="fas fa-cog"></i>} separator>
          <h1>Settings</h1>
          <SettingsForm saveButtonText="Save settings" onSubmit={(_, params) => {
            Settings.apply(params);
            Settings.save();
            Toxen.updateSettings();
          }}>
            <h2>General</h2>
            <SettingsInput type="folder" name="libraryDirectory*string" displayName="Music Library" />
            <sup>Music Library to fetch songs from.</sup>
            <hr/>
            <h2>Sidepanel</h2>
            <SettingsInput type="checkbox" name="panelVerticalTransition*boolean" displayName="Vertical Transition" />
            <sup>Makes the Sidepanel appear from the bottom instead of the side.</sup>
            
            <SettingsInput type="checkbox" name="exposePanelIcons*boolean" displayName="Expose Panel Icons" />
            <sup>Exposes the icons when the panel is hidden. Only applies when Vertical Transition is off.</sup>

            <SettingsInput type="select" name="panelDirection*string" displayName="Panel Direction" >
              <option className="tx-form-field" value="left">Left</option>
              <option className="tx-form-field" value="right">Right</option>
            </SettingsInput>
            <br />
            <sup>Choose which side the sidepanel should appear on.</sup>
          </SettingsForm>
        </SidepanelSection>

        {/* No-icon panels. Doesn't appear as a clickable panel, instead only accessible by custom action */}
        <SidepanelSection id="editSong">
          <h1>Edit Song</h1>
          <SettingsForm saveButtonText="Save song" onSubmit={(_, formValues) => {
            for (const key in formValues) {
              if (Object.prototype.hasOwnProperty.call(formValues, key)) {
                const value = formValues[key];
                JSONX.setObjectValue(Toxen._editingSong, key, value);
              }
            }

            Toxen._editingSong.saveInfo();
          }}>
            <SettingsInput displayName="Location" name="paths.dirname*string" getValueTemplateCallback={() => Toxen._editingSong} type="text" readOnly />
            <button className="tx-btn" onClick={() => remote.shell.openPath(Toxen._editingSong.dirname())}>Open song folder</button>
            <br/>
            <br/>
            <SettingsInput displayName="Artist" name="artist*string" getValueTemplateCallback={() => Toxen._editingSong} type="text" />
            <SettingsInput displayName="Title" name="title*string" getValueTemplateCallback={() => Toxen._editingSong} type="text" />
            <SettingsInput displayName="Media File" name="media*string" getValueTemplateCallback={() => Toxen._editingSong} type="selectAsync"
            values={(async () => {
              let song = Toxen._editingSong;
              let values: {[displayText: string]: string} = {};
              if (!song) return values;
              let path = song.dirname();

              let supported = Toxen.getSupportedFiles();
              (await fsp.readdir(path))
              .forEach(f => {
                console.log(f);
                let ext = Path.extname(f);
                if (supported.includes(ext)) {
                  values[f] = f;
                };
              });
              
              return values;
            })()}
            >
            </SettingsInput>
          </SettingsForm>
          <hr />
        </SidepanelSection>
      </Sidepanel>
    </div>
  )
}
//#endregion

