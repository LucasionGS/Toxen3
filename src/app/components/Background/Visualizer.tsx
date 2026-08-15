import React, { Component } from 'react';
import Settings, { VisualizerStyle, visualizerStyleOptions } from '../../toxen/Settings';
import { Toxen } from '../../ToxenApp';
import "./Visualizer.scss";
import { hexToRgb } from '../Form/FormInputFields/FormInputColorPicker';
import StoryboardParser from '../../toxen/StoryboardParser';
import { ThemeStyleTemplate } from '../../toxen/Theme';
import ExtensionManager, { VisualizerRenderContext, VisualizerRendererFn } from '../../toxen/extensions/ExtensionManager';
import User from '../../toxen/User';
import FrameProfiler from '../../toxen/FrameProfiler';
import AudioAnalyser, { DEFAULT_FFTSIZE } from './AudioAnalyser';
import VisualizerImages from './VisualizerImages';
import Frame from './visualizers/frame';
import VisualizerLayer, { FramePayload } from './visualizers/layer';
import { fallbackVisualizer, getBuiltInVisualizer } from './visualizers/registry';
import WorkerBridge from './visualizers/worker/WorkerBridge';
import { drawFloatingTitle, FloatingTitleOptions, getFloatingTitleCutout, layoutFloatingTitle } from './FloatingTitle';

interface VisualizerProps { }

interface VisualizerState { }

const DATA_SIZE = 255;
const BAR_OPACITY = 0.7;
const LOGO_KEY = "logo";
const RAINBOW_GRADIENT = "linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(255,154,0,1) 10%, rgba(208,222,33,1) 20%, rgba(79,220,74,1) 30%, rgba(63,218,216,1) 40%, rgba(47,201,226,1) 50%, rgba(28,127,238,1) 60%, rgba(95,21,242,1) 70%, rgba(186,12,248,1) 80%, rgba(251,7,217,1) 90%, rgba(255,0,0,1) 100%)";

/**
 * The visualizer paints two stacked canvases.
 *
 * The lower one holds the dim, the particles and the built-in style, and is handed to a worker
 * via OffscreenCanvas when the platform allows it. The upper one stays on the main thread and
 * holds everything that cannot leave it: extension styles, which are third-party code typed
 * against a `CanvasRenderingContext2D`, the floating title, whose font is a system font, and the
 * storyboard callbacks, which close over main-thread state.
 *
 * Both paths render through the same VisualizerLayer, so the worker and the fallback cannot drift.
 */
export default class Visualizer extends Component<VisualizerProps, VisualizerState> {
  constructor(props: VisualizerProps) {
    super(props);
    this.state = {};
    this.boundLoop = this.loop.bind(this);
  }

  private lastColor: string = "";
  private lastFillColor: string = "";
  private lastBackground: string = "";
  private dynamicDim = 0;

  private images = new VisualizerImages();
  private analyser = new AudioAnalyser();
  private layer = new VisualizerLayer();
  private bridge = new WorkerBridge();
  private overlayFrame = new Frame();

  private payload: FramePayload = {
    time: 0, songTime: 0, isPaused: false,
    spectrum: null, len: 0,
    width: 0, height: 0, left: 0, top: 0,
    dimColor: "", styleId: null,
    dynLight: 0, opacity: BAR_OPACITY, pulseEnabled: false,
    storedColor: "", isRainbow: false, isGlow: false,
    intensityMultiplier: 1, power: 1,
    progressBarTop: 0, progressBarLeft: 0,
    options: {}, imageKeys: {}, logoKey: null,
    starRush: null, rainfall: null, titleCutout: null,
  };

  private boundLoop: (time: number) => void;

  public getDynamicDim() {
    return this.dynamicDim;
  }

