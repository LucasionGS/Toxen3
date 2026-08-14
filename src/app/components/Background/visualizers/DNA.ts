import { VisualizerRenderer } from "./types";

const TURNS = 4;

const DNAVisualizer: VisualizerRenderer = {
  id: "dna",
  name: "DNA",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, isRainbow, isGlow, getMaxHeight, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      size: getOption<number>("size") ?? 0,
    };

    const maxHeight = getMaxHeight(0.20);
    const rSizeX = vWidth / 2;
    const centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;

    const baseAmplitude = vsOptions.size > 0 ? vsOptions.size : (vWidth * 0.12);
    const amplitude = baseAmplitude + (baseAmplitude * dynLight * 0.3);
    const scrollSpeed = time * 0.0005;
    const yStep = vHeight / len;

    ctx.globalAlpha = opacity;

    if (!isRainbow) {
      if (isGlow) setBarShadowBlur(maxHeight * 0.3);

      // Rungs
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const barIntensity = dataArray[i] / dataSize;
        if (barIntensity <= 0.08) continue;

        const y = i * yStep;
        const sinPhase = Math.sin((i / len) * Math.PI * TURNS + scrollSpeed);
        ctx.moveTo(centerX + sinPhase * amplitude, y);
        ctx.lineTo(centerX - sinPhase * amplitude, y);
      }
      ctx.stroke();

      // Strands
      ctx.lineWidth = 3;
      for (const phaseOffset of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const y = i * yStep;
          const phase = (i / len) * Math.PI * TURNS + scrollSpeed;
          const wobble = (dataArray[i] / dataSize) * amplitude * 0.15;
          const x = centerX + Math.sin(phase + phaseOffset) * (amplitude + wobble);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      const oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;

      ctx.lineWidth = 2;
      for (let i = 0; i < len; i++) {
        const barIntensity = dataArray[i] / dataSize;
        if (barIntensity <= 0.08) continue;

        const y = i * yStep;
        const phase = (i / len) * Math.PI * TURNS + scrollSpeed;
        const x1 = centerX + Math.sin(phase) * amplitude;
        const x2 = centerX - Math.sin(phase) * amplitude;
        setRainbowIfEnabled(ctx, x1, y, Math.abs(x2 - x1), 2, i);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      ctx.lineWidth = 3;
      for (let i = 1; i < len; i++) {
        const y0 = (i - 1) * yStep;
        const y1 = i * yStep;
        const phase0 = ((i - 1) / len) * Math.PI * TURNS + scrollSpeed;
        const phase1 = (i / len) * Math.PI * TURNS + scrollSpeed;
        const x0 = centerX + Math.sin(phase0) * amplitude;
        const x1 = centerX + Math.sin(phase1) * amplitude;

        setRainbowIfEnabled(ctx, x1, y1, 3, 3, i);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + Math.sin(phase0 + Math.PI) * amplitude, y0);
        ctx.lineTo(centerX + Math.sin(phase1 + Math.PI) * amplitude, y1);
        ctx.stroke();
      }

      ctx.shadowBlur = oldShadow;
    }

    ctx.globalAlpha = 1;
  }
};

export default DNAVisualizer;
