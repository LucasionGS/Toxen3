import { Canvas2D } from "../types";

interface StarRushParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  opacity: number;
  acceleration: number;
}

export interface StarRushOptions {
  intensity: number;
  visualizerIntensity: number;
}

/** Sprite radius in its own pixels. Particles are 1-5px, so this always scales down. */
const SPRITE_RADIUS = 64;

let particleSprite: OffscreenCanvas | null | undefined;

/**
 * The halo is the same image at every size, so it is rendered once and scaled per particle
 * instead of building a radial gradient and two arcs for each one, every frame.
 */
function getParticleSprite(): OffscreenCanvas | null {
  if (particleSprite !== undefined) return particleSprite;

  if (typeof OffscreenCanvas === "undefined") {
    particleSprite = null;
    return null;
  }

  const size = SPRITE_RADIUS * 2;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(SPRITE_RADIUS, SPRITE_RADIUS, 0, SPRITE_RADIUS, SPRITE_RADIUS, SPRITE_RADIUS);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(SPRITE_RADIUS, SPRITE_RADIUS, SPRITE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(SPRITE_RADIUS, SPRITE_RADIUS, SPRITE_RADIUS * 0.3, 0, Math.PI * 2);
  ctx.fill();

  particleSprite = canvas;
  return canvas;
}

/**
 * Particles spawned from the centre of the screen, spawning faster and travelling further as the
 * audio gets louder.
 */
export default class StarRush {
  private particles: StarRushParticle[] = [];
  private lastSpawn = 0;

  public clear() {
    this.particles.length = 0;
  }

  public update(ctx: Canvas2D, time: number, vWidth: number, vHeight: number, dataArray: Uint8Array, len: number, options: StarRushOptions) {
    const centerX = vWidth / 2;
    const centerY = vHeight / 2;

    let total = 0;
    for (let i = 0; i < len; i++) total += dataArray[i];
    const audioIntensity = ((total / len) / 255) * options.intensity;

    const spawnRate = Math.max(16, 100 - (audioIntensity * 80));
    if (time - this.lastSpawn > spawnRate) {
      const particlesToSpawn = Math.floor(1 + audioIntensity * 3);
      for (let i = 0; i < particlesToSpawn; i++) {
        this.spawn(centerX, centerY, audioIntensity, options.visualizerIntensity);
      }
      this.lastSpawn = time;
    }

    // Swap-and-pop so removal stays O(1) per particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      this.advance(particle, vWidth, vHeight, options.visualizerIntensity);

      if (particle.age >= particle.maxAge
        || particle.x < -50 || particle.x > vWidth + 50
        || particle.y < -50 || particle.y > vHeight + 50) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    this.render(ctx);
  }

  private spawn(centerX: number, centerY: number, audioIntensity: number, visualizerIntensity: number) {
    const angle = Math.random() * Math.PI * 2;
    const baseSpeed = 0.5 + Math.random() * 1.5;
    const initialSpeed = baseSpeed * (0.5 + (visualizerIntensity * 0.5));
    const offsetDistance = 20 + Math.random() * 30;

    this.particles.push({
      x: centerX + Math.cos(angle) * offsetDistance,
      y: centerY + Math.sin(angle) * offsetDistance,
      vx: Math.cos(angle) * initialSpeed,
      vy: Math.sin(angle) * initialSpeed,
      age: 0,
      maxAge: 3000 + Math.random() * 2000,
      size: 1 + Math.random() * 2 + (audioIntensity * 2),
      opacity: 0.8 + Math.random() * 0.2,
      acceleration: 1.002 + audioIntensity * 0.003 + visualizerIntensity * 0.001,
    });
  }

  private advance(particle: StarRushParticle, vWidth: number, vHeight: number, visualizerIntensity: number) {
    particle.age += 16;

    const dx = particle.x - (vWidth / 2);
    const dy = particle.y - (vHeight / 2);
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    const accelerationMultiplier = (1 + (distanceFromCenter * 0.00005)) * (1 + (visualizerIntensity * 0.002));

    particle.vx *= particle.acceleration * accelerationMultiplier;
    particle.vy *= particle.acceleration * accelerationMultiplier;

    particle.x += particle.vx;
    particle.y += particle.vy;

    particle.opacity = Math.max(0, 0.8 * (1 - (particle.age / particle.maxAge)));
  }

  private render(ctx: Canvas2D) {
    const sprite = getParticleSprite();
    ctx.save();

    if (sprite) {
      for (const particle of this.particles) {
        if (particle.opacity <= 0) continue;
        ctx.globalAlpha = particle.opacity;
        const d = particle.size * 2;
        ctx.drawImage(sprite, particle.x - particle.size, particle.y - particle.size, d, d);
      }
      ctx.restore();
      return;
    }

    for (const particle of this.particles) {
      if (particle.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = particle.opacity;

      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.size
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}
