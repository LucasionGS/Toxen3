import React, { Component } from "react";
import { Toxen } from "../../ToxenApp";
import Button from "../Button/Button";
import "./AdjustPanel.scss";

interface AdjustPanelProps { }
interface AdjustPanelState { }

export default class AdjustPanel extends Component<AdjustPanelProps, AdjustPanelState> {
  constructor(props: AdjustPanelProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div>
        <h1>Audio Adjustments</h1>
        <Button txStyle="action" onClick={() => {
          Toxen.sidePanel.setSectionId("trimSong");
        }}>Trim current song</Button>
      </div>
    )
  }
}