  private loop(time: number) {
    if (!this.stopped) requestAnimationFrame(this.boundLoop);
    if (!this.overlayCtx) return;
    FrameProfiler.beginFrame(time);

    const overlayCtx = this.overlayCtx;
    overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (!Toxen.musicPlayer || !Toxen.musicPlayer.media) return;

    const media = Toxen.musicPlayer.media;
    const storyboard = Toxen.background.storyboard;
    storyboard.beginFrame();
    const song = storyboard.getSong();

    // Low performance mode skips every additional rendering effect: storyboard, dynamic
    // lighting, visualizer, particles and floating title.
    const lowPerformanceMode = Settings.get("lowPerformanceMode") ?? false;

    const storyboardCallbacks = lowPerformanceMode ? [] : StoryboardParser.drawStoryboard(overlayCtx, {
      currentSongTime: media.currentTime,
      songDuration: media.duration,
      isPaused: media.paused,
    });

    const storedColor = storyboard.getVisualizerColor();
    const baseBackgroundDim = (storyboard.getBackgroundDim() ?? 50) / 100;
    let usedDimColor: string;

    if (!lowPerformanceMode && storyboard.getDynamicLighting()) {
      const rgb = hexToRgb(storedColor);
      usedDimColor = this.dynamicDim >= 0
        ? `rgba(0,0,0,${this.dynamicDim})`
        : `rgba(${rgb.r},${rgb.g},${rgb.b},${-this.dynamicDim / 2})`;
    }
    else {
      usedDimColor = `rgba(0,0,0,${baseBackgroundDim})`;
    }

    const isRainbow = storyboard.getVisualizerRainbow();
    // setFillColor is a setState, so it must only run when the colour actually changes.
    const fillColor = isRainbow ? RAINBOW_GRADIENT : storedColor;
    if (this.lastFillColor !== fillColor) {
      this.lastFillColor = fillColor;
      Toxen.musicControls.progressBar.setFillColor(fillColor);
    }
    if (this.lastColor !== storedColor) {
      Toxen.applyAutogeneratedThemeIfEnabled();
    }
    this.lastColor = storedColor ?? this.lastColor;

    this.updateBackground(storyboard, song);

    const payload = this.payload;
    payload.time = time;
    payload.songTime = media.currentTime;
    payload.isPaused = media.paused;
    payload.width = this.overlayCanvas.width;
    payload.height = this.overlayCanvas.height;
    payload.left = this.left;
    payload.top = this.top;
    payload.dimColor = usedDimColor;
    payload.opacity = BAR_OPACITY;
    payload.storedColor = storedColor;
    payload.isRainbow = isRainbow;
    payload.titleCutout = null;

    if (lowPerformanceMode) {
      this.dynamicDim = baseBackgroundDim;
      Toxen.background.updateDimScale(0);
      payload.styleId = null;
      payload.starRush = null;
      payload.rainfall = null;
      payload.isGlow = false;
      payload.dynLight = 0;
      payload.len = 0;
      this.submit(payload, this.emptySpectrum);
      storyboard.resetData();
      storyboard.endFrame();
      FrameProfiler.endFrame();
      return;
    }

    const style = storyboard.getVisualizerStyle();
    const intensityMultiplier = storyboard.getVisualizerIntensity();
    const power = (1 / (Settings.get("volume") / 100));

    const spectrum = this.readSpectrum(storyboard);
    const len = spectrum.length;
    const dynLight = this.getDynamicLight(spectrum, len, intensityMultiplier, power);

    this.dynamicDim = baseBackgroundDim - dynLight;

    const pulseEnabled = storyboard.getVisualizerPulseBackground();
    Toxen.background.updateDimScale(pulseEnabled ? dynLight : 0);

    const extensionRenderer = this.resolveExtension(style);
    const builtIn = extensionRenderer ? null : (getBuiltInVisualizer(style as string) ?? fallbackVisualizer);
    const drawsBuiltIn = style !== VisualizerStyle.None && builtIn !== null;

    payload.len = len;
    payload.dynLight = dynLight;
    payload.pulseEnabled = pulseEnabled;
    payload.isGlow = storyboard.getVisualizerGlow();
    payload.intensityMultiplier = intensityMultiplier;
    payload.power = power;
    payload.styleId = drawsBuiltIn ? builtIn.id : null;
    payload.progressBarTop = 0;
    payload.progressBarLeft = 0;
    payload.logoKey = this.registerImage(LOGO_KEY, this.images.getLogoElement());

    // Unknown styles fall back to ProgressBar, which needs the bar geometry.
    const usesProgressBarGeometry = drawsBuiltIn && builtIn === fallbackVisualizer;
    if (usesProgressBarGeometry) {
      const rect = Toxen.musicControls.progressBar.progressBarObject.getBoundingClientRect();
      payload.progressBarTop = rect.top;
      payload.progressBarLeft = rect.left;
    }

    this.collectStyleOptions(storyboard, style, payload);

    payload.starRush = storyboard.getStarRushEffect()
      ? { intensity: storyboard.getStarRushIntensity(), visualizerIntensity: intensityMultiplier }
      : null;

    if (storyboard.getRainfallEffect()) {
      const imagePath = storyboard.getRainfallImage();
      const src = imagePath
        ? (Settings.isRemote() ? User.appendAuth(imagePath) : imagePath)
        : null;
      payload.rainfall = {
        frequency: storyboard.getRainfallFrequency(),
        speed: storyboard.getRainfallSpeed(),
        imageScale: storyboard.getRainfallImageScale(),
        imageKey: src ? this.registerImage(src, this.images.getElement(src)) : null,
        color: storyboard.getRainfallColor(),
      };
    } else {
      payload.rainfall = null;
    }

    FrameProfiler.mark("resolve");

    // The ProgressBar style reassigns the height the floating title is laid out against.
    const titleHeight = usesProgressBarGeometry ? payload.progressBarTop : payload.height;
    const title = this.prepareTitle(overlayCtx, style, song, payload.width, titleHeight);
    if (title && title.overrideVisualizer && title.layout.shouldOverride) {
      payload.titleCutout = getFloatingTitleCutout(title.layout);
    }

    this.submit(payload, spectrum);

    FrameProfiler.mark("draw");

    if (extensionRenderer && style !== VisualizerStyle.None) {
      this.drawExtensionStyle(style, extensionRenderer, overlayCtx, payload, spectrum);
    }

    if (title) {
      drawFloatingTitle(overlayCtx, title.layout, title.options, this.lastColor ?? '#fff', BAR_OPACITY);
    }

    FrameProfiler.mark("title");

    for (const callback of storyboardCallbacks) {
      callback();
    }

    storyboard.resetData();
    storyboard.endFrame();
    FrameProfiler.endFrame();
  }

