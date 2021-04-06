import React, { Component } from 'react'
import Time from '../toxen/Time';
import { Toxen } from '../ToxenApp';
import "./MusicControls.scss";
import ProgressBar from './ProgressBar';

interface MusicControlsProps {
  getRef?: ((ref: MusicControls) => void),
}

interface MusicControlsState {

}

export default class MusicControls extends Component<MusicControlsProps, MusicControlsState> {
  constructor(props: MusicControlsProps) {
    super(props);

    this.state = {

    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  currentTime: Time = new Time();
  duration: Time = new Time();

  public setValue(value: number) {
    this.currentTime = new Time(value * 1000);
    this.setState({});
    this.progressBar.setValue(value);
  }

  public setMax(max: number) {
    this.duration = new Time(max * 1000);
    this.setState({});
    this.progressBar.setMax(max);
  }

  private progressBar: ProgressBar;

  render() {
    return (
      <div className="toxen-music-controls">
        <div className="toxen-music-controls-buttons">
          <div className="ctrl-btn">
            <i className="fas fa-random"></i>
          </div>
          <div className="ctrl-btn">
            <i className="fas fa-angle-double-left"></i>
          </div>
          <div className="ctrl-btn" onClick={() => Toxen.musicPlayer.toggle()}>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && !Toxen.musicPlayer.media.paused}><i className="fas fa-play"></i></span>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && Toxen.musicPlayer.media.paused}><i className="fas fa-pause"></i></span>
          </div>
          <div className="ctrl-btn" onClick={() => Toxen.musicPlayer.playRandom()}>
            <i className="fas fa-angle-double-right"></i>
          </div>
          <div className="ctrl-btn">
            <i className="fas fa-redo"></i>
          </div>
        </div>

        <ProgressBar ref={ref => this.progressBar = ref} />
        
        <div className="toxen-music-controls-time">
          <div className="toxen-music-controls-time-start">{this.currentTime.toTimestamp("hh?:mm:ss")}</div>
          <div className="toxen-music-controls-time-end">{this.duration.toTimestamp("hh?:mm:ss")}</div>
        </div>
      </div>
    )
  }
}