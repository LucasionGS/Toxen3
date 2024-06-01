import React, { Component } from 'react'
import Asyncifier from '../toxen/Asyncifier';
import "./Tooltip.scss";

interface TooltipProps {
  text: string;
  x?: number;
  y?: number;
  visible?: boolean;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
  visible: boolean;
  backgroundColor: string;
  textColor: string;
}

export default class Tooltip extends Component<TooltipProps, TooltipState> {
  constructor(props: TooltipProps) {
    super(props);

    this.state = {
      text: props.text,
      x: props.x || 0,
      y: props.y || 0,
      visible: props.visible || false,
      backgroundColor: "",
      textColor: ""
    }
  }

  public setStateAsync = Asyncifier.createSetState(this);

  /**
   * Set the position attributes of the tooltip.
   * @param x X position of the tooltip.
   * @param y Y position of the tooltip.
   */
  public setPosition(x: number, y: number) {
    return this.setState({
      x: x,
      y: y
    })
  }
  
  /**
   * Set the text attribute of the tooltip.
   * @param text The text to display.
   */
  public setText(text: string) {
    return this.setState({
      text: text,
    })
  }

  /**
   * Set all attributes of the tooltip. More effecient than calling setText and setPosition individually if you need to change both anyway.
   * @param text The text to display.
   * @param x X position of the tooltip.
   * @param y Y position of the tooltip.
   */
  public set(text: string, x: number, y: number, backgroundColor?: string, textColor?: string) {
    return this.setState({
      x: x,
      y: y,
      text: text,
      backgroundColor: backgroundColor || "",
      textColor: textColor || ""
    })
  }

  public setVisibility(visible: boolean) {
    return this.setState({
      visible: visible
    });
  }

  public divElement: HTMLDivElement;
  
  render() {
    // if (!this.state.visible) return <></>;
    return (
      <div ref={ref => this.divElement = ref} className="tooltip" style={{
        left: this.state.x,
        top: this.state.y,
        display: this.state.visible ? "" : "none"
      }}>
        <span className="tooltip-text"style={{
          backgroundColor: this.state.backgroundColor,
          color: this.state.textColor
        }} >{this.state.text}</span>
        <div className="tooltip-tail" style={{
          borderTopColor: this.state.backgroundColor
        }} />
      </div>
    )
  }
}