import React, { Component } from 'react';
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

  private loop(time: number) {
    if (!this.stopped) requestAnimationFrame(this.loop.bind(this));
    if (!this.ctx) return console.log("No ctx exist!");
    if (!Toxen.musicPlayer || !Toxen.musicPlayer.media) return console.log("Player or media missing");


    let ctx = this.ctx;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    const [W, H, L, T] = [
      this.width,
      // this.height,
      Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect().top, // 
      this.left,
      this.top
    ];

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const dataArray = this.getFrequencyData();
    const curDataArray = dataArray;
    const len = curDataArray.length * 0.75;

    const maxHeight = H * 0.30;
    const unitW = (W) / (len);
    const unitH = maxHeight / 255;


    for (let i = 0; i < len; i++) {
      let data = curDataArray[i];
      let h = (data * unitH);
      const [x, y, _width, _height] = [
        (i * unitW) + L,
        H - h + T,
        unitW,
        h
      ];
      let oldAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, _width, _height); // Draw basic visualizer
      ctx.globalAlpha = oldAlpha;
    }
  }

  /**
   * Change the globalAlpha value temporarily on a Context2D object and revert back to normal when finished.
   * @param alpha Alpha to use temporarily
   * @param callback Code to execute using the temporary alpha.
   * @param ctx Context to use. If omitted, uses `this.ctx`.
   */
  private ctxAlpha(alpha: number, callback: (ctx: CanvasRenderingContext2D) => void, ctx: CanvasRenderingContext2D = this.ctx) {
    let oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.8;
    callback(ctx);
    ctx.globalAlpha = oldAlpha;
  }

  private initializeAudioAnalyser() {
    const audioFile = Toxen.musicPlayer.media;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioFile);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    // analyser.fftSize = 128;
    source.connect(audioContext.destination);
    source.connect(analyser);
    this.audioData = analyser;
  }

  private getFrequencyData() {
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

  private static readonly DEFAULTCOLOR: CanvasRenderingContext2D["fillStyle"] = "rgba(255, 255, 255, 0.3)";
  public color: CanvasRenderingContext2D["fillStyle"] = Visualizer.DEFAULTCOLOR;
  public setColor(color: CanvasRenderingContext2D["fillStyle"]) {
    this.color = color || Visualizer.DEFAULTCOLOR;
  }

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

  componentDidUpdate() {
    // this.start();
  }

  componentWillUnmount() {
    this.stop();
    window.removeEventListener("resize", this.updateThis);
  }

  update() {
    this.setState({});
  }

  updateThis: typeof Visualizer["prototype"]["update"] = this.update.bind(this);

  render() {
    return (
      <div>
        <canvas className="audio-visualizer" ref={ref => {
          this.canvas = ref;
          if (ref && Toxen.musicControls && Toxen.musicControls.progressBar && Toxen.musicControls.progressBar.progressBarObject) {
            this.ctx = ref.getContext("2d");
            let box = ref.getBoundingClientRect();
            let progressLine = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect();

            this.width = progressLine.width * 0.98;
            ref.width = box.width;

            this.height = progressLine.top;
            this.left = progressLine.left + (progressLine.width * 0.01);
            ref.height = box.height;
          }
        }}>

        </canvas>
      </div>
    )
  }
}