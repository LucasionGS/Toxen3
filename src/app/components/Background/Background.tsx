import { remote } from 'electron';
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

interface BackgroundProps {
  getRef?: ((ref: Background) => void),

}

interface BackgroundState {
  image: string;
}

export default class Background extends Component<BackgroundProps, BackgroundState> {
  constructor(props: BackgroundProps) {
    super(props);

    this.state = {
      image: null
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  setStateAsync = Asyncifier.createSetState(this);

  public setBackground(source: string) {
    return this.setStateAsync({
      image: source
    })
  }

  /**
   * Returns the currently in use background image. It will return the default image if no image is set.
   */
  public getBackground(): string {
    return this.state.image || Settings.get("defaultBackground") || null;
  }

  public musicPlayer: MusicPlayer;
  public visualizer: Visualizer;
  public storyboard: Storyboard;

  render() {
    return (
      <div className="toxen-background"
        onClick={() => Toxen.musicPlayer.toggle()}
        onDoubleClick={() => {
          Toxen.toggleFullscreen();
        }}
        onContextMenu={() => {
          let cur = Song.getCurrent();
          if (cur) cur.contextMenu();
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
        <img
          // hidden={this.state.image ? false : true}
          className="toxen-background-image"
          src={this.getBackground() || ToxenMax}
          alt="background" />
        <MusicPlayer ref={ref => Toxen.musicPlayer = ref} />
        <Storyboard ref={ref => this.storyboard = ref} />
        <Visualizer ref={ref => this.visualizer = ref} />
      </div>
    )
  }
}