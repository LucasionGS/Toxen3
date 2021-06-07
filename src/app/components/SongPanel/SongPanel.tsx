import React, { Component } from 'react'
import { Toxen } from '../../ToxenApp';
import Song from '../../toxen/Song';

interface SongPanelProps {
  getRef?: ((songPanel: SongPanel) => void)
  songs: Song[];
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
    let songs = (Toxen.songList ?? []);

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