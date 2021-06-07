import React, { Component } from 'react'
import Visualizer from './Background/Visualizer';
import "./ProgressBar.scss";

type Color = string;

interface ProgressBarProps {
  initialValue?: number;
  min?: number;
  max?: number;
  fillColor?: Color;
  borderColor?: Color;
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>, valueAtCursor: number, ref: ProgressBar) => void;
  onClickRelease?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>, valueAtCursor: number, ref: ProgressBar) => void;
  onDragging?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>, valueAtCursor: number, ref: ProgressBar) => void;
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

  onClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    // this.holding = true;
    if (typeof this.props.onClick === "function") this.props.onClick(event, this.offsetToValue(event.nativeEvent.offsetX), this);
  }

  onClickRelease(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    // this.holding = false;
    if (typeof this.props.onClickRelease === "function") this.props.onClickRelease(event, this.offsetToValue(event.nativeEvent.offsetX), this);
  }

  onDragging(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (typeof this.props.onDragging === "function") this.props.onDragging(event, this.offsetToValue(event.nativeEvent.offsetX), this);
  }

  public progressBarObject: HTMLDivElement;

  private offsetToValue(xOffset: number) {
    let box = this.progressBarObject.getBoundingClientRect();
    let max = this.state.max - this.state.min;
    let p1 = max / box.width;
    return p1 * xOffset;
  }

  /**
   * Whether or not the cursor currently holding down Mouse0 on this progress bar.
   */
  public holding = false;

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
    this.setState({ fillColor: fillColor || Visualizer.DEFAULT_COLOR });
  }

  setBorderColor(borderColor: Color) {
    this.setState({ borderColor: borderColor || Visualizer.DEFAULT_COLOR });
  }

  setValue(value: number) {
    this.setState({ value });
  }

  setMax(max: number) {
    this.setState({ max });
  }

  setMin(min: number) {
    this.setState({ min });
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
        <div ref={ref => this.progressBarObject = ref}
          className="toxen-progress-bar"
          style={borderStyle}
          onMouseDown={e => {
            if (e.nativeEvent.buttons === 1) this.onClick(e);
          }}
          onMouseUp={e => {
            this.onClickRelease(e);
          }}
          onMouseMove={e => {
            if (e.nativeEvent.buttons === 1) this.onDragging(e);
          }}
        >
          <div className="toxen-progress-bar-fill" style={fillStyle}></div>
        </div>
      </div>
    )
  }
}