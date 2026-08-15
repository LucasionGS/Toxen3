import Frame from "./frame";
import Rainfall from "./particles/Rainfall";
import StarRush from "./particles/StarRush";
import { fallbackVisualizer, getBuiltInVisualizer } from "./registry";
import { Canvas2D, ReadyImage } from "./types";

/**
 * Everything the visualizer layer needs for one frame, in a structured-cloneable shape so it can
 * be posted to a worker unchanged.
 *
 * Images are referenced by key rather than value; the host resolves a key to something drawable.
 */
export interface FramePayload {
  time: number;
  songTime: number;
  isPaused: boolean;

  spectrum: Uint8Array;
  len: number;

  width: number;
  height: number;
  left: number;
  top: number;

  dimColor: string;
  /** Null when the style is None or is handled by an extension on the overlay. */
  styleId: string | null;

  dynLight: number;
  opacity: number;
  pulseEnabled: boolean;
  storedColor: string;
  isRainbow: boolean;
  isGlow: boolean;
  intensityMultiplier: number;
  power: number;

  progressBarTop: number;
  progressBarLeft: number;

  options: Record<string, any>;
  /** Maps a `songImage` option value to the key its loaded image is stored under. */
  imageKeys: Record<string, string>;
  logoKey: string | null;

  starRush: { intensity: number; visualizerIntensity: number } | null;
  rainfall: { frequency: number; speed: number; imageScale: number; imageKey: string | null; color: string } | null;
  /** Region the floating title needs punched out of the visualizer. */
  titleCutout: { x: number; y: number; width: number; height: number } | null;
}

export type ImageResolver = (key: string) => ReadyImage | null;

/**
 * The part of a frame that can run away from the main thread: the dim, the particles and the
 * built-in style. Shared verbatim between the worker and the main-thread fallback so both paths
 * cannot drift.
 */
export default class VisualizerLayer {
  private frame = new Frame();
  private starRush = new StarRush();
  private rainfall = new Rainfall();

  public clearParticles() {
    this.starRush.clear();
    this.rainfall.clear();
  }

  public render(ctx: Canvas2D, payload: FramePayload, resolveImage: ImageResolver) {
    ctx.clearRect(0, 0, payload.width, payload.height);

    ctx.fillStyle = payload.dimColor;
    ctx.fillRect(0, 0, payload.width, payload.height);

    const frame = this.frame;
    frame.ctx = ctx;
    frame.dataArray = payload.spectrum;
    frame.len = payload.len;
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
    frame.progressBarTop = payload.progressBarTop;
    frame.progressBarLeft = payload.progressBarLeft;
    frame.logo = payload.logoKey ? resolveImage(payload.logoKey) : null;
    frame.resolveOption = key => payload.options[key] ?? null;
    frame.resolveImage = name => {
      const key = payload.imageKeys[name];
      return key ? resolveImage(key) : null;
    };

    ctx.fillStyle = ctx.strokeStyle = payload.storedColor;

    const oldShadowBlur = ctx.shadowBlur;
    const oldShadowColor = ctx.shadowColor;
    if (payload.isGlow) ctx.shadowColor = payload.storedColor;

    if (!payload.isPaused) {
      if (payload.starRush) {
        this.starRush.update(ctx, payload.time, payload.width, payload.height, payload.spectrum, payload.len, payload.starRush);
      }
      if (payload.rainfall) {
        this.rainfall.update(ctx, payload.time, payload.width, payload.height, {
          frequency: payload.rainfall.frequency,
          speed: payload.rainfall.speed,
          imageScale: payload.rainfall.imageScale,
          image: payload.rainfall.imageKey ? resolveImage(payload.rainfall.imageKey) : null,
          color: payload.rainfall.color,
        });
      } else {
        this.rainfall.clear();
      }
    }

    if (payload.styleId) {
      (getBuiltInVisualizer(payload.styleId) ?? fallbackVisualizer).draw(frame);
    }

    ctx.shadowBlur = oldShadowBlur;
    ctx.shadowColor = oldShadowColor;

    // Punched out here rather than on the overlay: clearing the overlay cannot erase this layer.
    if (payload.titleCutout) {
      const { x, y, width, height } = payload.titleCutout;
      ctx.fillStyle = payload.dimColor;
      ctx.clearRect(x, y, width, height);
      ctx.fillRect(x, y, width, height);
    }
  }
}
