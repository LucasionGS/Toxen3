import React, { Component } from 'react'
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import SidepanelSection from '../Sidepanel/SidepanelSection';

interface StoryboardEditorPanelProps {

}

interface StoryboardEditorPanelState {
  song: Song;
}

export default class StoryboardEditorPanel extends Component<StoryboardEditorPanelProps, StoryboardEditorPanelState> {
  constructor(props: StoryboardEditorPanelProps) {
    super(props);

    this.state = {
      song: null
    }
  }

  public setSong(song: Song) {
    this.setState({ song });
  }
  render() {
    return (
      <SidepanelSection id="storyboardEditor">
        
      </SidepanelSection>
    )
  }
}