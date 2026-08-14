/**
 * Rendering contract shared by every visualizer style.
 *
 * Nothing in this directory may import `Toxen`, `Settings`, `toxenapi` or `User`. Everything a
 * style needs arrives on the frame, which is what allows these modules to run inside a worker
 * against an OffscreenCanvas as well as on the main thread.
 */

export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * An image that is loaded and safe to draw. The host resolves paths, authentication and load
 * state, so styles never have to check `complete` or `naturalWidth`.
 */
export interface ReadyImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface RainbowGradientEdges {
  top?: boolean;
  bottom?: boolean;
}

export interface VisualizerFrame {
  ctx: Canvas2D;

  /** Processed frequency data for this frame. Only the first `len` entries are valid. */
  dataArray: Uint8Array;
  len: number;
  /** Maximum value a `dataArray` entry can hold. */
  dataSize: number;

  vWidth: number;
  vHeight: number;
  vLeft: number;
  vTop: number;

  /** requestAnimationFrame timestamp. */
  time: number;
  /** Playback position of the current song, in seconds. */
  songTime: number;
  isPaused: boolean;

  dynLight: number;
  opacity: number;
  pulseEnabled: boolean;

  storedColor: string;
  isRainbow: boolean;
  isGlow: boolean;
  intensityMultiplier: number;

  /** Top and left of the progress bar, needed by the ProgressBar style. */
  progressBarTop: number;
  progressBarLeft: number;

  logo: ReadyImage | null;
  /** Resolves an image configured on the current style, relative to the song directory. */
  getImage(name: string): ReadyImage | null;

  getMaxHeight(multiplier?: number): number;
  getMaxWidth(multiplier?: number): number;
  setBarShadowBlur(height: number): void;
  setRainbowIfEnabled(
    ctx: Canvas2D,
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    i: number,
    cycleIncrementer?: number,
    options?: RainbowGradientEdges,
  ): void;
  useAlpha(alpha: number, callback: (ctx: Canvas2D) => void): void;
  getOption<T = any>(key: string): T;
}

export interface VisualizerRenderer {
  id: string;
  name: string;
  draw(frame: VisualizerFrame): void;
}

/** Shared edge presets, hoisted so the bar styles do not allocate one per bar. */
export const EDGE_TOP: RainbowGradientEdges = { top: true, bottom: false };
export const EDGE_BOTTOM: RainbowGradientEdges = { top: false, bottom: true };
export const EDGE_NONE: RainbowGradientEdges = { top: false, bottom: false };
