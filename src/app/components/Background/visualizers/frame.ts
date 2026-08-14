import { Canvas2D, RainbowGradientEdges, ReadyImage, VisualizerFrame } from "./types";

/**
 * Mutable per-frame render state. A single instance is reused for the lifetime of the visualizer;
 * the host assigns the fields each frame rather than rebuilding the object and its helpers.
 */
export default class Frame implements VisualizerFrame {
  public ctx: Canvas2D = null;

  public dataArray: Uint8Array = new Uint8Array(0);
  public len = 0;
  public dataSize = 255;

  public vWidth = 0;
  public vHeight = 0;
  public vLeft = 0;
  public vTop = 0;

  public time = 0;
  public songTime = 0;
  public isPaused = false;

  public dynLight = 0;
  public opacity = 0.7;
  public pulseEnabled = false;

  public storedColor = "#ffffff";
  public isRainbow = false;
  public isGlow = false;
  public intensityMultiplier = 1;

  public progressBarTop = 0;
  public progressBarLeft = 0;

  public logo: ReadyImage | null = null;

  /**
   * Exponent term of the original height calculation. `^` is bitwise XOR rather than
   * exponentiation, so this only truncates to int32. Preserved deliberately; changing it would
   * resize every bar in the app.
   */
  public power = 1;

  public resolveImage: (name: string) => ReadyImage | null = () => null;
  public resolveOption: (key: string) => any = () => null;

  public getImage = (name: string): ReadyImage | null => this.resolveImage(name);

  public getOption = <T = any>(key: string): T => this.resolveOption(key);

  public getMaxHeight = (multiplier?: number): number =>
    (this.intensityMultiplier * this.vHeight * (multiplier ?? 1)) ^ this.power ^ this.power;

  public getMaxWidth = (multiplier?: number): number =>
    (this.intensityMultiplier * this.vWidth * (multiplier ?? 1)) ^ this.power ^ this.power;

  /**
   * A shadow only rasterises when the shadow colour is not fully transparent. The host sets an
   * opaque colour for glow, and setRainbow sets one per bar, so outside those two cases writing
   * shadowBlur costs the blur raster path for nothing.
   */
  private get shadowVisible() {
    return this.isGlow || this.isRainbow;
  }

  public setBarShadowBlur = (height: number) => {
    if (!this.shadowVisible) return;
    this.ctx.shadowBlur = height / 3;
  };

  public useAlpha = (alpha: number, callback: (ctx: Canvas2D) => void) => {
    const ctx = this.ctx;
    const oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    callback(ctx);
    ctx.globalAlpha = oldAlpha;
  };

  public setRainbowIfEnabled = (
    ctx: Canvas2D,
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    i: number,
    cycleIncrementer?: number,
    options?: RainbowGradientEdges,
  ) => {
    if (!this.isRainbow) return;
    this.setRainbow(ctx, barX, barY, barWidth, barHeight, i, cycleIncrementer, options);
  };

  private setRainbow(
    ctx: Canvas2D,
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    i: number,
    cycleIncrementer?: number,
    options?: RainbowGradientEdges,
  ) {
    const cycle = cycleIncrementer ?? (360 / this.len);
    const rainbowColor = `hsl(${cycle * i + (this.songTime * 50)}, 100%, 50%)`;

    ctx.shadowColor = rainbowColor;

    // A gradient with a single stop paints that colour everywhere, so it is the flat colour.
    // The degenerate case where both ends coincide paints nothing, so it keeps the gradient.
    if (!options && (barWidth !== 0 || barHeight !== 0)) {
      ctx.fillStyle = rainbowColor;
      ctx.strokeStyle = rainbowColor;
      return;
    }

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
}
