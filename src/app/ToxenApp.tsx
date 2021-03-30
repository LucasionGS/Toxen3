import React from "react";
import { render } from "react-dom";
import LoadingScreen from "./components/LoadingScreen";
import SettingsForm from "./components/SettingsForm/SettingsForm";
import SettingsInput from "./components/SettingsForm/SettingsInput";
import Sidepanel from "./components/Sidepanel";
import SidepanelSection from "./components/SidepanelSection";
import SongPanel from "./components/SongPanel/SongPanel";
import ToastMessage from "./components/ToastMessage";
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
  public static sidepanelSetSectionId(sectionId: any) {
    this.sidePanel.setSectionId(sectionId);
  }

  public static sidePanel: Sidepanel;
  public static songPanel: SongPanel;
  
  /**
   * Applies the current GUI settings to the GUI.
   */
  public static updateSettings() {
    Toxen.sidePanel.setVertical(Settings.get("panelVerticalTransition") ?? false);
  }
  
  public static loadingScreen: LoadingScreen;


  public static songList: Song[];
  public static setSongList(songList: Song[]) {
    Toxen.songList = songList;
    Toxen.songPanel.update();
  }
}

//#endregion

//#region ToxenApp Layout
export default class ToxenApp extends React.Component {
  componentDidMount() {
    Promise.resolve()
    .then(Settings.load) // Load settings and apply them.
    .then(async settings => {
      Toxen.updateSettings();
      Toxen.setSongList(await Song.getSongs(true, s => console.log(s)))
      
      Toxen.loadingScreen.toggleShow(false);
    })
  }

  public ref = React.createRef();
  
  render = () => (
    <div>
      <LoadingScreen getRef={ls => Toxen.loadingScreen = ls} initialShow={true} />
      <div className="song-panel-toggle" onClick={() => Toxen.sidePanel.toggle()}>
        <i className="fas fa-bars"></i>
        <span className="song-panel-toggle-title">Menu</span>
      </div>
      <Sidepanel sectionId="songPanel" // Default panel
      direction="left"
      show={true}
      getRef={sidePanel => Toxen.sidePanel = sidePanel}
      onClose={() => Toxen.sidePanel.toggle()}
      // vertical
      >
        {/* Song Panel */}
        <SidepanelSection id="songPanel" title="Songs" icon={<i className="fas fa-music"></i>}>
          <h1>Songs</h1>
          <SongPanel getRef={s => Toxen.songPanel = s} songs={Toxen.songList} />
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection id="playlist" title="Playlist" icon={<i className="fas fa-th-list"></i>}>
          <h1>Playlists</h1>
        </SidepanelSection>

        {/* Import Panel */}
        <SidepanelSection id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>}>
          <h1>Import song</h1>
        </SidepanelSection>
        
        {/* Playlist Management Panel */}
        <SidepanelSection id="adjust" title="Adjust" icon={<i className="fas fa-sliders-h"></i>}>
          <h1>Audio Adjustments</h1>
        </SidepanelSection>

        {/* Keep settings tab at the bottom */}
        <SidepanelSection id="settings" title="Settings" icon={<i className="fas fa-cog"></i>} separator>
          <h1>Settings</h1>
          <SettingsForm onSubmit={(_, params) => {
            Settings.apply(params);
            Settings.save();
            Toxen.updateSettings();
          }}>
            <SettingsInput type="folder" name="libraryDirectory*string" displayName="Music Library" />
            <SettingsInput type="checkbox" name="panelVerticalTransition*boolean" displayName="Vertical Transition" />
          </SettingsForm>
        </SidepanelSection>

        {/* No-icon panels. Doesn't appear as a clickable panel, instead only accessible by custom action */}
        <SidepanelSection id="editSong">
          <h1>Edit Song</h1>
        </SidepanelSection>
      </Sidepanel>
      {new Time(360000).toTimestamp("hh?:mm?:ss")}
    </div>
  )
}
//#endregion

