import React, { Component } from 'react'
import HTMLReactParser from 'html-react-parser';
import SubtitleParser from '../../toxen/SubtitleParser';
import MusicPlayer from '../MusicPlayer';
import "./Subtitles.scss";

interface SubtitlesProps {
  musicPlayer: { current: MusicPlayer }
}

interface SubtitlesState {
  subtitles: SubtitleParser.SubtitleArray,
  currentText: string,
}

export default class Subtitles extends Component<SubtitlesProps, SubtitlesState> {
  constructor(props: SubtitlesProps) {
    super(props);

    this.state = {
      subtitles: new SubtitleParser.SubtitleArray(),
      currentText: "",
    }

    requestAnimationFrame(this.update = this.update.bind(this));
  }

  public setSubtitles(subtitles: SubtitleParser.SubtitleArray) {
    this.lastSub = null;
    this.setState({
      subtitles: subtitles,
      currentText: ""
    });
  }

  private lastSub: SubtitleParser.SubtitleItem = null;
  private update() {
    requestAnimationFrame(this.update);
    const mp = this.props.musicPlayer.current;
    if (!mp) return;
    // if (mp.paused) return;
    const currentTime = mp.getTime();
    if (!currentTime) return;
    const subtitles = this.state.subtitles;
    const sub = subtitles?.getByTime(currentTime);
    if (sub !== this.lastSub) {
      this.lastSub = sub;
      if (!sub) {
        return this.setState({
          currentText: null
        });
      }
      let text = sub.text || "";
      function getOption<T>(key: keyof SubtitleParser.SubtitleOptions, defaultValue: T = null) {
        return (sub.options[key] ?? subtitles.options[key]) || defaultValue;
      }
      let color = getOption("color", "white");
      let font = getOption("font", "Arial");
      let fontSize = getOption("fontSize", 24);
      console.log(sub.options, color, font, fontSize);
      
      text = `<span style="color: ${color}; font-family: ${font}; font-size: ${fontSize + "px"};">${text}</span>`;
      this.setState({
        currentText: text
      });
    }
  }
  
  render() {
    return (
      <div className="subtitle-container">
        {this.state.currentText ? HTMLReactParser(this.state.currentText) : null}
      </div>
    )
  }
}