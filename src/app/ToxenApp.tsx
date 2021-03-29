import React from "react";
import { render } from "react-dom";
import SettingsForm from "./components/SettingsForm/SettingsForm";
import SettingsInput from "./components/SettingsForm/SettingsInput";
import Sidepanel from "./components/Sidepanel";
import SidepanelSection from "./components/SidepanelSection";
import ToastMessage from "./components/ToastMessage";
import Settings from "./toxen/Settings";
import Song from "./toxen/Song";
import Time from "./toxen/Time";
import "./ToxenApp.css";
import "./tx.css";


//#region Define variables used all over the ToxenApp process.
/**
 * Handler for events during runtime.
 */
export class Toxen {
  private static _sidepanelShowState: boolean = false;
  public static sidepanelSetShow: React.Dispatch<React.SetStateAction<boolean>>;
  public static sidepanelToggleShow() {
    Toxen.sidepanelSetShow(Toxen._sidepanelShowState = !Toxen._sidepanelShowState);
    return Toxen._sidepanelShowState;
  }
  public static sidepanelSetSectionId: React.Dispatch<any>;
  public static sidepanelSetVertical: React.Dispatch<any>;
  
  /**
   * Applies the current GUI settings to the GUI.
   */
  public static updateSettings() {
    Toxen.sidepanelSetVertical(Settings.get("panelVerticalTransition") ?? false);
  }
}

//#endregion

//#region ToxenApp Layout
export default class ToxenApp extends React.Component {
  componentDidMount() {
    setTimeout(() => {
      Toxen.updateSettings();
    }, 0);
  }

  public ref = React.createRef();
  
  render = () => (
    <div>
      <div className="song-panel-toggle" onClick={() => Toxen.sidepanelToggleShow()}>
        <i className="fas fa-bars"></i>
        <span className="song-panel-toggle-title">Menu</span>
      </div>
      <Sidepanel sectionId="songPanel" // Default panel
      direction="left"
      toggle={setShow => Toxen.sidepanelSetShow = setShow}
      setSectionId={setSectionId => Toxen.sidepanelSetSectionId = setSectionId}
      setVertical={setVertical => Toxen.sidepanelSetVertical = setVertical}
      onClose={() => Toxen.sidepanelToggleShow()}
      // vertical
      >
        {/* Song Panel */}
        <SidepanelSection id="songPanel" title="Songs" icon={<i className="fas fa-music"></i>}>
          <h1>Songs</h1>
        </SidepanelSection>

        {/* Import Panel */}
        <SidepanelSection id="importSong" title="Import" icon={<i className="fas fa-file-import"></i>}>
          <h1>Import song</h1>
        </SidepanelSection>

        {/* Playlist Management Panel */}
        <SidepanelSection id="playlist" title="Playlist" icon={<i className="fas fa-list"></i>}>
          <h1>Playlists</h1>
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
            <SettingsInput type="text" name="libraryDirectory*string" displayName="Music Library" />
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

