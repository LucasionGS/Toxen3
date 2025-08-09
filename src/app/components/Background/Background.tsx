import React, { Component } from 'react'
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
import Subtitles from '../Subtitles/Subtitles';
import AudioEffects from '../../toxen/AudioEffects';
import Song from '../../toxen/Song';

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
    // Priority: playlist background -> explicitly set runtime background -> song background via storyboard -> default(s)
    const playlistBg = (Toxen.playlist && Toxen.playlist.getBackgroundPath());
    if (playlistBg) return playlistBg;

    if (this.state.image) return this.state.image;

    // If no explicit background, use multi-backgrounds only
    const shuffle = Settings.get("shuffleDefaultBackgrounds");
    const list = Settings.get("defaultBackgrounds") || [];
    if (list.length > 0) {
      if (shuffle) {
        // Pick a stable random per current song to avoid flicker between frames
        const curSong = Toxen.background?.storyboard?.getSong();
        const seedStr = curSong?.uid || "global";
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) hash = ((hash << 5) - hash) + (seedStr.charCodeAt(i) + Song.getHistoryIndex());
        const idx = Math.abs(hash) % list.length; 
        return list[idx];
      }
      // Deterministic: first item in list
      return list[0];
    }

    // No defaults configured
    return null;
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
              <MusicPlayer ref={ref => {
                Toxen.musicPlayer = musicPlayer.current = ref;
                if (ref) {
                  // Initialize audio effects when music player is ready
                  if (!Toxen.audioEffects) {
                    Toxen.audioEffects = new AudioEffects();
                  }
                  // Initialize audio effects with the media element
                  setTimeout(() => {
                    if (ref.media) {
                      Toxen.audioEffects.initialize(ref.media);
                    }
                  }, 100);
                }
              }} />
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