import React, { Component } from 'react'
import Song from '../toxen/Song';
import { Toxen, ToxenEvent } from '../ToxenApp';
import Path from "path";
import Settings from '../toxen/Settings';
import Time from '../toxen/Time';
import PulsingLogo from './PulsingLogo/PulsingLogo';

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
        Toxen.musicControls.setBackgroundRange(this.media.buffered.start(0) || 0, this.media.buffered.end(this.media.buffered.length - 1) || 0);
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
          Toxen.notify({
            content: "No more songs available.",
            type: "error",
            expiresIn: 3000
          })
          Toxen.error("No more songs available.");
          return;
        }
        return nextSong.play();
      }
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

  private onEnded() {
    ToxenEvent.emit("songEnded");
    if (Settings.get("repeat")) {
      this.play();
    }
    else {
      this.playRandom();
    }
  }

  private isSeeking = false;
  private onSeeking() {
    if (!Settings.isRemote()) return;
    if (
      this.isSeeking == false
      && (this.media.currentTime < Toxen.musicControls.progressBar.state.bufferedRange[0]
        || this.media.currentTime > Toxen.musicControls.progressBar.state.bufferedRange[1])
    ) {
      Toxen.loadingScreen.show();
      Toxen.loadingScreen.setContent(
        <>
          <PulsingLogo />Buffering...
        </>
      );
      this.isSeeking = true;
    }
  }

  private onSeeked() {
    if (!Settings.isRemote()) return;
    if (this.isSeeking) {
      Toxen.loadingScreen.hide();
      this.isSeeking = false;
    }
    this.isSeeking = false;
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
        onSeeking={this.onSeeking.bind(this)}
        onSeeked={this.onSeeked.bind(this)}
      />
    );
    // Video
    else return (
      <video
        onCanPlay={e => Toxen.musicControls.setMax(this.media.duration)}
        ref={ref => this.media = ref}
        src={this.state.src}
        onEnded={this.onEnded.bind(this)}
        onSeeking={this.onSeeking.bind(this)}
        onSeeked={this.onSeeked.bind(this)}
      />
    );
  }
}