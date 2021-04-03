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
    return (Toxen.songList ?? []).map(s => s.Element());
  }
}