import React, { Component } from 'react';
import { remote } from "electron";
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./SongElement.scss";

interface SongElementProps {
  getRef?: ((ref: SongElement) => void),
  song: Song;
  playing?: boolean,
}

interface SongElementState {
  selected: boolean;
  playing: boolean;
}

export default class SongElement extends Component<SongElementProps, SongElementState> {
  constructor(props: SongElementProps) {
    super(props);

    this.state = {
      selected: false,
      playing: this.props.playing ?? false
    }
  }
  
  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public play() {
    this.props.song.play();
  }

  public contextMenu() {
    this.props.song.contextMenu();
  }

  public divElement: HTMLDivElement;
  
  render() {
    let song = this.props.song;
    let classes = ["song-element"];
    const bgFile = song.backgroundFile();
    if (this.state.playing) classes.push("playing");
    return (
      <div ref={ref => this.divElement = ref} className={classes.join(" ")} style={{
        background: `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${bgFile.replace(/\\/g, "/")}")`
      }}
      onClick={this.play.bind(this)}
      onContextMenu={e => {
        this.contextMenu();
      }}
      >
        <p className="song-title" >{song.getDisplayName()}</p>
      </div>
    )
  }
}