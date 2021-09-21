import React, { Component } from 'react'
import Song from '../toxen/Song';
import { Toxen } from '../ToxenApp';
import Path from "path";
import Settings from '../toxen/Settings';
import Time from '../toxen/Time';

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

  public setPosition(seconds: number, options?: {
    updateDiscord?: boolean
  }) {
    options = options || {};
    this.media.currentTime = seconds;
    if (options.updateDiscord) Toxen.discord.setPresence();
  }

  public setSource(src: MediaSourceInfo, playWhenReady: boolean = false) {
    this.setState({
      src
    }, () => playWhenReady ? this.play() : this.load()
    );
  }

  public isVideo(src: string) {
    if (!src) return false;
    return Toxen.getSupportedVideoFiles().includes(Path.extname(src).toLowerCase());
  }

  public get paused() {
    return this.media.paused;
  }

  public play() {
    this.media.play();
    Toxen.discord.setPresence();
  }
  
  public load() {
    this.media.load();
  }
  
  public pause() {
    this.media.pause();
    Toxen.discord.setPresence();
  }

  public toggle() {
    if (this.media.paused) this.play();
    else this.pause();
  }

  public playNext() {
    let nextSongFromHistory = Song.historyForward();
    if (nextSongFromHistory) {
      return nextSongFromHistory.play({ disableHistory: true });
    }
    if (Settings.get("shuffle")) {
      this.playRandom();
    }
    else {
      let songs = Toxen.getPlayableSongs();
      let songCount = songs.length;
      let curSong = Song.getCurrent();
      let nextSong: Song = null;
      while (nextSong == null) {
        let nextSongIndex = (songs.findIndex(s => curSong && s.uid === curSong.uid) + 1) % songCount;
        nextSong = songs[nextSongIndex];
        if (nextSong == null) {
          Toxen.error("No songs available.");
          return;
        }
        if (curSong && nextSong.uid === curSong.uid) {
          Toxen.messageCards.addMessage({
            content: "No more songs available.",
            type: "error",
            expiresIn: 3000
          });
          Toxen.error("No more songs available.");
          return;
        }
        return nextSong.play();
      }
    }
  }

  private onEnded() {
    if (Settings.get("repeat")) {
      this.play();
    }
    else {
      this.playRandom();
    }
  }
  
  public playPrev() {
    let prevSong = Song.historyBack();
    if (prevSong) prevSong.play({ disableHistory: true });
  }

  public playRandom() {
    let songs = Toxen.getPlayableSongs();
    let songCount = songs.length;
    if (songCount === 0) {
      Toxen.error("No songs available.");
      return;
    }
    let randomSongIndex: number;
    let curSong = Song.getCurrent();
    let song: Song = null;
    do {
      randomSongIndex = Math.floor(Math.random() * songCount);
      song = songs[randomSongIndex];
      if (curSong && curSong.uid === song.uid && songCount > 1) {
        song = null;
      }
    } while (song == null);
    song.play();
  }

  public media: HTMLMediaElement;

  public getTime() {
    return new Time(this.media.currentTime * 1000);
  }
  
  render() {
    let isVideo = this.isVideo(this.state.src);
    // Audio
    if (!isVideo) return (
      <video
      onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)}
      ref={ref => this.media = ref}
      hidden
      src={this.state.src}
      onEnded={this.onEnded.bind(this)}
      />
    );
    // Video
    else return (
      <video
      onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)}
      ref={ref => this.media = ref}
      src={this.state.src}
      onEnded={this.onEnded.bind(this)}
      />
    );
  }
}