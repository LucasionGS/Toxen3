import React, { Component } from 'react'
import Settings, { VisualizerStyle } from '../../../toxen/Settings';
import Song from '../../../toxen/Song';
import { Toxen } from '../../../ToxenApp';
import Visualizer from '../Visualizer';
import "./Storyboard.scss";

interface StoryboardProps { }

interface StoryboardState {
  song: Song;
}

export default class Storyboard extends Component<StoryboardProps, StoryboardState> {
  constructor(props: StoryboardProps) {
    super(props);
    this.resetData();
    this.state = {
      song: null
    }
  }

  public setSong(song: Song) {
    this.setState({ song });
  }

  render() {
    return (
      <div className="toxen-storyboard">

      </div>
    )
  }

  data: StoryboardData;

  public resetData() {
    this.data = {
      visualizerColor: null,
      visualizerStyle: null
    }
  }

  // Storyboard settings
  // VisualizerColor
  public getVisualizerColor() {
    return this.data.visualizerColor
    || (this.state.song && this.state.song.visualizerColor)
    || Settings.get("visualizerColor")
    || Visualizer.DEFAULT_COLOR;
  }

  // VisualizerStyle
  public getVisualizerStyle() {
    return this.data.visualizerStyle
    || (this.state.song && this.state.song.visualizerStyle)
    || Settings.get("visualizerStyle")
    || VisualizerStyle.ProgressBar;
  }
}

interface StoryboardData {
  visualizerColor: string
  visualizerStyle: VisualizerStyle
}