import React, { Component } from 'react'
import "./ProgressBar.scss";

interface ProgressBarProps {
  initialValue?: number;
  min?: number;
  max?: number;
  fillColor?: React.HTMLAttributes<HTMLDivElement>["style"]["backgroundColor"];
}

interface ProgressBarState {
  value: number;
  min: number;
  max: number;
}

export default class ProgressBar extends Component<ProgressBarProps, ProgressBarState> {
  constructor(props: ProgressBarProps) {
    super(props);

    this.state = {
      value: this.props.initialValue ?? 0,
      min: this.props.min ?? 0,
      max: this.props.max ?? 100,
    }
  }
  
  componentDidMount() {
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
    
    let fillStyle: React.HTMLAttributes<HTMLDivElement>["style"] = {
      width: `${percent}%`,
      backgroundColor: this.props.fillColor ?? "#fff"
    };
    return (
      <div className="toxen-progress-bar-container">
        <div className="toxen-progress-bar">
          <div className="toxen-progress-bar-fill" style={fillStyle}></div>
        </div>
      </div>
    )
  }
}