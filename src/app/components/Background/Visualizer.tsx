import React, { Component } from 'react';
import Settings, { VisualizerStyle } from '../../toxen/Settings';
import { Toxen } from '../../ToxenApp';
import MusicPlayer from '../MusicPlayer';
import "./Visualizer.scss";

interface VisualizerProps { }

interface VisualizerState { }

export default class Visualizer extends Component<VisualizerProps, VisualizerState> {
  constructor(props: VisualizerProps) {
    super(props);

    this.state = {};
  }

  private curLen: number = 0;
  private loop(time: number) {
    if (!this.stopped) requestAnimationFrame(this.loop.bind(this));
    if (!this.ctx) return console.log("No ctx exist!");
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!Toxen.musicPlayer || !Toxen.musicPlayer.media) return console.log("Player or media missing");

    let style = Toxen.background.storyboard.getVisualizerStyle();
    if (style === VisualizerStyle.None) return;

    const ctx = this.ctx;
    const storedColor = Toxen.background.storyboard.getVisualizerColor();
    ctx.fillStyle = ctx.strokeStyle = storedColor;
    let [vWidth, vHeight, vLeft, vTop] = [
      this.canvas.width,
      this.canvas.height,
      this.left,
      this.top
    ];

    const dataSize = 255;

    let dataArray = this.getFrequencyData(
      // Settings.get("") ?? Visualizer.DEFAULT_FFTSIZE
    ).reverse();
    dataArray = dataArray.filter((_, i) => i >= (dataArray.length / 2));
    const len = this.curLen = dataArray.length;
    let opacity = 0.7;

    switch (style) {
      default:
      case VisualizerStyle.ProgressBar: { // Progress bar is default.
        vHeight = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect().top;
        vLeft = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect().left;
        const maxHeight = vHeight * 0.30;
        const unitW = ((vWidth - 20 /* Progress bar curve */) - (vLeft * 2)) / len;
        const unitH = maxHeight / dataSize;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = [
            (i * unitW) + vLeft + 10 /* Progress bar curve */, // barX
            vHeight - _barHeight + vTop, // barY
            unitW, // barWidth
            _barHeight // barHeight
          ];

          // If rainbow:
          this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
            top: false,
            bottom: true
          });
          
