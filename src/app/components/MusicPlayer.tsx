import React, { Component } from 'react'

export type MediaSourceInfo = string;

interface MusicPlayerProps {
  
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

  public setSource(src: MediaSourceInfo) {
    this.setState({
      src
    }, () => this.media.load());
  }

  public play() {
    this.media.play();
  }

  public media: HTMLMediaElement;
  
  render() {
    return (
      <audio ref={ref => this.media = ref} hidden src={this.state.src} />
    )
  }
}

