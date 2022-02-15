import React, { Component } from "react";
import Converter from "../../toxen/Converter";
import Song from "../../toxen/Song";
import Time from "../../toxen/Time";
import { Toxen } from "../../ToxenApp";
import FormInput from "../Form/FormInputFields/FormInput";
import "./TrimSongPanel.scss";


interface TrimSongPanelProps { }
interface TrimSongPanelState { }

export default class TrimSongPanel extends Component<TrimSongPanelProps, TrimSongPanelState> {
  constructor(props: TrimSongPanelProps) {
    super(props);
    this.state = {};
  }

  values = {
    start: 0,
    end: Toxen.musicPlayer.media.duration * 1000,
  }
  
  render() {
    const song = Song.getCurrent();
    this.values = {
      start: 0,
      end: Toxen.musicPlayer.media.duration * 1000,
    }

    
    return (
      <div className="trim-song-panel">
        <h2>Trimming <code>{song.getDisplayName()}</code></h2>
        <label>Start time</label>
        <br />
        <input className="tx-form-field" type="text" defaultValue={Converter.numberToTime(this.values.start).toTimestamp()} onInput={(e) => {
          const t = (e.currentTarget) as HTMLInputElement;
          this.values.start = Time.fromTimestamp(t.value).toMillseconds();
          console.log(this.values.start);
        }} />
        <br />
        <br />
        <label>End time</label>
        <br />
        <input className="tx-form-field" type="text" defaultValue={Converter.numberToTime(this.values.end).toTimestamp()} onInput={(e) => {
          const t = (e.currentTarget) as HTMLInputElement;
          this.values.end = Time.fromTimestamp(t.value).toMillseconds();
          console.log(this.values.end);
        }} />
      </div>
    )
  }
}
