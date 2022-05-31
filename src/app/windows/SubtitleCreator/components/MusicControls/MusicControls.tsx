import { Slider } from '@mantine/core';
import React, { Component } from 'react'
import Time from '../../../../toxen/Time';
import { Toxen } from '../../../../ToxenApp';
import "./MusicControls.scss";
import ProgressBar from '../../../../components/ProgressBar';

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

  /**
   * Sets the background value of the progress bar. This is useful for showing what part of a song is buffered.
   */
  public setBackgroundRange(start: number, end: number) {
    this.progressBar.setBackgroundRange(start, end);
  }

  public setMax(max: number) {
    this.duration = new Time(max * 1000);
    this.setState({});
    this.progressBar.setMax(max);
  }

  public setVolume(vol: number) {
    Toxen.musicPlayer.setVolume(vol);
    this.setVolumeSlider(vol);
  }

  public setVolumeSlider: React.Dispatch<React.SetStateAction<number>>;

  public progressBar: ProgressBar;

  
  render() {
    const format = "hh?:mm:ss:ms";
    
    return (
      <div className="toxen-music-controls">
        <div className="toxen-music-controls-buttons">
          <div className="ctrl-btn" onClick={() => Toxen.musicPlayer.toggle()}>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && !Toxen.musicPlayer.media.paused}><i className="fas fa-play"></i></span>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && Toxen.musicPlayer.media.paused}><i className="fas fa-pause"></i></span>
          </div>
        </div>

        <span className="toxen-music-controls-progress-bar">
          <ProgressBar
            ref={ref => this.progressBar = ref}
            fillColor={"greenyellow"}
            onClick={(e, v) => Toxen.musicPlayer.setPosition(v)}
            onDragging={(e, v) => Toxen.musicPlayer.setPosition(v)}
            toolTip={(v) => {
              const time = new Time(v * 1000);
              return time.toTimestamp(format);
            }}
          />
        </span>

        <div className="toxen-music-controls-time hide-on-inactive">
          <div className="toxen-music-controls-time-start">{this.currentTime.toTimestamp(format)}</div>
          <div className="toxen-music-controls-volume">
            Volume
            {/* <ProgressBar ref={ref => this.volSlider = ref} max={100} min={0} initialValue={Settings.get("volume") ?? 50} onDragging={(_, v, ref) => {
              this.setVolume(v);
              Settings.set("volume", v);
            }}
            onClick={(_, v, ref) => {
              this.setVolume(v);
              Settings.set("volume", v);
            }}
            onClickRelease={(_, v, ref) => {
              this.setVolume(v);
              Settings.set("volume", v);
              Settings.save({ suppressNotification: true });
            }}
            /> */}
            <VolumeSlider controller={this} />
          </div>
          <div className="toxen-music-controls-time-end">{this.duration.toTimestamp(format)}</div>
        </div>
      </div>
    )
  }
}

function VolumeSlider(props: { controller: MusicControls }) {
  const { controller } = props;
  const [volume, setVolume] = React.useState(50);

  controller.setVolumeSlider = (n) => setVolume(n);

  return (
    <Slider
      max={100}
      min={0}
      value={volume}
      onChange={(v) => {
        controller.setVolume(v);
      }}
      onChangeEnd={(v) => {
        controller.setVolume(v);
      }}
      label={(v) => `${v}%`}
      // Set fill color to white
      color="gray"
    />
  )
}