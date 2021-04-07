import React, { Component } from 'react';
import { remote } from "electron";
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./SongElement.scss";

interface SongElementProps {
  getRef?: ((ref: SongElement) => void),
  song: Song
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
      playing: false
    }
  }
  
  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public play() {
    this.props.song.play();
  }

  public contextMenu() {
    remote.Menu.buildFromTemplate([
      {
        label: "Edit info",
        click: () => {
          Toxen.editSong(this.props.song);
        }
      }
    ]).popup();
  }
  
  render() {
    let song = this.props.song;
    return (
      <div className="song-element" style={{
        background: `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("file:///${song.backgroundFile().replace(/\\/g, "/")}")`
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