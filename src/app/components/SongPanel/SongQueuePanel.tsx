import React, { Component } from 'react'
import { Toxen } from '../../ToxenApp';
import Song from '../../toxen/Song';
import { Button } from '@mantine/core';

interface SongQueuePanelProps {
  getRef?: ((songQueuePanel: SongQueuePanel) => void)
}

interface SongQueuePanelState {
}

export default class SongQueuePanel extends Component<SongQueuePanelProps, SongQueuePanelState> {
  constructor(props: SongQueuePanelProps) {
    super(props);
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  public update() {
    return this.setState({});
  }

  render() {
    let songs = (Toxen.songQueue ?? []);
    if (songs.length === 0) return (<></>);
    // if (Toxen.songSearch) {
    //   let items = Toxen.songSearch.toLowerCase().replace(/_/g, " ").split(" ");
    //   songs = songs.filter(s => {
    //     let sortItems = [
    //       s.artist ?? "", // Artist
    //       s.title ?? "", // Title
    //       ...(s.coArtists ?? []), // Co-Artists
    //       s.source ?? "",
    //       ...(s.tags ?? []),
    //     ].join(" ").replace(/_/g, " ").trim().toLowerCase();
    //     return items.every(item => sortItems.includes(item));
    //   })
    // }
    return (
      <>
        <h2>Current Queue</h2>
        <Button title="Remove all songs from the queue." color="red" onClick={() => Song.clearQueue()}>Clear Queue</Button>
        {songs.map(s => s.Element())}
        <hr />
      </>
    )
  }
}