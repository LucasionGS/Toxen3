import { ensureScratch } from "./scratch";
import { VisualizerRenderer } from "./types";

let waveX: Float64Array = null;
let waveY: Float64Array = null;

const WaveformVisualizer: VisualizerRenderer = {
  id: "waveform",
  name: "Waveform",
  draw({ ctx, dataArray, len, vWidth, vHeight, time, opacity, storedColor, isGlow, isRainbow, getMaxHeight, getOption, useAlpha }) {
    const y = getOption<number>("y") ?? 50;
    const maxHeight = getMaxHeight(0.25);
    const centerY = typeof y === "number" && y > -0.1 ? (vHeight / 100 * y) : (vHeight / 2);
    const stepX = vWidth / (len - 1);

    waveX = ensureScratch(waveX, len);
    waveY = ensureScratch(waveY, len);

    for (let i = 0; i < len; i++) {
      const rawAmplitude = (dataArray[i] / 255) * maxHeight;

      let smoothedAmplitude = rawAmplitude;
      if (i > 0 && i < len - 1) {
        const prevAmplitude = (dataArray[i - 1] / 255) * maxHeight;
        const nextAmplitude = (dataArray[i + 1] / 255) * maxHeight;
        smoothedAmplitude = (prevAmplitude + rawAmplitude + nextAmplitude) / 3;
      }

      const waveMotion = Math.sin(time * 0.001 + i * 0.15) * 3;
      const amplitude = smoothedAmplitude * Math.sin(i * 0.2 + time * 0.002);
      waveX[i] = i * stepX;
      waveY[i] = centerY + waveMotion + amplitude;
    }

    if (isGlow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = storedColor;
    }

    if (isRainbow) {
      const gradient = ctx.createLinearGradient(0, 0, vWidth, 0);
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const hue = (i / steps * 360 + time * 0.1) % 360;
        gradient.addColorStop(i / steps, `hsl(${hue}, 70%, 60%)`);
      }
      ctx.strokeStyle = gradient;
      ctx.fillStyle = gradient;
    } else {
      ctx.strokeStyle = storedColor;
      ctx.fillStyle = storedColor;
    }

    useAlpha(opacity, ctx => {
      ctx.save();

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const traceWave = () => {
        for (let i = 1; i < len - 1; i++) {
          ctx.quadraticCurveTo(waveX[i], waveY[i], (waveX[i] + waveX[i + 1]) / 2, (waveY[i] + waveY[i + 1]) / 2);
        }
      };

      const lastX = waveX[len - 1];
      const lastY = waveY[len - 1];

      ctx.moveTo(waveX[0], waveY[0]);
      traceWave();
      ctx.lineTo(lastX, lastY);
      ctx.stroke();

      // Filled area between the wave and the centre line
      ctx.beginPath();
      ctx.moveTo(waveX[0], centerY);
      ctx.lineTo(waveX[0], waveY[0]);
      traceWave();
      ctx.lineTo(lastX, lastY);
      ctx.lineTo(lastX, centerY);
      ctx.closePath();

      const currentAlpha = ctx.globalAlpha;
      ctx.globalAlpha = currentAlpha * 0.3;
      ctx.fill();
      ctx.globalAlpha = currentAlpha;

      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);

      for (let h = 0; h < 2; h++) {
        const harmonicOffset = (h + 1) * 30;
        ctx.beginPath();
        ctx.moveTo(0, centerY + harmonicOffset);

        for (let i = 0; i < len; i++) {
          let rawAmplitude = (dataArray[i] / 255) * 12 * (1 - h * 0.4);
          if (i > 0 && i < len - 1) {
            const prevAmp = (dataArray[i - 1] / 255) * 12 * (1 - h * 0.4);
            const nextAmp = (dataArray[i + 1] / 255) * 12 * (1 - h * 0.4);
            rawAmplitude = (prevAmp + rawAmplitude + nextAmp) / 3;
          }

          const x = i * stepX;
          const y = centerY + harmonicOffset + rawAmplitude * Math.sin(i * 0.4 + time * 0.003 + h);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.globalAlpha = currentAlpha * 0.3 * (1 - h * 0.2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, centerY - harmonicOffset);

        for (let i = 0; i < len; i++) {
          let rawAmplitude = (dataArray[i] / 255) * 12 * (1 - h * 0.4);
          if (i > 0 && i < len - 1) {
            const prevAmp = (dataArray[i - 1] / 255) * 12 * (1 - h * 0.4);
            const nextAmp = (dataArray[i + 1] / 255) * 12 * (1 - h * 0.4);
            rawAmplitude = (prevAmp + rawAmplitude + nextAmp) / 3;
          }

          const x = i * stepX;
          const y = centerY - harmonicOffset - rawAmplitude * Math.sin(i * 0.4 + time * 0.003 + h);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
      }

      ctx.globalAlpha = currentAlpha;
      ctx.setLineDash([]);
      ctx.restore();
    });
  }
};

export default WaveformVisualizer;
