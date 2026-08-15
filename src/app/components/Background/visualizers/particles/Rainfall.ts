import { Canvas2D, ReadyImage } from "../types";

interface RainfallParticle {
  x: number;
  y: number;
  vy: number;
  length: number;
  size: number;
  opacity: number;
}

/** Colour of the default drops when nothing else is configured. */
export const DEFAULT_RAINFALL_COLOR = "#c8dcff";

/** Drops are drawn slightly translucent on top of their own per-particle opacity. */
const DROP_ALPHA = 0.8;

export interface RainfallOptions {
  frequency: number;
  speed: number;
  image: ReadyImage | null;
  imageScale: number;
  color: string;
}

export default class Rainfall {
  private particles: RainfallParticle[] = [];
  private lastSpawn = 0;

  public clear() {
    this.particles.length = 0;
  }

  public update(ctx: Canvas2D, time: number, vWidth: number, vHeight: number, options: RainfallOptions) {
    const frequency = Math.max(0.1, options.frequency);
    const speed = Math.max(0.1, options.speed);
    const imageScale = Math.max(0.1, options.imageScale);

    // Higher frequency means a shorter interval and more drops per batch
    const spawnInterval = Math.max(8, 60 / frequency);
    if (time - this.lastSpawn > spawnInterval) {
      const dropsToSpawn = Math.max(1, Math.round(frequency));
      for (let i = 0; i < dropsToSpawn; i++) this.spawn(vWidth);
      this.lastSpawn = time;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.vy * speed;
      if (p.y - p.length > vHeight + 20) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    this.render(ctx, options.image, imageScale, options.color || DEFAULT_RAINFALL_COLOR);
  }

  private spawn(vWidth: number) {
    this.particles.push({
      x: Math.random() * vWidth,
      y: -(Math.random() * 40) - 10,
      vy: 4 + Math.random() * 4,
      length: 8 + Math.random() * 12,
      size: 1 + Math.random() * 1.5,
      opacity: 0.4 + Math.random() * 0.4,
    });
  }

  private render(ctx: Canvas2D, image: ReadyImage | null, imageScale: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;

    for (const p of this.particles) {
      if (p.opacity <= 0) continue;
      ctx.globalAlpha = p.opacity;

      if (image) {
        // Reference size so drops are not microscopic
        const width = (p.size * 8) * imageScale;
        const aspect = image.height > 0 ? image.width / image.height : 1;
        const height = aspect > 0 ? width / aspect : width;
        ctx.drawImage(image.source, p.x - width / 2, p.y - height / 2, width, height);
      } else {
        ctx.globalAlpha = p.opacity * DROP_ALPHA;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.length);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
