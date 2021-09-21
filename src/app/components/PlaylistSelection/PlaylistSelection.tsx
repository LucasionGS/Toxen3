import React, { Component } from 'react'
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./PlaylistSelection.scss";

interface PlaylistSelectionProps {
  songs: Song[];
}

interface PlaylistSelectionState {
  
}

export default class PlaylistSelection extends Component<PlaylistSelectionProps, PlaylistSelectionState> {
  constructor(props: PlaylistSelectionProps) {
    super(props);

    this.state = {
      
    }
  }
  
  render() {
    const playlists = Toxen.playlists;
    return (
      <div>
        
      </div>
    )
  }
}