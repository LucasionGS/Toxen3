import React, { Component } from 'react'
import { Toxen } from '../ToxenApp';
import Visualizer from './Background/Visualizer';
import { hexToRgb, invertRgb, rgbToGrayscale, rgbToHex } from './Form/FormInputFields/FormInputColorPicker';
import "./ProgressBar.scss";
import Tooltip from './Tooltip';

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
  onHover?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>, valueAtCursor: number, ref: ProgressBar) => void;
  toolTip?: (value: number, max: number, min: number, ref: ProgressBar) => string | number;
}

interface ProgressBarState {
  value: number;
  bufferedRange: [number, number];
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
      bufferedRange: [0, 0]
    }
  }

  private toolTip: Tooltip;

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

  onHover(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (typeof this.props.onHover === "function") this.props.onHover(event, this.offsetToValue(event.nativeEvent.offsetX), this);
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
   * Whether or not the cursor currently hovering over this progress bar.
   */
  public hovering = false;

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

  /**
   * Sets the background value of the progress bar. This is useful for showing what part of a song is buffered.
   */
  public setBackgroundRange(start: number, end: number) {
    this.setState({ bufferedRange: [start, end] });
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
    let percentBuffered = (100 / (max - min)) * ((this.state.bufferedRange[1] - this.state.bufferedRange[0]) - min);

    let borderStyle: React.HTMLAttributes<HTMLDivElement>["style"] = {
      borderColor: this.state.borderColor ?? "#fff"
    };

    let fillStyle: React.HTMLAttributes<HTMLDivElement>["style"] = {
      width: `${percent}%`,
      backgroundColor: this.state.fillColor ?? "#fff"
    };
    let fillStyleBuffered: React.HTMLAttributes<HTMLDivElement>["style"] = {
      backgroundColor: this.state.fillColor ?? "#fff",
      width: `${percentBuffered}%`,
      left: `${this.state.bufferedRange[0] / (max - min) * 100}%`,
      opacity: 0.2,
    };
    return (
      <>
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
              this.onHover(e);
              if (e.nativeEvent.buttons === 1) this.onDragging(e);
              if (typeof this.props.toolTip === "function") {
                this.toolTip.set(
                  String(this.props.toolTip(
                    this.offsetToValue(e.nativeEvent.offsetX),
                    max,
                    min,
                    this
                  )),
                  e.nativeEvent.offsetX - (this.toolTip.divElement.getBoundingClientRect().width / 2),
                  -32,
                  // rgbToHex(invertRgb(hexToRgb(this.state.fillColor))),
                  // rgbToHex(rgbToGrayscale(hexToRgb(this.state.fillColor)))
                );
              }
            }}
            onMouseLeave={e => {
              this.hovering = false;
              if (typeof this.props.toolTip === "function") this.toolTip.setVisibility(this.hovering);
            }}
            onMouseEnter={e => {
              this.hovering = true;
              if (typeof this.props.toolTip === "function") this.toolTip.setVisibility(this.hovering);
            }}
          >
            <div className="toxen-progress-bar-fill" style={fillStyle}>
              <Tooltip text="" ref={ref => this.toolTip = ref} />
            </div>
            <div className="toxen-progress-bar-fill" style={fillStyleBuffered}></div>
          </div>
        </div>
      </>
    )
  }
}