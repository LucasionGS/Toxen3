import React, { Component } from 'react';
import Song from '../../toxen/Song';
import "./SongElement.scss";
import RenderIfVisible from "react-render-if-visible";
import { useModals } from '@mantine/modals';

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
  const bgFile = `${song.backgroundFile()}?h=${song.hash}`;
  if (songElement.state.playing) classes.push("playing");

  // const ContextMenu: typeof songElement.ContextMenu = songElement.ContextMenu.bind(songElement);
  // const contextMenuRef = React.createRef<HTMLDivElement>();
  // let setOpened: (opened: boolean) => void;
  const modals = useModals();

  return (
      <div style={{
        position: "relative",
      }} className="song-element-container">
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
            song.contextMenuModal(modals);
          }}
        >
          <div style={{ // Progress bar
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: (songElement.state.progressBar * 90) + "%",
            backgroundColor: "rgba(0, 255, 0, 0.2)",
            transition: "width 0.2s ease-in-out",
          }} />
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
  progressBar: number;
}

export default class SongElement extends Component<SongElementProps, SongElementState> {
  constructor(props: SongElementProps) {
    super(props);

    this.state = {
      selected: false,
      playing: this.props.playing ?? false,
      showContextMenu: false,
      progressBar: 0,
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public play() {
    this.props.song.play();
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