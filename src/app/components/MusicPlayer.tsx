import React, { Component } from 'react'
import Song from '../toxen/Song';
import { Toxen } from '../ToxenApp';

export type MediaSourceInfo = string;

interface MusicPlayerProps {
  getRef?: ((ref: MusicPlayer) => void),
}

interface MusicPlayerState {
  src: MediaSourceInfo;
}

export default class MusicPlayer extends Component<MusicPlayerProps, MusicPlayerState> {
  constructor(props: MusicPlayerProps) {
    super(props);

    this.state = {
      src: null
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);

    setInterval(() => {
      try {
        Toxen.musicControls.setValue(this.media.currentTime);
      } catch {
        // Nothing
      }
    }, 50);
  }

  public setSource(src: MediaSourceInfo, playWhenReady: boolean = false) {
    this.setState({
      src
    }, () => playWhenReady ? this.play() : this.media.load());
  }

  public get paused() {
    return this.media.paused;
  }

  public play() {
    this.media.play();
  }
  
  public pause() {
    this.media.pause();
  }

  public toggle() {
    if (this.media.paused) this.media.play();
    else this.media.pause();
  }

  public playRandom() {
    let songCount = Toxen.songList.length;
    if (songCount === 0) {
      console.error("No songs available.");
      return;
    }
    let randomSongIndex: number;
    let song: Song;
    do {
      randomSongIndex = Math.floor(Math.random() * songCount);
      song = Toxen.songList[randomSongIndex];
    } while (song == null);
    song.play();
  }

  public media: HTMLMediaElement;
  
  render() {
    return (
      <audio onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)} ref={ref => this.media = ref} hidden src={this.state.src} onEnded={this.playRandom.bind(this)} />
    )
  }
}