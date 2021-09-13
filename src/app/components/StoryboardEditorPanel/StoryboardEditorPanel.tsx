import React, { Component } from 'react'
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import SidepanelSection from '../Sidepanel/SidepanelSection';
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader';

interface StoryboardEditorPanelProps { }

interface StoryboardEditorPanelState { }

export default class StoryboardEditorPanel extends Component<StoryboardEditorPanelProps, StoryboardEditorPanelState> {
  constructor(props: StoryboardEditorPanelProps) {
    super(props);

    this.state = {};
  }

  public setSong(song: Song) {
    this.setState({ song });
  }
  render() {
    return (
      <>
        <SidepanelSectionHeader>
          <h1>Storyboard Editor</h1>
          <button className="tx-btn tx-btn-action" onClick={() => {
            Toxen.log("Saved storyboard", 2000);
          }}>Save</button>
          <button className="tx-btn tx-btn-cancel" onClick={() => {
            // Check if there are unsaved changes and confirm the exit.


            Toxen.setMode("Player");
          }}>Exit editor</button>
        </SidepanelSectionHeader>
        <h1>Storyboard editor coming soon!</h1>
        <p>Click the <code>Exit editor</code> to get back to your songs.</p>
        <p>Nothing can be done in here yet. This is just a placeholder.</p>
      </>
    )
  }
}