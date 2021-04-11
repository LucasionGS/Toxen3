import { remote } from 'electron';
import React, { Component } from 'react'
import Song from '../../toxen/Song';
import System from '../../toxen/System';
import { Toxen } from '../../ToxenApp';
import MusicPlayer from '../MusicPlayer';
import "./Background.scss";
import Storyboard from './Storyboard/Storyboard';
import Visualizer from './Visualizer';

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

  public setBackground(source: string) {
    this.setState({
      image: source
    })
  }

  public musicPlayer: MusicPlayer;
  public visualizer: Visualizer;
  public storyboard: Storyboard;

  render() {
    return (
      <div className="toxen-background"
        onClick={() => Toxen.musicPlayer.toggle()}
        onDoubleClick={() => {
          let w = remote.getCurrentWindow();
          w.setFullScreen(!w.isFullScreen());
        }}
        onContextMenu={() => {
          let cur = Song.getCurrent();
          if (cur) cur.contextMenu();
        }}
        // Background will also act as a dropzone
        onDrop={e => {
          e.preventDefault();
          System.handleDroppedFiles(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
        onDragEnter={e => e.preventDefault()}
        onDragLeave={e => e.preventDefault()}
      >
        <img hidden={this.state.image ? false : true} className="toxen-background-image" src={this.state.image} alt="background" />
        <MusicPlayer ref={ref => Toxen.musicPlayer = ref} />
        <Storyboard ref={ref => this.storyboard = ref} />
        <Visualizer ref={ref => this.visualizer = ref} />
      </div>
    )
  }
}