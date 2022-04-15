import React, { Component } from "react";
import Converter from "../../toxen/Converter";
import Ffmpeg from "../../toxen/Ffmpeg";
import Song from "../../toxen/Song";
import Time from "../../toxen/Time";
import { Toxen } from "../../ToxenApp";
import Button from "../Button/Button";
import FormInput from "../Form/FormInputFields/FormInput";
import "./TrimSongPanel.scss";


interface TrimSongPanelProps { }
interface TrimSongPanelState { }

export default class TrimSongPanel extends Component<TrimSongPanelProps, TrimSongPanelState> {
  constructor(props: TrimSongPanelProps) {
    super(props);
    this.state = {};
  }

  
  render() {
    const values = {
      start: 0,
      end: Toxen.musicPlayer.media.duration * 1000,
    }
    const song = Song.getCurrent();
    
    return (
      <div className="trim-song-panel">
        <h2>Trimming <code>{song.getDisplayName()}</code></h2>
        <label>Start time</label>
        <br />
        <input className="tx-form-field" type="text" defaultValue={Converter.numberToTime(values.start).toTimestamp()} onInput={(e) => {
          const t = (e.currentTarget) as HTMLInputElement;
          values.start = Time.fromTimestamp(t.value).toMillseconds();
        }} />
        <br />
        <br />
        <label>End time</label>
        <br />
        <input className="tx-form-field" type="text" defaultValue={Converter.numberToTime(values.end).toTimestamp()} onInput={(e) => {
          const t = (e.currentTarget) as HTMLInputElement;
          values.end = Time.fromTimestamp(t.value).toMillseconds();
        }} />
        <br />
        <Button onClick={async () => {
          await Ffmpeg.installFFmpeg();
          await Ffmpeg.trimSong(song, values.start / 1000, 50);
          Toxen.log("Trimmed song: " + song.getDisplayName());
        }}>
          Trim
        </Button>
      </div>
    )
  }
}
