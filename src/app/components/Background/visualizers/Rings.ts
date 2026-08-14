import { VisualizerRenderer } from "./types";

const SEGMENTS = 64;

const RingsVisualizer: VisualizerRenderer = {
  id: "rings",
  name: "Rings",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, isRainbow, isGlow, getOption }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
    };

    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const maxRadius = vsOptions.size > 0 ? vsOptions.size : (Math.min(rSizeX, rSizeY) * 0.85);
    const numRings = Math.min(len, 24);
    const radiusStep = maxRadius / numRings;
    const rotation = time * 0.0003;

    for (let i = 0; i < numRings; i++) {
      // Group bins per ring for a smoother response
      const binStart = Math.floor((i / numRings) * len);
      const binEnd = Math.floor(((i + 1) / numRings) * len);
      let sum = 0;
      for (let b = binStart; b < binEnd; b++) sum += dataArray[b];
      const amplitude = (sum / (binEnd - binStart)) / dataSize;

      const baseRadius = (i + 1) * radiusStep;
      const ringRadius = baseRadius + (amplitude * radiusStep * 1.5) + (baseRadius * dynLight * 0.1);

      if (isRainbow) {
        const hue = ((i / numRings) * 360 + time * 0.05) % 360;
        ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`;
      }

      if (isGlow) ctx.shadowBlur = amplitude * 20;

      ctx.globalAlpha = opacity * (0.25 + amplitude * 0.75);
      ctx.lineWidth = 1.5 + amplitude * 4;

      ctx.beginPath();
      for (let s = 0; s <= SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2 + rotation * (i % 2 === 0 ? 1 : -1);
        const deformIdx = Math.floor((s / SEGMENTS) * (binEnd - binStart)) + binStart;
        const deform = deformIdx < len ? (dataArray[deformIdx] / dataSize) * radiusStep * 0.3 : 0;
        const r = ringRadius + deform;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
};

export default RingsVisualizer;