  private emptySpectrum = new Uint8Array(0);

  /**
   * Hands the frame to the worker, or draws it here when the worker is unavailable or has
   * dropped out.
   */
  private submit(payload: FramePayload, spectrum: Uint8Array) {
    if (this.bridge.isActive) {
      payload.spectrum = spectrum;
      // A dropped frame means the worker is still busy. Skipping beats queueing a stale one.
      if (this.bridge.sendFrame(payload, spectrum)) return;
      if (this.bridge.isActive) return;
    }

    const ctx = this.layerCtx ?? this.adoptLayerOntoOverlay();
    if (!ctx) return;

    payload.spectrum = spectrum;
    this.layer.render(ctx, payload, key => this.images.getByKey(key));
  }

  /**
   * A canvas whose control has been transferred can never hand back a 2D context, so if the
   * worker dies mid-session the lower canvas is dead. Hide it and draw the layer onto the
   * overlay instead, below everything the overlay already draws.
   */
  private adoptLayerOntoOverlay(): CanvasRenderingContext2D {
    if (!this.overlayCtx) return null;
    if (this.canvas && this.canvas.style.display !== "none") {
      this.canvas.style.display = "none";
    }
    return this.overlayCtx;
  }

  /**
   * Registers an image with the worker the first time it is seen and returns the key the payload
   * should reference it by, or null while it is still loading.
   */
  private registerImage(key: string, element: HTMLImageElement | null): string | null {
    if (!element || !element.complete || element.naturalWidth <= 0) return null;
    if (this.bridge.isActive) this.bridge.sendImage(key, element);
    return key;
  }

  /**
   * Resolves the current style's declared options up front, since the worker cannot call back
   * into the storyboard.
   */
  private collectStyleOptions(storyboard: typeof Toxen.background.storyboard, style: VisualizerStyle | string, payload: FramePayload) {
    const options = payload.options;
    const imageKeys = payload.imageKeys;
    for (const key of Object.keys(options)) delete options[key];
    for (const key of Object.keys(imageKeys)) delete imageKeys[key];

    const declared = visualizerStyleOptions[style as string] ?? ExtensionManager.getVisualizerOptions(style as string);
    if (!declared) return;

    const song = storyboard.getSong();
    for (const option of declared) {
      const value = storyboard.getVisualizerOption(style, option.key);
      options[option.key] = value;

      if (option.type === "songImage" && typeof value === "string" && value && song) {
        const src = User.appendAuth(`${song.dirname()}/${value}`);
        const key = this.registerImage(src, this.images.getElement(src));
        if (key) imageKeys[value] = key;
      }
    }
  }

  private resolveExtension(style: VisualizerStyle | string) {
    return ExtensionManager.isExtensionStyle(style as string)
      ? ExtensionManager.getVisualizerRenderer(style as string)
      : undefined;
  }

