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
    // if (song.storyboardFile())
    this.resetData(); 
    this.setState({ song });
  }

  public getSong() {
    return this.state.song;
  };

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
      visualizerStyle: null,
      visualizerIntensity: null,
      visualizerPulseBackground: null,
      backgroundDim: null,
      backgroundDynamicLighting: null,
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
      ?? (
        (this.state.song && this.state.song.visualizerStyle)
        || Settings.get("visualizerStyle")
        || VisualizerStyle.ProgressBar
      );
  }
  // VisualizerIntensity
  public getVisualizerIntensity() {
    return this.data.visualizerIntensity
      ?? (
        (this.state.song && this.state.song.visualizerIntensity)
        || Settings.get("visualizerIntensity")
        || 1
      );
  }

  public getVisualizerPulseBackground() {
    if (typeof this.data.visualizerPulseBackground === "boolean") return this.data.visualizerPulseBackground;
    
    let result: boolean = null;
    if (this.state.song) {
      result = this.state.song.visualizerPulseBackground === "pulse" ? true : this.state.song.visualizerPulseBackground === "pulse-off" ? false : null;
    }

    if (result === null) {
      result = Settings.get("visualizerPulseBackground") ?? false
    }

    return result;
  }

  public getBackgroundDim() {
    return this.data.backgroundDim
      ?? (
        // (this.state.song && this.state.song.backgroundDim) || // TODO: Add support for this
        Settings.get("backgroundDim")
        || 0
      );
  }

  public getDynamicLighting() {
    return this.data.backgroundDynamicLighting
      ?? (
        // (this.state.song && this.state.song.backgroundDynamicLighting) || // TODO: Add support for this
        Settings.get("backgroundDynamicLighting")
        || false
      );
  }


  public storyboardUpdate() {
    
  }
}

interface StoryboardData {
  visualizerColor: string;
  visualizerIntensity: number;
  visualizerStyle: VisualizerStyle;
  visualizerPulseBackground: boolean;
  backgroundDim: number;
  backgroundDynamicLighting: boolean;
}