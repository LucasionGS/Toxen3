import React, { Component } from 'react'
import { VisualizerStyle } from '../../../toxen/Settings';
import SettingsResolver from '../../../toxen/SettingsResolver';
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
    SettingsResolver.configure({
      context: () => this.getContext(),
      defaultColor: () => Visualizer.DEFAULT_COLOR(),
    });
  }

  public setSong(song: Song) {
    // if (song.storyboardFile())
    this.resetData(); 
    this.setState({ song });
  }

  public getSong() {
    return this.state.song;
  };

  private frameContext: SettingsResolver.Context = null;

  /**
   * Captures the song, playlist and storyboard overrides once for the frame about to be drawn,
   * so the `get*` getters below don't each look them up again.
   */
  public beginFrame() {
    this.frameContext = this.buildContext();
  }

  public endFrame() {
    this.frameContext = null;
  }

  /**
   * The inputs every setting is resolved against: this storyboard's overrides, the current playlist and song.
   */
  public getContext(): SettingsResolver.Context {
    return this.frameContext ?? this.buildContext();
  }

  private buildContext(): SettingsResolver.Context {
    return {
      song: this.state.song,
      playlist: Toxen.playlist ?? null,
      storyboard: this.data as unknown as Record<string, unknown>,
    };
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
      visualizerForceRainbowMode: null,
      visualizerStyle: null,
      visualizerIntensity: null,
      visualizerShuffle: null,
      visualizerNormalize: null,
      visualizerPulseBackground: null,
      visualizerGlow: null,
      backgroundDim: null,
      backgroundDynamicLighting: null,
      background: null,
      floatingTitle: null,
      floatingTitleText: null,
      floatingTitleUnderline: null,
      floatingTitleReactive: null,
      floatingTitleOverrideVisualizer: null,
      floatingTitlePosition: null,
      floatingTitleOutlineColor: null,
      useFloatingTitleSubtitles: null,
      starRushEffect: null,
      starRushIntensity: null,
      rainfallEffect: null,
      rainfallFrequency: null,
      rainfallSpeed: null,
      rainfallImage: null,
      rainfallImageScale: null,
      rainfallColor: null,
    }
  }

  // Storyboard settings
  // VisualizerColor
  public getVisualizerColor() {
    return SettingsResolver.resolve("visualizerColor", this.getContext());
  }
  // Visualizer Rainbow Mode
  public getVisualizerRainbow() {
    return SettingsResolver.resolve("visualizerRainbowMode", this.getContext());
  }

  // VisualizerStyle
  public getVisualizerStyle() {
    return SettingsResolver.resolve("visualizerStyle", this.getContext());
  }

  // Visualizer options
  /**
   * The explicitly configured value of a style option, or `null` when none is set and the option's default applies.
   */
  public getVisualizerOption(vs: VisualizerStyle | string, key: string) {
    const option = SettingsResolver.explainVisualizerOption(vs, key, this.getContext());
    return option.level === SettingsResolver.Level.Default ? null : option.value;
  }
  
  // VisualizerIntensity
  public getVisualizerIntensity() {
    return SettingsResolver.resolve("visualizerIntensity", this.getContext());
  }

  public getVisualizerShuffle() {
    return SettingsResolver.resolve("visualizerShuffle", this.getContext());
  }

  // VisualizerNormalizer
  public getVisualizerNormalize() {
    return SettingsResolver.resolve("visualizerNormalize", this.getContext());
  }

  public getVisualizerPulseBackground() {
    return SettingsResolver.resolve("visualizerPulseBackground", this.getContext());
  }

  public getVisualizerGlow() {
    return SettingsResolver.resolve("visualizerGlow", this.getContext());
  }

  public getBackgroundDim() {
    return SettingsResolver.resolve("backgroundDim", this.getContext());
  }

  public getDynamicLighting() {
    return SettingsResolver.resolve("backgroundDynamicLighting", this.getContext());
  }

  public getFloatingSubtitles() {
    return !!Toxen.subtitles.subtitles && SettingsResolver.resolve("useFloatingTitleSubtitles", this.getContext());
  }

  /**
   * Order: storyboard, the song's settings for the current playlist, the playlist's own background, the song's background.
   * @param full Whether to return the full path/URL (without the auth token) or the relative file name @default false
   * @returns `null` when there is no background.
   */
  public getBackground(full: boolean = false) {
    const background = SettingsResolver.resolveBackground(this.getContext());
    return full ? background.url : background.value;
  }

  public getFloatingTitle() {
    return SettingsResolver.resolve("floatingTitle", this.getContext());
  }
  public getFloatingTitleText() {
    const ctx = this.getContext();
    if (this.getFloatingSubtitles()) {
      return (
        Toxen.subtitles.currentText
          ? stripHtml(Toxen.subtitles.currentText)
          : SettingsResolver.resolve("floatingTitleText", ctx)
      );
    }
    const text = SettingsResolver.explain("floatingTitleText", ctx);
    // Only a storyboard may blank the text; otherwise an empty text shows the song title.
    return text.level === SettingsResolver.Level.Storyboard || text.value ? text.value : this.state.song?.title;
  }
  public getFloatingTitleUnderline() {
    return SettingsResolver.resolve("floatingTitleUnderline", this.getContext());
  }
  public getFloatingTitleReactive() {
    return SettingsResolver.resolve("floatingTitleReactive", this.getContext());
  }
  public getFloatingTitleOverrideVisualizer() {
    return SettingsResolver.resolve("floatingTitleOverrideVisualizer", this.getContext());
  }
  public getFloatingTitlePosition(): ISong["floatingTitlePosition"] {
    return SettingsResolver.resolve("floatingTitlePosition", this.getContext()) as ISong["floatingTitlePosition"];
  }
  public getFloatingTitleOutlineColor() {
    return SettingsResolver.resolve("floatingTitleOutlineColor", this.getContext());
  }

  // Star rush effect settings
  public getStarRushEffect() {
    return SettingsResolver.resolve("starRushEffect", this.getContext());
  }

  public getStarRushIntensity() {
    return SettingsResolver.resolve("starRushIntensity", this.getContext());
  }

  // Rainfall effect settings
  public getRainfallEffect() {
    return SettingsResolver.resolve("rainfallEffect", this.getContext());
  }

  public getRainfallFrequency() {
    return SettingsResolver.resolve("rainfallFrequency", this.getContext());
  }

  public getRainfallSpeed() {
    return SettingsResolver.resolve("rainfallSpeed", this.getContext());
  }

  /**
   * Returns the resolved full path/URL of the custom rainfall image, or null to use the default drop.
   * Per-song (or storyboard) images take priority over the global image.
   */
  public getRainfallImage(): string | null {
    const image = SettingsResolver.explain("rainfallImage", this.getContext());
    if (!image.value) return null;
    // The global image is an absolute path, storyboard/per-song images are stored relative to the song directory.
    if (image.level === SettingsResolver.Level.Global) return image.value;
    return this.state.song ? this.state.song.dirname(image.value) : null;
  }

  public getRainfallImageScale() {
    return SettingsResolver.resolve("rainfallImageScale", this.getContext());
  }

  /**
   * Colour of the default rain drops. Custom drop images are drawn as-is and ignore this.
   */
  public getRainfallColor() {
    return SettingsResolver.resolve("rainfallColor", this.getContext());
  }

  public getAutogeneratedTheme() {
    return SettingsResolver.resolve("autogeneratedTheme", this.getContext());
  }


  public storyboardUpdate() {
    
  }
}

interface StoryboardData {
  visualizerColor: string;
  visualizerForceRainbowMode: boolean;
  visualizerIntensity: number;
  visualizerShuffle: boolean;
  visualizerNormalize: boolean;
  visualizerStyle: VisualizerStyle | string;
  visualizerPulseBackground: boolean;
  visualizerGlow: boolean;
  backgroundDim: number;
  backgroundDynamicLighting: boolean;
  useFloatingTitleSubtitles: boolean;
  background: string;
  floatingTitle: string;
  floatingTitleText: string;
  floatingTitleUnderline: boolean;
  floatingTitleReactive: boolean;
  floatingTitleOverrideVisualizer: boolean;
  floatingTitlePosition: ISong["floatingTitlePosition"];
  floatingTitleOutlineColor: string;
  starRushEffect: boolean;
  starRushIntensity: number;
  rainfallEffect: boolean;
  rainfallFrequency: number;
  rainfallSpeed: number;
  rainfallImage: string;
  rainfallImageScale: number;
  rainfallColor: string;
}

function stripHtml(html: string)
{
   let tmp = document.createElement("div");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}