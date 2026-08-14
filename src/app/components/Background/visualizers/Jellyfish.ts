import { VisualizerRenderer } from "./types";

const TENTACLES = 9;
const TENTACLE_SEGMENTS = 30;
const RIM_DOTS = 16;

const JellyfishVisualizer: VisualizerRenderer = {
  id: "jellyfish",
  name: "Jellyfish",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, isRainbow, isGlow, getMaxHeight, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      swimming: getOption<boolean>("swimming") ?? false,
    };

    const maxHeight = getMaxHeight(0.15);
    const unitH = maxHeight / dataSize;
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    const baseSize = vsOptions.size > 0 ? vsOptions.size : (Math.min(rSizeX, rSizeY) * 0.5);

    // Swimming: layered sine drift with the bell facing the direction of travel
    let swimAngle = 0;
    if (vsOptions.swimming) {
      const t = time * 0.00008;
      const padX = baseSize * 1.3;
      const padY = baseSize * 1.6 + baseSize * 0.65;
      const rangeX = Math.max(0, (vWidth - padX * 2) / 2);
      const rangeY = Math.max(0, (vHeight - padY * 2) / 2);
      const freqX1 = 0.7, freqX2 = 1.83;
      const freqY1 = 0.53, freqY2 = 1.37;
      centerX = rSizeX + Math.sin(t * freqX1) * rangeX * 0.65 + Math.sin(t * freqX2) * rangeX * 0.35;
      centerY = rSizeY + Math.sin(t * freqY1) * rangeY * 0.6 + Math.sin(t * freqY2) * rangeY * 0.4;

      const vx = Math.cos(t * freqX1) * freqX1 * rangeX * 0.65 + Math.cos(t * freqX2) * freqX2 * rangeX * 0.35;
      const vy = Math.cos(t * freqY1) * freqY1 * rangeY * 0.6 + Math.cos(t * freqY2) * freqY2 * rangeY * 0.4;
      swimAngle = Math.atan2(vy, vx) + Math.PI / 2;
    }

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const pulseScale = 1 + dynLight * 0.12;
    const bw = baseSize * pulseScale;
    const bh = baseSize * 0.65 * pulseScale;

    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";

    if (vsOptions.swimming && swimAngle !== 0) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(swimAngle);
      ctx.translate(-centerX, -centerY);
    }

    const bellSegments = Math.min(len, 128);

    if (isGlow) setBarShadowBlur(maxHeight * 0.25);

    const oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = opacity * 0.12;
    ctx.beginPath();
    ctx.moveTo(centerX - bw, centerY);
    for (let i = 0; i <= bellSegments; i++) {
      const t = i / bellSegments;
      const angle = t * Math.PI;
      const baseX = centerX - bw * Math.cos(angle);
      const baseY = centerY - bh * Math.sin(angle);

      const dataIdx = Math.min(Math.floor(t * len), len - 1);
      const bump = (dataArray[dataIdx] * unitH) * 0.2;
      const fy = baseY + (-Math.sin(angle)) * bump;

      if (i === 0) ctx.moveTo(baseX, fy);
      else ctx.lineTo(baseX, fy);
    }
    ctx.lineTo(centerX + bw, centerY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = oldAlpha;

    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= bellSegments; i++) {
      const t = i / bellSegments;
      const angle = t * Math.PI;
      const baseX = centerX - bw * Math.cos(angle);
      const baseY = centerY - bh * Math.sin(angle);

      const dataIdx = Math.min(Math.floor(t * len), len - 1);
      const bump = (dataArray[dataIdx] * unitH) * 0.25;
      const fy = baseY + (-Math.sin(angle)) * bump;

      if (i === 0) ctx.moveTo(baseX, fy);
      else ctx.lineTo(baseX, fy);
    }
    ctx.stroke();

    // Inner bell ridges
    ctx.globalAlpha = opacity * 0.2;
    ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      const ridgeScale = 0.4 + r * 0.2;
      ctx.beginPath();
      for (let i = 0; i <= bellSegments; i++) {
        const t = i / bellSegments;
        const angle = t * Math.PI;
        const rx = centerX - bw * ridgeScale * Math.cos(angle);
        const ry = centerY - bh * ridgeScale * Math.sin(angle);
        const dataIdx = Math.min(Math.floor(t * len), len - 1);
        const bump = (dataArray[dataIdx] * unitH) * 0.1 * ridgeScale;
        const y = ry + (-Math.sin(angle)) * bump;
        if (i === 0) ctx.moveTo(rx, y);
        else ctx.lineTo(rx, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = oldAlpha;

    const tentacleMaxLen = baseSize * 1.6;
    const tentacleSpread = bw * 1.6;

    ctx.lineWidth = 2;

    for (let t = 0; t < TENTACLES; t++) {
      const tNorm = t / (TENTACLES - 1);
      const anchorX = centerX + (tNorm - 0.5) * tentacleSpread;
      const anchorY = centerY + bh * 0.05;

      const dataStart = Math.floor((t / TENTACLES) * len);
      const dataEnd = Math.floor(((t + 1) / TENTACLES) * len);

      const centerFactor = 1 - Math.abs(tNorm - 0.5) * 1.2;
      const tLen = tentacleMaxLen * (0.5 + centerFactor * 0.5);

      let avgFreq = 0;
      for (let i = dataStart; i < dataEnd; i++) avgFreq += dataArray[i];
      avgFreq /= Math.max(1, dataEnd - dataStart);
      const freqIntensity = avgFreq / dataSize;

      if (isRainbow) {
        setRainbowIfEnabled(ctx, anchorX, anchorY, tLen, tLen, t * (len / TENTACLES));
      }

      ctx.globalAlpha = opacity * (0.5 + centerFactor * 0.3);
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);

      for (let s = 1; s <= TENTACLE_SEGMENTS; s++) {
        const sNorm = s / TENTACLE_SEGMENTS;
        const segY = anchorY + sNorm * tLen;
        const waveFreq = 2.5 + t * 0.3;
        const waveAmp = (10 + freqIntensity * 40) * sNorm;
        const phaseOffset = t * 0.7 + time * 0.002;
        ctx.lineTo(anchorX + Math.sin(sNorm * Math.PI * waveFreq + phaseOffset) * waveAmp, segY);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = oldAlpha;

    ctx.globalAlpha = opacity * 0.6;
    for (let i = 0; i < RIM_DOTS; i++) {
      const t = (i + 0.5) / RIM_DOTS;
      const angle = t * Math.PI;
      const dx = centerX - bw * Math.cos(angle);
      const dy = centerY - bh * 0.08 * Math.sin(angle);
      const dataIdx = Math.min(Math.floor(t * len), len - 1);
      const dotSize = 1.5 + (dataArray[dataIdx] / dataSize) * 3;
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    if (vsOptions.swimming && swimAngle !== 0) {
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  }
};

export default JellyfishVisualizer;
