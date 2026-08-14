import { VisualizerRenderer } from "./types";

const ARMS = 2;
const TURNS = 3;
const BACKBONE_STEPS = 200;

const SpiralVisualizer: VisualizerRenderer = {
  id: "spiral",
  name: "Spiral",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, isRainbow, isGlow, getMaxHeight, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      rotationSpeed: getOption<number>("rotationSpeed") ?? 0.4,
      rotationDirection: getOption<string>("rotationDirection") ?? "clockwise",
    };

    const maxHeight = getMaxHeight(0.20);
    const unitH = maxHeight / dataSize;
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const baseMaxRadius = vsOptions.size > 0 ? vsOptions.size : (Math.min(rSizeX, rSizeY) * 0.75);
    const maxRadius = baseMaxRadius + (baseMaxRadius * dynLight * 0.15);
    const directionMultiplier = vsOptions.rotationDirection === "counter-clockwise" ? -1 : 1;
    const rotation = time * (vsOptions.rotationSpeed / 1000) * directionMultiplier;

    ctx.lineWidth = 3;
    ctx.globalAlpha = opacity;

    for (let arm = 0; arm < ARMS; arm++) {
      const armOffset = (arm / ARMS) * Math.PI * 2;

      if (!isRainbow) {
        if (isGlow) setBarShadowBlur(maxHeight * 0.3);

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const barHeight = Math.max(1, dataArray[i] * unitH) * 0.5;
          const t = i / len;
          const angle = t * TURNS * Math.PI * 2 + rotation + armOffset;
          const radius = t * maxRadius * 0.85 + maxRadius * 0.08;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          ctx.moveTo(centerX + cosA * radius, centerY + sinA * radius);
          ctx.lineTo(centerX + cosA * (radius + barHeight), centerY + sinA * (radius + barHeight));
        }
        ctx.stroke();

        const oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = opacity * 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= BACKBONE_STEPS; i++) {
          const t = i / BACKBONE_STEPS;
          const angle = t * TURNS * Math.PI * 2 + rotation + armOffset;
          const radius = t * maxRadius * 0.85 + maxRadius * 0.08;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = oldAlpha;
        ctx.lineWidth = 3;
      } else {
        const oldShadow = ctx.shadowBlur;
        ctx.shadowBlur = 0;

        for (let i = 0; i < len; i++) {
          const barHeight = Math.max(1, dataArray[i] * unitH) * 0.5;
          const t = i / len;
          const angle = t * TURNS * Math.PI * 2 + rotation + armOffset;
          const radius = t * maxRadius * 0.85 + maxRadius * 0.08;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          setRainbowIfEnabled(ctx, centerX + cosA * radius, centerY + sinA * radius, barHeight, barHeight, i);
          ctx.beginPath();
          ctx.moveTo(centerX + cosA * radius, centerY + sinA * radius);
          ctx.lineTo(centerX + cosA * (radius + barHeight), centerY + sinA * (radius + barHeight));
          ctx.stroke();
        }

        ctx.shadowBlur = oldShadow;
      }
    }

    ctx.globalAlpha = 1;
  }
};

export default SpiralVisualizer;
