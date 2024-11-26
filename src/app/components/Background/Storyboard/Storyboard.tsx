import React, { Component } from 'react'
import Settings, { VisualizerStyle } from '../../../toxen/Settings';
import Song, { ISong } from '../../../toxen/Song';
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
      visualizerNormalize: null,
      visualizerPulseBackground: null,
      backgroundDim: null,
      backgroundDynamicLighting: null,
      background: null,
      floatingTitle: null,
      floatingTitleText: null,
      floatingTitleUnderline: null,
      floatingTitleReactive: null,
      floatingTitleOverrideVisualizer: null,
      floatingTitlePosition: null,
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

  // VisualizerNormalizer
  public getVisualizerNormalize() {
    return this.data.visualizerNormalize
      ?? (
        (this.state.song && this.state.song.visualizerNormalize)
        || Settings.get("visualizerNormalize")
        || false
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

  /**
   * @param full Whether to return the full path or just relative file path @default false
   * @returns 
   */
  public getBackground(full: boolean = false) {
    const bg = this.data.background
      ?? (
        // (Toxen.playlist &&Toxen.playlist.applyBackground && Toxen.playlist.getBackgroundPath()) ||
        (Toxen.playlist && Toxen.playlist.getBackgroundPath()) ||
        (this.state.song && this.state.song.paths.background)
        || null
      );
    
    if (full) {
      return bg ? this.state.song.dirname(bg) : null;
    }
    return bg;
  }

  public getFloatingTitle() {
    return this.data.floatingTitle ?? (this.state.song && this.state.song.floatingTitle || false);
  }
  public getFloatingTitleText() {
    if (Toxen.subtitles.state.subtitles) {
      return (
        Toxen.subtitles.state.currentText
          ? stripHtml(Toxen.subtitles.state.currentText)
          : (this.data.floatingTitleText ?? (this.state.song && this.state.song.floatingTitleText || ""))
      );
    }
    return this.data.floatingTitleText ?? (this.state.song && this.state.song.floatingTitleText || this.state.song.title);
  }
  public getFloatingTitleUnderline() {
    return this.data.floatingTitleUnderline ?? (this.state.song && this.state.song.floatingTitleUnderline || false);
  }
  public getFloatingTitleReactive() {
    return this.data.floatingTitleReactive ?? (this.state.song && this.state.song.floatingTitleReactive || false);
  }
  public getFloatingTitleOverrideVisualizer() {
    return this.data.floatingTitleOverrideVisualizer ?? (this.state.song && this.state.song.floatingTitleOverrideVisualizer || false);
  }
  public getFloatingTitlePosition(): ISong["floatingTitlePosition"] {
    return this.data.floatingTitlePosition ?? (this.state.song && this.state.song.floatingTitlePosition || "center");
  }


  public storyboardUpdate() {
    
  }
}

interface StoryboardData {
  visualizerColor: string;
  visualizerIntensity: number;
  visualizerNormalize: boolean;
  visualizerStyle: VisualizerStyle;
  visualizerPulseBackground: boolean;
  backgroundDim: number;
  backgroundDynamicLighting: boolean;
  background: string;
  floatingTitle: string;
  floatingTitleText: string;
  floatingTitleUnderline: boolean;
  floatingTitleReactive: boolean;
  floatingTitleOverrideVisualizer: boolean;
  floatingTitlePosition: ISong["floatingTitlePosition"];
}

function stripHtml(html: string)
{
   let tmp = document.createElement("div");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}