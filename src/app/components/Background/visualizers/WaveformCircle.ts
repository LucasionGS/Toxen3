import { ensureScratch } from "./scratch";
import { VisualizerRenderer } from "./types";

let smoothedData: Float64Array = null;
let waveX: Float64Array = null;
let waveY: Float64Array = null;
let waveAmplitude: Float64Array = null;

const WaveformCircleVisualizer: VisualizerRenderer = {
  id: "waveformcircle",
  name: "WaveformCircle",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, storedColor, isRainbow, isGlow, getMaxHeight, getImage, getOption, useAlpha }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      smoothing: getOption<number>("smoothing") ?? 0.7,
      thickness: getOption<number>("thickness") ?? 3,
      centerImage: getOption<string>("centerImage") ?? "",
    };

    const maxHeight = getMaxHeight(0.4);
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;
    const baseRadius = (vsOptions.size > 0 ? (
      vsOptions.size + (vsOptions.size * (dynLight / 4))
    ) : (
      (Math.min(rSizeX, rSizeY) * 0.3) + (Math.min(rSizeX, rSizeY) * 0.15) * dynLight
    ));

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const rotation = Math.PI / 2 + ((time / 30000) * Math.PI);

    smoothedData = ensureScratch(smoothedData, len);
    waveX = ensureScratch(waveX, len);
    waveY = ensureScratch(waveY, len);
    waveAmplitude = ensureScratch(waveAmplitude, len);

    for (let i = 0; i < len; i++) {
      let smoothedValue = dataArray[i];
      if (vsOptions.smoothing > 0 && i > 0 && i < len - 1) {
        const prev = dataArray[i - 1];
        const next = dataArray[i + 1];
        smoothedValue = dataArray[i] * (1 - vsOptions.smoothing) + (prev + next) * vsOptions.smoothing / 2;
      }
      smoothedData[i] = smoothedValue;
    }

    const unitAngle = (2 * Math.PI) / len;
    const unitH = maxHeight / dataSize;

    for (let i = 0; i < len; i++) {
      const amplitude = Math.max(1, smoothedData[i] * unitH);
      const angle = i * unitAngle + rotation;
      const waveMotion = Math.sin(time * 0.0008 + i * 0.1) * (amplitude * 0.1);
      const dynamicRadius = baseRadius + amplitude + waveMotion;
      waveX[i] = centerX + Math.cos(angle) * dynamicRadius;
      waveY[i] = centerY + Math.sin(angle) * dynamicRadius;
      waveAmplitude[i] = amplitude;
    }

    if (isGlow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = storedColor;
    }

    if (isRainbow) {
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, baseRadius + maxHeight);
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const hue = (i / steps * 360 + time * 0.05) % 360;
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
      ctx.lineWidth = vsOptions.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(waveX[0], waveY[0]);
      for (let i = 1; i < len; i++) {
        const controlAngle = (i * (2 * Math.PI) / len + rotation) - (Math.PI / len);
        const controlRadius = baseRadius + (waveAmplitude[i - 1] + waveAmplitude[i]) / 2;
        ctx.quadraticCurveTo(
          centerX + Math.cos(controlAngle) * controlRadius,
          centerY + Math.sin(controlAngle) * controlRadius,
          waveX[i],
          waveY[i]
        );
      }

      const closingControlAngle = rotation - (Math.PI / len);
      const closingControlRadius = baseRadius + (waveAmplitude[len - 1] + waveAmplitude[0]) / 2;
      ctx.quadraticCurveTo(
        centerX + Math.cos(closingControlAngle) * closingControlRadius,
        centerY + Math.sin(closingControlAngle) * closingControlRadius,
        waveX[0],
        waveY[0]
      );
      ctx.closePath();
      ctx.stroke();

      // Filled band between the base circle and the waveform
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2, false);
      ctx.moveTo(waveX[0], waveY[0]);
      for (let i = len - 1; i > 0; i--) {
        const controlAngle = (i * (2 * Math.PI) / len + rotation) - (Math.PI / len);
        const controlRadius = baseRadius + (waveAmplitude[i] + waveAmplitude[i - 1]) / 2;
        ctx.quadraticCurveTo(
          centerX + Math.cos(controlAngle) * controlRadius,
          centerY + Math.sin(controlAngle) * controlRadius,
          waveX[i - 1],
          waveY[i - 1]
        );
      }
      ctx.closePath();

      const currentAlpha = ctx.globalAlpha;
      ctx.globalAlpha = currentAlpha * 0.2;
      ctx.fill();
      ctx.globalAlpha = currentAlpha;

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.1, 0, Math.PI * 2);
      ctx.globalAlpha = currentAlpha * 0.5;
      ctx.fill();
      ctx.globalAlpha = currentAlpha;

      ctx.restore();
    });

    const centerImg = vsOptions.centerImage ? getImage(vsOptions.centerImage) : null;
    if (centerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.clip();
      const d = baseRadius * 2;
      const srcSize = Math.min(centerImg.width, centerImg.height);
      const sx = (centerImg.width - srcSize) / 2;
      const sy = (centerImg.height - srcSize) / 2;
      ctx.drawImage(centerImg.source, sx, sy, srcSize, srcSize, centerX - baseRadius, centerY - baseRadius, d, d);
      ctx.restore();
    }
  }
};

export default WaveformCircleVisualizer;