  /**
   * Extension styles are third-party functions typed against the public `apiVersion: 1` context,
   * whose `setRainbowIfEnabled` does not take a context argument. They draw on the overlay, which
   * keeps them on a real CanvasRenderingContext2D.
   */
  private drawExtensionStyle(
    style: VisualizerStyle | string,
    extensionRenderer: VisualizerRendererFn,
    ctx: CanvasRenderingContext2D,
    payload: FramePayload,
    spectrum: Uint8Array,
  ) {
    const frame = this.overlayFrame;
    frame.ctx = ctx;
    frame.dataArray = spectrum;
    frame.len = payload.len;
    frame.dataSize = DATA_SIZE;
    frame.vWidth = payload.width;
    frame.vHeight = payload.height;
    frame.vLeft = payload.left;
    frame.vTop = payload.top;
    frame.time = payload.time;
    frame.songTime = payload.songTime;
    frame.isPaused = payload.isPaused;
    frame.dynLight = payload.dynLight;
    frame.opacity = payload.opacity;
    frame.pulseEnabled = payload.pulseEnabled;
    frame.storedColor = payload.storedColor;
    frame.isRainbow = payload.isRainbow;
    frame.isGlow = payload.isGlow;
    frame.intensityMultiplier = payload.intensityMultiplier;
    frame.power = payload.power;

    const oldShadowBlur = ctx.shadowBlur;
    const oldShadowColor = ctx.shadowColor;
    if (payload.isGlow) ctx.shadowColor = payload.storedColor;
    ctx.fillStyle = ctx.strokeStyle = payload.storedColor;

    const renderContext: VisualizerRenderContext = {
      ctx,
      dataArray: spectrum,
      len: payload.len,
      dataSize: DATA_SIZE,
      vWidth: payload.width,
      vHeight: payload.height,
      vLeft: payload.left,
      vTop: payload.top,
      time: payload.time,
      dynLight: payload.dynLight,
      opacity: payload.opacity,
      pulseEnabled: payload.pulseEnabled,
      storedColor: payload.storedColor,
      isRainbow: payload.isRainbow,
      isGlow: payload.isGlow,
      intensityMultiplier: payload.intensityMultiplier,
      getMaxHeight: frame.getMaxHeight,
      getMaxWidth: frame.getMaxWidth,
      setBarShadowBlur: frame.setBarShadowBlur,
      setRainbowIfEnabled: (x, y, w, h, i) => frame.setRainbowIfEnabled(ctx, x, y, w, h, i),
      getOption: key => payload.options[key] ?? null,
    };

    try {
      extensionRenderer(renderContext);
    } catch (e) {
      console.error(`[Extensions] Visualizer render error (${style}):`, e);
    }

    ctx.shadowBlur = oldShadowBlur;
    ctx.shadowColor = oldShadowColor;
  }

  private prepareTitle(
    ctx: CanvasRenderingContext2D,
    style: VisualizerStyle | string,
    song: ReturnType<typeof Toxen.background.storyboard.getSong>,
    vWidth: number,
    vHeight: number,
  ) {
    const storyboard = Toxen.background.storyboard;
    if (!storyboard?.getFloatingTitle() || !song) return null;

    const text = storyboard.getFloatingTitleText();
    if (!text) return null;

    const options: FloatingTitleOptions = {
      text,
      position: storyboard.getFloatingTitlePosition() ?? "center",
      underline: storyboard.getFloatingTitleUnderline(),
      reactive: storyboard.getFloatingTitleReactive(),
      overrideVisualizer: storyboard.getFloatingTitleOverrideVisualizer(),
      outlineColor: storyboard.getFloatingTitleOutlineColor() ?? "white",
      usingSubtitles: storyboard.getFloatingSubtitles(),
      isMiniplayer: Toxen.isMiniplayer(),
    };

    const layout = layoutFloatingTitle(ctx, options, style, vWidth, vHeight, this.dynamicDim);
    return { options, layout, overrideVisualizer: options.overrideVisualizer };
  }

  private updateBackground(storyboard: typeof Toxen.background.storyboard, song: ReturnType<typeof Toxen.background.storyboard.getSong>) {
    const backgroundFile = storyboard.getBackground();
    if (this.lastBackground === backgroundFile) return;

    this.lastBackground = backgroundFile;
    if (!backgroundFile) {
      Toxen.background.setBackground(null);
      return;
    }

    const img = new Image();
    img.src = User.appendAuth(`${storyboard.getBackground(true)}?h=${song.hash}`);
    img.onload = () => {
      if (this.lastBackground === backgroundFile) Toxen.background.setBackground(img.src);
    };
  }

