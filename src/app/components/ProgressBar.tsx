import React, { Component } from 'react'
import "./ProgressBar.scss";

type Color = React.HTMLAttributes<HTMLDivElement>["style"]["backgroundColor"];

interface ProgressBarProps {
  initialValue?: number;
  min?: number;
  max?: number;
  fillColor?: Color;
  borderColor?: Color;
}

interface ProgressBarState {
  value: number;
  min: number;
  max: number;
  fillColor: Color;
  borderColor: Color;
}

export default class ProgressBar extends Component<ProgressBarProps, ProgressBarState> {
  constructor(props: ProgressBarProps) {
    super(props);

    this.state = {
      value: this.props.initialValue ?? 0,
      min: this.props.min ?? 0,
      max: this.props.max ?? 100,
      fillColor: this.props.fillColor,
      borderColor: this.props.borderColor,
    }
  }
  
  componentDidMount() {
  }

  /**
   * Set both fillColor and borderColor to the same color.
   */
  setColor(color: Color): void;
  /**
   * Set fillColor and borderColor with 2 different colors at the same time. Prevents a double state update.
   */
  setColor(fillColor: Color, borderColor: Color): void;
  setColor(fillColor: Color, borderColor?: Color) {
    this.setState({
      fillColor: fillColor,
      borderColor: borderColor ?? fillColor
    });
  }

  setFillColor(fillColor: Color) {
    this.setState({fillColor});
  }
  
  setBorderColor(borderColor: Color) {
    this.setState({borderColor});
  }

  setValue(value: number) {
    this.setState({value});
  }
  
  setMax(max: number) {
    this.setState({max});
  }
  
  setMin(min: number) {
    this.setState({min});
  }
  
  render() {
    const {
      max,
      min,
      value
    } = this.state;
    let percent = (100 / (max - min)) * (value - min);
    
    let borderStyle: React.HTMLAttributes<HTMLDivElement>["style"] = {
      borderColor: this.state.borderColor ?? "#fff"
    };

    let fillStyle: React.HTMLAttributes<HTMLDivElement>["style"] = {
      width: `${percent}%`,
      backgroundColor: this.state.fillColor ?? "#fff"
    };
    return (
      <div className="toxen-progress-bar-container">
        <div className="toxen-progress-bar" style={borderStyle}>
          <div className="toxen-progress-bar-fill" style={fillStyle}></div>
        </div>
      </div>
    )
  }
}