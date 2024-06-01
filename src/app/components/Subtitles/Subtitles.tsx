import React, { Component } from 'react'
import HTMLReactParser from 'html-react-parser';
import SubtitleParser from '../../toxen/SubtitleParser';
import MusicPlayer from '../MusicPlayer';
import "./Subtitles.scss";
import Song from '../../toxen/Song';

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
    this.currentOptions = {};
    this.setState({
      subtitles: subtitles,
      currentText: ""
    });
  }

  private currentOptions: SubtitleParser.SubtitleItem["options"] = {};
  private lastSub: SubtitleParser.SubtitleItem = null;
  private update() {
    const self = this;
    requestAnimationFrame(this.update);
    const mp = this.props.musicPlayer.current;
    if (!mp) return;
    // if (mp.paused) return;
    const currentTime = mp.getTime();
    if (!currentTime) return;
    const subtitles = this.state.subtitles;
    if (subtitles && subtitles.song && subtitles.song.subtitleDelay) currentTime.addMilliseconds(-subtitles.song.subtitleDelay);
    const sub = subtitles?.getByTime(currentTime);
    if (sub !== this.lastSub) {
      if (sub) {
        Object.assign(this.currentOptions, sub.options);
      }
      // let lastSub = this.lastSub;
      this.lastSub = sub;
      if (!sub) {
        return this.setState({
          currentText: null
        });
      }

      let text = sub.text || "";
      function getOption<T>(key: keyof SubtitleParser.SubtitleOptions, defaultValue: T = null) {
        switch (subtitles.type) {
          case "tst":
            return (sub.options[key] ?? subtitles.options[key]) || (self.currentOptions ? self.currentOptions[key] : null) || defaultValue;
          default:
            return (sub.options[key] ?? subtitles.options[key]) || defaultValue;
        }
      }
      let color = getOption("color", "white");
      let font = getOption("font", "Arial");
      let fontSize = getOption("fontSize", 24);
      let bold = getOption("bold", "false");

      text = `<span style="color: ${color}; font-family: ${font}; font-size: ${fontSize + "px"};">${text}</span>`;
      if (bold === "true") {
        text = `<b>${text}</b>`;
      }
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