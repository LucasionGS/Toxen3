import React, { Component } from 'react'
import { Toxen } from '../../ToxenApp';
import MusicPlayer from '../MusicPlayer';
import "./Background.scss";

interface BackgroundProps {
  getRef?: ((ref: Background) => void),
  
}

interface BackgroundState {
  image: string;
}

export default class Background extends Component<BackgroundProps, BackgroundState> {
  constructor(props: BackgroundProps) {
    super(props);

    this.state = {
      image: null
    }
  }
  
  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public setBackground(source: string) {
    this.setState({
      image: source
    })
  }

  public musicPlayer: MusicPlayer
  
  render() {
    return (
      <div className="toxen-background" onClick={() => Toxen.musicPlayer.toggle()}>
        <img className="toxen-background-image" src={this.state.image} alt="background"/>
        <MusicPlayer ref={ref => Toxen.musicPlayer = ref} />
      </div>
    )
  }
}