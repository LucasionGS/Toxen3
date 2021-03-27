import React from "react";
import Sidepanel from "./components/Sidepanel";
import SidepanelSection from "./components/SidepanelSection";
import SongPanel from "./components/SongPanel";
import "./ToxenApp.css";


//#region Define variables used all over the ToxenApp process.
/**
 * Handler for events during runtime.
 */
export class Toxen {
  private static _sidepanelShowState: boolean = false;
  public static setSidepanelShow: React.Dispatch<React.SetStateAction<boolean>>;
  public static toggleSidePanelShow() {
    Toxen.setSidepanelShow(Toxen._sidepanelShowState = !Toxen._sidepanelShowState);
    return Toxen._sidepanelShowState;
  }
  public static setSidepanelSectionId: React.Dispatch<any>;
  
}

//#endregion

//#region ToxenApp Layout
export default function ToxenApp() {
  return (
    <div>
      <div className="song-panel-toggle" onClick={() => Toxen.toggleSidePanelShow()}>
        <i className="fas fa-bars"></i>
      </div>
      <Sidepanel sectionId="songPanel"
      direction="left"
      toggle={setShow => Toxen.setSidepanelShow = setShow}
      setSectionId={setSectionId => Toxen.setSidepanelSectionId = setSectionId}
      onClose={() => Toxen.toggleSidePanelShow()}
      >
        <SongPanel id="songPanel" icon={<i className="fas fa-music"></i>}>
          <h1>Song panel</h1>
        </SongPanel>
        <SidepanelSection id="settings" icon={<i className="fas fa-cog"></i>}>
          <h1>Settings panel</h1>
        </SidepanelSection>
      </Sidepanel>
      Welcome to Toxen
    </div>
  )
}
//#endregion