  private readSpectrum(storyboard: typeof Toxen.background.storyboard) {
    const dataArray = this.analyser.read(
      Settings.get("fftSize") ? Math.pow(2, Settings.get("fftSize") + 4) : Visualizer.DEFAULT_FFTSIZE
    );

    if (storyboard.getVisualizerNormalize()) {
      let maxVal = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxVal) maxVal = dataArray[i];
      }
      const max = maxVal / 100 || 1;
      for (let i = 0; i < dataArray.length; i++) {
        dataArray[i] = Math.round(dataArray[i] / max) * 2;
      }
    }

    if (storyboard.getVisualizerShuffle()) {
      let seed = 1;
      const random = () => {
        const x = Math.sin(seed++) * dataArray.length;
        return x - Math.floor(x);
      };
      for (let i = dataArray.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = dataArray[i];
        dataArray[i] = dataArray[j];
        dataArray[j] = tmp;
      }
    }

    return dataArray;
  }

  /**
   * Average bar height as a fraction of the maximum, used for the dynamic dim and by styles that
   * react to loudness.
   */
  private getDynamicLight(dataArray: Uint8Array, len: number, intensityMultiplier: number, power: number) {
    const maxHeight = ((intensityMultiplier * this.overlayCanvas.height * 0.3) ^ power ^ power) || 1;
    const unitH = maxHeight / DATA_SIZE;

    let averageHeight = 0;
    for (let i = 0; i < len; i++) {
      averageHeight += (dataArray[i] * unitH);
    }
    averageHeight /= len;

    return Math.min(averageHeight, maxHeight) / maxHeight;
  }

  public static readonly DEFAULT_FFTSIZE = DEFAULT_FFTSIZE;

  private stopped = true;
  public stop() {
    this.stopped = true;
    this.layer.clearParticles();
    this.bridge.clear();
  }
  public isStopped() {
    return this.stopped;
  }

  public start() {
    this.update();
    if (!this.analyser.initialized) this.analyser.initialize(Toxen.musicPlayer.media);
    this.stopped = false;
    this.loop(0);
  }

  public static DEFAULT_COLOR(): string {
    if (Toxen.theme && Toxen.theme.styles["accentColor"]) {
      return ThemeStyleTemplate["Core Colors"]["accentColor"].parser(
        Toxen.theme.styles["accentColor"].value
      );
    }

    return "#ffffff";
  };

  /** Lower layer. Owned by the worker once transferred, so it has no main-thread context then. */
  public canvas: HTMLCanvasElement;
  private layerCtx: CanvasRenderingContext2D;

  public overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  public left: number = 0;
  public top: number = 0;

  private layerRef = React.createRef<HTMLCanvasElement>();
  private overlayRef = React.createRef<HTMLCanvasElement>();

  componentDidMount() {
    this.canvas = this.layerRef.current;
    this.overlayCanvas = this.overlayRef.current;

    const useWorker = (Settings.get("visualizerUseWorker") ?? true) && WorkerBridge.isSupported();
    if (!useWorker || !this.bridge.attach(this.canvas)) {
      this.layerCtx = this.canvas.getContext("2d");
    }
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    this.measure();
    window.addEventListener("resize", this.updateThis);

    // The canvas is sized from CSS, so it can change without a window resize: --bodyHeight, the
    // side panel and the miniplayer all move it.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.overlayCanvas);
    }
  }

  componentWillUnmount() {
    this.stop();
    this.bridge.dispose();
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.updateThis);
  }

  private resizeObserver: ResizeObserver;

  /**
   * The lower canvas may belong to the worker, in which case its backing store can only be sized
   * from there.
   */
  private measure() {
    const overlay = this.overlayCanvas;
    if (!overlay) return;

    const box = overlay.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);

    this.left = box.left;
    this.top = box.top;

    // Assigning width or height clears the canvas, so only do it on an actual change.
    if (overlay.width === width && overlay.height === height) return;

    overlay.width = width;
    overlay.height = height;

    if (this.bridge.isActive) this.bridge.resize(width, height);
    else if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  update() {
    this.measure();
    this.setState({});
  }

  updateThis: Visualizer["update"] = this.update.bind(this);

  render() {
    return (
      <div>
        <canvas className="audio-visualizer" ref={this.layerRef}></canvas>
        <canvas className="audio-visualizer audio-visualizer-overlay" ref={this.overlayRef}></canvas>
      </div>
    )
  }
}
