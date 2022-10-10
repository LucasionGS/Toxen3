import React, { Component } from 'react';
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./SongElement.scss";
import { Group } from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import RenderIfVisible from "react-render-if-visible";

function SongElementDiv(props: { songElement: SongElement }) {
  /// Observer object is cool and all but holy shit it makes this laggy
  // const [ref, observer] = useIntersection({
  //   root: Toxen.sidePanel?.containerRef?.current,
  //   threshold: 1,
  //   rootMargin: "-128px 256px 0px 256px",
  // });

  const { songElement } = props;
  let song = songElement.props.song;
  let classes = ["song-element", songElement.state.selected ? "selected" : null].filter(a => a);
  const bgFile = song.backgroundFile();
  if (songElement.state.playing) classes.push("playing");

  const ContextMenu = songElement.ContextMenu.bind(songElement);
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
        <ContextMenu cref={contextMenuRef} isSelected={songElement.state.selected} />
      </div>
      <div ref={ref => songElement.divElement = ref} className={classes.join(" ")} style={{
        background: `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${bgFile.replace(/\\/g, "/")}")`,

        /// Style if using Observer object
        // background: observer?.isIntersecting ? `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${bgFile.replace(/\\/g, "/")}")`: null,
        // opacity: observer?.isIntersecting ? 1 : 0,
        // transition: "transform 0.2s ease-in-out, opacity 0.2 ease-in-out",
        // transform: `translateX(${observer?.isIntersecting ? "0" : "-64"}px)`,
      }}
        onClick={e => {
          if (e.ctrlKey) return songElement.select();
          songElement.play();
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


interface SongElementProps {
  getRef?: ((ref: SongElement) => void);
  song: Song;
  playing?: boolean;
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
  public divPermanentElement: HTMLDivElement;

  render() {
    return (
      <div ref={ref => this.divPermanentElement = ref}>
        <RenderIfVisible defaultHeight={64} visibleOffset={500}>
          <SongElementDiv songElement={this} />
        </RenderIfVisible>
      </div>
    );
  }
}