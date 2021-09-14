import React, { Component } from 'react'
import { Toxen } from '../../ToxenApp';
import Song from '../../toxen/Song';

interface SongPanelProps {
  getRef?: ((songPanel: SongPanel) => void)
}

interface SongPanelState {
}

export default class SongPanel extends Component<SongPanelProps, SongPanelState> {
  constructor(props: SongPanelProps) {
    super(props);
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public update() {
    return this.setState({});
  }

  render() {
    let songList = Toxen.playlist && Toxen.playlist.songList ? Toxen.playlist.songList : Toxen.songList;
    let songs = (songList ?? []).map(s => s);
    if (Toxen.songQueue.length > 0)
      songs = songs.filter(s => !Toxen.songQueue.some(s2 => s2.uid === s.uid)); // Remove queued items from the main list
      
    if (Toxen.songSearch) {
      let items = Toxen.songSearch.toLowerCase().replace(/_/g, " ").split(" ");
      songs = songs.filter(s => {
        let sortItems = [
          s.artist ?? "", // Artist
          s.title ?? "", // Title
          ...(s.coArtists ?? []), // Co-Artists
          s.source ?? "",
          ...(s.tags ?? []),
        ].join(" ").replace(/_/g, " ").trim().toLowerCase();
        return items.every(item => sortItems.includes(item));
      })
    }
    return songs.map(s => s.Element());
  }
}