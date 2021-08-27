import React, { Component } from 'react'
import Song from '../toxen/Song';
import { Toxen } from '../ToxenApp';
import Path from "path";
import Settings from '../toxen/Settings';

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

  componentDidUpdate() {
    this.setVolume(Settings.get("volume"));
  }

  /**
   * @param vol From 0 to 100
   */
  public setVolume(vol: number) {
    if (isNaN(vol) || typeof vol !== "number") vol = 50;
    this.media.volume = vol / 100;
  }

  public setPosition(seconds: number) {
    this.media.currentTime = seconds;
  }

  public setSource(src: MediaSourceInfo, playWhenReady: boolean = false) {
    this.setState({
      src
    }, () => playWhenReady ? this.play() : this.load()
    );
  }

  public isVideo(src: string) {
    if (!src) return false;
    switch (Path.extname(src)) {
      // Video formats
      case ".mp4":
        return true;
    
      default: return false;
    }
  }

  public get paused() {
    return this.media.paused;
  }

  public play() {
    this.media.play();
  }
  
  public load() {
    this.media.load();
  }
  
  public pause() {
    this.media.pause();
  }

  public toggle() {
    if (this.media.paused) this.media.play();
    else this.media.pause();
  }

  public playNext() {
    this.playRandom();
  }
  
  public playPrev() {
    this.playRandom();
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
    let isVideo = this.isVideo(this.state.src);
    // Audio
    if (!isVideo) return (
      <video
      onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)}
      ref={ref => this.media = ref}
      hidden
      src={this.state.src}
      onEnded={this.playNext.bind(this)}
      preload="auto"
      />
    );
    // Video
    else return (
      <video
      onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)}
      ref={ref => this.media = ref}
      src={this.state.src}
      onEnded={this.playNext.bind(this)}
      />
    );
  }
}