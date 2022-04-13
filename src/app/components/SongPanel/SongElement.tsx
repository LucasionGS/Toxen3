import React, { Component } from 'react';
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./SongElement.scss";
import { Group } from '@mantine/core';

interface SongElementProps {
  getRef?: ((ref: SongElement) => void),
  song: Song;
  playing?: boolean,
}

interface SongElementState {
  selected: boolean;
  playing: boolean;
  showContextMenu: boolean;
}

export default class SongElement extends Component<SongElementProps, SongElementState> {
  constructor(props: SongElementProps) {
    super(props);

    this.state = {
      selected: false,
      playing: this.props.playing ?? false,
      showContextMenu: false,
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public play() {
    this.props.song.play();
  }

  public ContextMenu(props: { cref?: React.RefObject<HTMLDivElement>, isSelected?: boolean }): JSX.Element {
    return this.props.song.ContextMenu.call(this.props.song, props);
  }

  public select(force?: boolean) {

    const state = force ?? !this.state.selected;
    this.setState({ selected: state });
  }

  public divElement: HTMLDivElement;

  render() {
    let song = this.props.song;
    let classes = ["song-element", this.state.selected ? "selected" : null].filter(a => a);
    const bgFile = song.backgroundFile();
    if (this.state.playing) classes.push("playing");

    const ContextMenu = this.ContextMenu.bind(this);
    const contextMenuRef = React.createRef<HTMLDivElement>();
    return (
      <div style={{
        position: "relative",
      }} className="song-element-container">
        <div style={{
          position: "absolute",
          top: "50%",
          left: 5,
          transform: "translateY(-50%)",
        }} className="song-element-context-menu-button">
          <ContextMenu cref={contextMenuRef} isSelected={this.state.selected} />
        </div>
        <div ref={ref => this.divElement = ref} className={classes.join(" ")} style={{
          background: `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${bgFile.replace(/\\/g, "/")}")`
        }}
          onClick={e => {
            if (e.ctrlKey) return this.select();
            this.play();
          }}
          onContextMenu={e => {
            e.preventDefault();
            contextMenuRef.current?.click();
          }}
        >
          <p className="song-title" >
            {song.getDisplayName()}
          </p>
        </div>
      </div>
    )
  }
}