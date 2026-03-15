/**
 * Toxen Extension API — Type Declarations
 *
 * Use these types when developing extensions for Toxen.
 * Extensions are loaded at runtime via require() and must export
 * an `activate(api)` function.
 *
 * Example:
 * ```js
 * exports.activate = function(api) {
 *   api.registerVisualizer("myVisualizer", function(rc) {
 *     // Use rc.ctx (CanvasRenderingContext2D) to draw
 *     // Use rc.dataArray (Uint8Array) for frequency data
 *   });
 * };
 * ```
 */

/**
 * The API object passed to `activate()`.
 */
export interface ToxenExtensionAPI {
  /** Current API version (currently 1). */
  apiVersion: number;

  /**
   * Register a custom visualizer.
   * @param localId A short identifier unique within this extension (e.g. "whaleshark").
   *   The full ID will be `ext:<extensionId>:<localId>`.
   * @param renderFn Called every animation frame to render the visualizer.
   */
  registerVisualizer(localId: string, renderFn: VisualizerRendererFn): void;
}

/**
 * Function called every frame to render a visualizer.
 */
export type VisualizerRendererFn = (rc: VisualizerRenderContext) => void;

/**
 * Context passed to visualizer render functions each frame.
 * Contains the canvas context, audio data, dimensions, and helper functions.
 */
export interface VisualizerRenderContext {
  /** The 2D canvas rendering context. */
  ctx: CanvasRenderingContext2D;

  /** Frequency data (0-255 per bin). */
  dataArray: Uint8Array;

  /** Number of frequency bins being used. */
  len: number;

  /** Maximum value of a frequency bin (typically 256). */
  dataSize: number;

  /** Canvas width in pixels. */
  vWidth: number;

  /** Canvas height in pixels. */
  vHeight: number;

  /** Canvas left offset (usually 0). */
  vLeft: number;

  /** Canvas top offset (usually 0). */
  vTop: number;

  /** Current playback time in milliseconds. */
  time: number;

  /**
   * Dynamic lighting value (0-1+).
   * Represents overall audio intensity, useful for pulse/glow effects.
   */
  dynLight: number;

  /** Current opacity (0-1). */
  opacity: number;

  /** Whether background pulse is enabled. */
  pulseEnabled: boolean;

  /** The stored visualizer color as a CSS color string. */
  storedColor: string;

  /** Whether rainbow mode is enabled. */
  isRainbow: boolean;

  /** Whether glow mode is enabled. */
  isGlow: boolean;

  /** Intensity multiplier from settings (default 1). */
  intensityMultiplier: number;

  /**
   * Get the maximum height for visualizer bars.
   * @param mult Fraction of canvas height (e.g. 0.15 = 15%). Defaults to 1.
   */
  getMaxHeight(mult?: number): number;

  /**
   * Get the maximum width for visualizer bars.
   * @param mult Fraction of canvas width. Defaults to 1.
   */
  getMaxWidth(mult?: number): number;

  /**
   * Set the shadow blur for glow effects.
   * @param val The shadow blur radius.
   */
  setBarShadowBlur(val: number): void;

  /**
   * If rainbow mode is enabled, sets the canvas fill/stroke style to a
   * rainbow gradient color based on position.
   * @param x X position
   * @param y Y position
   * @param w Width
   * @param h Height
   * @param i Frequency bin index (used for hue calculation)
   */
  setRainbowIfEnabled(x: number, y: number, w: number, h: number, i: number): void;

  /**
   * Get a per-style option value from global/song settings.
   * Returns the user-configured value, or null if using default.
   * @param key The option key (e.g. "x", "size", "swimming")
   */
  getOption(key: string): any;
}

/**
 * Expected exports from an extension's entry file.
 */
export interface ExtensionExports {
  /**
   * Called when the extension is loaded. Use the API to register functionality.
   */
  activate(api: ToxenExtensionAPI): void;

  /**
   * Called when the extension is unloaded/disabled. Clean up any resources.
   */
  deactivate?(): void;
}
