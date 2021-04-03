import React, { Component } from 'react'
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

  public setProgressValue(value: number) {
    this.progressBar.setValue(value);
  }
  
  public setProgressMax(max: number) {
    this.progressBar.setMax(max);
  }

  private progressBar: ProgressBar;
  
  render() {
    return (
      <div className="toxen-music-controls">
        {/* <p>Hello</p> */}
        <ProgressBar ref={ref => this.progressBar = ref}/>
      </div>
    )
  }
}