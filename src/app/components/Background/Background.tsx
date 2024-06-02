import * as remote from "@electron/remote";
import React, { Component } from 'react'
import Song from '../../toxen/Song';
import System from '../../toxen/System';
import { Toxen } from '../../ToxenApp';
import MusicPlayer from '../MusicPlayer';
import "./Background.scss";
import Storyboard from './Storyboard/Storyboard';
import Visualizer from './Visualizer';
//@ts-expect-error 
import ToxenMax from "../../../icons/skull_max.png";
import Settings from '../../toxen/Settings';
import Asyncifier from '../../toxen/Asyncifier';
import Path from "path";
import Subtitles from '../Subtitles/Subtitles';

interface BackgroundProps {
  getRef?: ((ref: Background) => void),
}

interface BackgroundState {
  image: string;
  dimScale: number;
}

export default class Background extends Component<BackgroundProps, BackgroundState> {
  constructor(props: BackgroundProps) {
    super(props);

    this.state = {
      image: null,
      dimScale: 0
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  setStateAsync = Asyncifier.createSetState(this);
  // public update() {
  //   this.setState({});
  // }

  public setBackground(source: string) {
    return this.setStateAsync({
      image: source
    })
  }

  /**
   * Returns the currently in use background image. It will return the default image if no image is set.
   */
  public getBackground(): string {
    return (
      (Toxen.playlist && Toxen.playlist.getBackgroundPath())
      || this.state.image
      || Settings.get("defaultBackground")
      || null
    );
  }

  public musicPlayer: MusicPlayer;
  public visualizer: Visualizer;
  public storyboard: Storyboard;

  public updateDimScale: (dimScale: number) => void = () => void 0;

  render() {

    // const dim = this.state.dimScale ?? 0;
    // Toxen.background?.visualizer?.getDynamicDim() ?? 0;

    return (
      <div className="toxen-background"
        onClick={() => Settings.get("pauseWithClick") ? Toxen.musicPlayer.toggle() : null}
        // onDoubleClick={() => {
        //   Toxen.toggleFullscreen();
        // }}
        onContextMenu={async () => {
          // Toxen.showCurrentSong();
          // Toxen.editSong(Song.getCurrent())
          if (!Toxen.sidePanel.isShowing()) Toxen.sidePanel.show();
        }}
        // Background will also act as a dropzone
        onDrop={e => {
          e.preventDefault();
          System.handleImportedFiles(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
        onDragEnter={e => e.preventDefault()}
        onDragLeave={e => e.preventDefault()}
      >
        <BackgroundImage ToxenMax={ToxenMax}  backgroundObject={this} />
        {
          (() => {
            let musicPlayer: { current: MusicPlayer } = { current: null };
            return (<>
              <MusicPlayer ref={ref => Toxen.musicPlayer = musicPlayer.current = ref} />
              <Subtitles ref={ref => Toxen.subtitles = ref} musicPlayer={musicPlayer} />
              <Storyboard ref={ref => this.storyboard = ref} />
              <Visualizer ref={ref => this.visualizer = ref} />
            </>)
          })()
        }
      </div >
    )
  }
}

function BackgroundImage(props: { ToxenMax: string, backgroundObject: Background }) {
  const { ToxenMax, backgroundObject } = props;

  const [dim, setDim] = React.useState<number>(0);
  backgroundObject.updateDimScale = setDim;
  
  return (<img // hidden={this.state.image ? false : true}
    className="toxen-background-image" src={backgroundObject.getBackground() || ToxenMax} alt="background" style={{
      transform: dim > 0 ? `scale(${1 + (dim / 4)})` : "scale(1)"
    }} />);
}