          this.ctxAlpha(opacity, ctx => {
            ctx.fillRect(barX, barY, barWidth, barHeight); // Draw basic visualizer
          });
        }
        break;
      }

      case VisualizerStyle.Bottom: {
        const maxHeight = vHeight * 0.30;
        const unitW = vWidth / len;
        const unitH = maxHeight / dataSize;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = [
            (i * unitW), // barX
            vHeight - _barHeight, // barY
            unitW, // barWidth
            _barHeight // barHeight
          ];

          // If rainbow:
          this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
            top: false,
            bottom: true
          });
          
          this.ctxAlpha(opacity, ctx => {
            ctx.fillRect(barX, barY, barWidth, barHeight); // Bottom visuals
          });
        }
        break;
      }

      case VisualizerStyle.Top: {
        const maxHeight = vHeight * 0.30;
        const unitW = vWidth / len;
        const unitH = maxHeight / dataSize;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = [
            (i * unitW), // barX
            0, // barY
            unitW, // barWidth
            _barHeight // barHeight
          ];
          
          // If rainbow:
          this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
            top: true,
            bottom: false
          });
          
          this.ctxAlpha(opacity, ctx => {
            ctx.fillRect(barX, barY, barWidth, barHeight); // Top visuals
          });
        }
        break;
      }

      case VisualizerStyle.TopAndBottom: {
        const maxHeight = vHeight * 0.30;
        const unitW = vWidth / len;
        const unitH = maxHeight / dataSize;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = [
            (i * unitW), // barX
            vHeight - _barHeight, // barY
            unitW, // barWidth
            _barHeight // barHeight
          ];
          
          this.ctxAlpha(opacity, ctx => {
            this.setRainbowIfEnabled(ctx, barX, 0, barWidth, barHeight, i, null, {
            top: true,
            bottom: false
          });
            ctx.fillRect(barX, 0, barWidth, barHeight); // Top visuals
            this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, null, {
              top: false,
              bottom: true
          });
            ctx.fillRect(barX, barY, barWidth, barHeight); // Bottom visuals
          });
        }
        break;
      }

      case VisualizerStyle.Center: {
        const maxHeight = vHeight * 0.25;
        const unitW = vWidth / len;
        const unitH = maxHeight / dataSize;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = [
            (i * unitW), // barX
            (vHeight / 2) - _barHeight, // barY
            unitW, // barWidth
            _barHeight * 2 // barHeight
          ];
          
          // If rainbow:
          this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i);
          
          
          this.ctxAlpha(opacity, ctx => {
            ctx.fillRect(barX, barY, barWidth, barHeight); // Draw basic visualizer
          });
        }
        break;
      }

      case VisualizerStyle.Circle: {
        let cycleIncrementer = 360 / len;
        
        const maxHeight = vHeight * 0.50;
        const unitH = maxHeight / dataSize;
        // const unitW = (vWidth * 1.25 + unitH) / len;
        const unitW = unitH * 5;
        for (let i = 0; i < len; i++) {
          const data = dataArray[i];
          const _barHeight = (data * unitH);
          // Position and size
          const [barX, barY, barWidth, barHeight] = this.getBar(
            (vWidth / 2) - (unitW / 2) /* Progress bar curve */, // barX
            (vHeight / 2), // barY
            unitW, // barWidth
            _barHeight // barHeight
          );

          // If rainbow:
          this.setRainbowIfEnabled(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer);
          
          this.ctxAlpha(opacity, ctx => {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, barX, barY);
            ctx.rotate((cycleIncrementer * i + (time / 20000)) * Math.PI);
            ctx.fillRect(-(unitW / 2), 0, barWidth, barHeight); // Draw basic visualizer
            ctx.restore();
          });
        }
        break;
      }
      
    }
  }

  /**
   * Gets the bar array object.
   */
  private getBar(barX: number, barY: number, barWidth: number, barHeight: number): [number, number, number, number] {
    return [
      barX,
      barY,
      barWidth,
      barHeight // Should adjust height appropriately depending on visualizer intensity. Not yet implemented.
    ];
  }

  private getCycleIncrementer() {
    return 360 / this.curLen;
  }

  private setRainbow(ctx: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, i: number, cycleIncrementer?: number, options?: {
    top?: boolean;
    bottom?: boolean;
  }) {
    const rainbowColor = `hsl(${(cycleIncrementer ?? this.getCycleIncrementer()) * i + (Toxen.musicPlayer.media.currentTime * 100)}, 100%, 50%)`;
    
    const grd = ctx.createLinearGradient(barX, barY, barX + barWidth, barY + barHeight);
    if (!options) {
      grd.addColorStop(0, rainbowColor);
    }
    else {
      if (options.top) {
        grd.addColorStop(0, "white");
        grd.addColorStop(0.35, rainbowColor);
      }
      else {
        grd.addColorStop(0, rainbowColor);
      }
      if (options.bottom) {
        grd.addColorStop(0.65, rainbowColor);
        grd.addColorStop(1, "white");
      }
      else {
        grd.addColorStop(1, rainbowColor);
      }
    }
    ctx.fillStyle = grd;
    ctx.strokeStyle = grd;
  }
  
  /**
   * Toggles on Rainbow colors only if `Settings.get("visualizerRainbowMode")` is `true`
   */
  private setRainbowIfEnabled(ctx: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, i: number, cycleIncrementer?: number, options?: {
    top?: boolean;
    bottom?: boolean;
  }) {
    if (Toxen.background.storyboard.getSong()?.visualizerForceRainbowMode || Settings.get("visualizerRainbowMode")) this.setRainbow(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer, options);
  }

  /**
   * Change the globalAlpha value temporarily on a Context2D object and revert back to normal when finished.
   * @param alpha Alpha to use temporarily
   * @param callback Code to execute using the temporary alpha.
   * @param ctx Context to use. If omitted, uses `this.ctx`.
   */
  private ctxAlpha(alpha: number, callback: (ctx: CanvasRenderingContext2D) => void, ctx: CanvasRenderingContext2D = this.ctx) {
    let oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    callback(ctx);
    ctx.globalAlpha = oldAlpha;
  }

  private initializeAudioAnalyser() {
    const audioFile = Toxen.musicPlayer.media;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioFile);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = Visualizer.DEFAULT_FFTSIZE;
    source.connect(audioContext.destination);
    source.connect(analyser);
    this.audioData = analyser;
  }
  

  public static readonly DEFAULT_FFTSIZE = 1024;
  private getFrequencyData(fftSize?: number) {
    if (fftSize && this.audioData.fftSize != fftSize) this.audioData.fftSize = fftSize;
    const bufferLength = this.audioData.frequencyBinCount;
    const amplitudeArray = new Uint8Array(bufferLength);
    this.audioData.getByteFrequencyData(amplitudeArray);

    return amplitudeArray;
  }

  private audioData: AnalyserNode;

  private stopped = true;
  public stop() {
    this.stopped = true;
  }

  public start() {
    this.update();
    this.initializeAudioAnalyser();
    this.stopped = false;
    this.loop(0);
  }

  public static readonly DEFAULT_COLOR: string = "rgba(255, 255, 255, 1)";
  // public color: string = Visualizer.DEFAULT_COLOR;
  // public setColor(color: string) {
  //   this.color = color || Visualizer.DEFAULT_COLOR;
  // }

  public canvas: HTMLCanvasElement;
  public width: number = 0;
  public height: number = 0;
  public left: number = 0;
  public top: number = 0;
  public ctx: CanvasRenderingContext2D;

  public length: Uint8Array;

  componentDidMount() {
    window.addEventListener("resize", this.updateThis);
  }

  componentDidUpdate() { }

  componentWillUnmount() {
    this.stop();
    window.removeEventListener("resize", this.updateThis);
  }

  update() {
    this.setState({});
  }

  updateThis: Visualizer["update"] = this.update.bind(this);

  render() {
    return (
      <div>
        <canvas className="audio-visualizer" ref={ref => {
          this.canvas = ref;
          if (ref && Toxen.musicControls && Toxen.musicControls.progressBar && Toxen.musicControls.progressBar.progressBarObject) {
            this.ctx = ref.getContext("2d");
            let box = ref.getBoundingClientRect();

            this.width = ref.width = box.width;
            this.height = ref.height = box.height;

            this.left = box.left;
            this.top = box.top;
          }
        }}>

        </canvas>
      </div>
    )
  }
}