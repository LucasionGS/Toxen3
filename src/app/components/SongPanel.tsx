import React, { Component } from 'react'
import SidepanelSection from './SidepanelSection'

export default class SongPanel extends Component<SidepanelSection["props"]> {
  render() {
    return (
      <SidepanelSection id={this.props.id}>
        {this.props.children}
      </SidepanelSection>
    )
  }
}

