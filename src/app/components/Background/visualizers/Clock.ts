import { VisualizerRenderer } from "./types";

const ClockVisualizer: VisualizerRenderer = {
  id: "clock",
  name: "Clock",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, dynLight, opacity, pulseEnabled, isRainbow, isGlow, getMaxHeight, getImage, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      centerImage: getOption<string>("centerImage") ?? "",
    };

    const maxHeight = getMaxHeight(0.15);
    const unitH = maxHeight / dataSize;
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const baseRadius = vsOptions.size > 0 ? vsOptions.size : (Math.min(rSizeX, rSizeY) * 0.55);
    const clockRadius = baseRadius + (baseRadius * dynLight * 0.08);

    ctx.globalAlpha = opacity;

    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millis = now.getMilliseconds();

    const secondAngle = ((seconds + millis / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
    const minuteAngle = ((minutes + seconds / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;

    // Frequency bars around the rim
    if (isGlow) setBarShadowBlur(maxHeight * 0.3);

    if (!isRainbow) {
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH) * 0.4;
        const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        ctx.moveTo(centerX + cosA * clockRadius, centerY + sinA * clockRadius);
        ctx.lineTo(centerX + cosA * (clockRadius + barHeight), centerY + sinA * (clockRadius + barHeight));
      }
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH) * 0.4;
        const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        setRainbowIfEnabled(ctx, centerX + cosA * clockRadius, centerY + sinA * clockRadius, barHeight, barHeight, i);
        ctx.beginPath();
        ctx.moveTo(centerX + cosA * clockRadius, centerY + sinA * clockRadius);
        ctx.lineTo(centerX + cosA * (clockRadius + barHeight), centerY + sinA * (clockRadius + barHeight));
        ctx.stroke();
      }
      ctx.shadowBlur = oldShadow;
    }

    ctx.shadowBlur = 0;
    const oldAlpha = ctx.globalAlpha;

    const centerImg = vsOptions.centerImage ? getImage(vsOptions.centerImage) : null;
    if (centerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, clockRadius, 0, Math.PI * 2);
      ctx.clip();
      const d = clockRadius * 2;
      const srcSize = Math.min(centerImg.width, centerImg.height);
      const sx = (centerImg.width - srcSize) / 2;
      const sy = (centerImg.height - srcSize) / 2;
      ctx.drawImage(centerImg.source, sx, sy, srcSize, srcSize, centerX - clockRadius, centerY - clockRadius, d, d);
      ctx.restore();
    } else {
      ctx.globalAlpha = opacity * 0.15;
      ctx.beginPath();
      ctx.arc(centerX, centerY, clockRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = oldAlpha;

    ctx.globalAlpha = opacity * 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, clockRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = oldAlpha;

    // Hour markers and numbers
    ctx.lineWidth = 2.5;
    const fontSize = Math.max(12, clockRadius * 0.14);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const storedTextAlign = ctx.textAlign;
    const storedBaseline = ctx.textBaseline;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const innerTick = clockRadius * 0.88;
      const outerTick = clockRadius * 0.96;
      ctx.beginPath();
      ctx.moveTo(centerX + cosA * innerTick, centerY + sinA * innerTick);
      ctx.lineTo(centerX + cosA * outerTick, centerY + sinA * outerTick);
      ctx.stroke();

      const numRadius = clockRadius * 0.76;
      const num = i === 0 ? 12 : i;
      ctx.fillText(num.toString(), centerX + cosA * numRadius, centerY + sinA * numRadius);
    }

    ctx.textAlign = storedTextAlign;
    ctx.textBaseline = storedBaseline;

    ctx.lineWidth = 1;
    ctx.globalAlpha = opacity * 0.4;
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const innerTick = clockRadius * 0.93;
      const outerTick = clockRadius * 0.96;
      ctx.beginPath();
      ctx.moveTo(centerX + cosA * innerTick, centerY + sinA * innerTick);
      ctx.lineTo(centerX + cosA * outerTick, centerY + sinA * outerTick);
      ctx.stroke();
    }
    ctx.globalAlpha = oldAlpha;

    // Hands
    ctx.lineWidth = Math.max(4, clockRadius * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(hourAngle) * clockRadius * 0.5,
      centerY + Math.sin(hourAngle) * clockRadius * 0.5
    );
    ctx.stroke();

    ctx.lineWidth = Math.max(3, clockRadius * 0.025);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(minuteAngle) * clockRadius * 0.7,
      centerY + Math.sin(minuteAngle) * clockRadius * 0.7
    );
    ctx.stroke();

    ctx.globalAlpha = opacity * 0.8;
    ctx.lineWidth = Math.max(1.5, clockRadius * 0.012);
    ctx.beginPath();
    ctx.moveTo(
      centerX - Math.cos(secondAngle) * clockRadius * 0.12,
      centerY - Math.sin(secondAngle) * clockRadius * 0.12
    );
    ctx.lineTo(
      centerX + Math.cos(secondAngle) * clockRadius * 0.82,
      centerY + Math.sin(secondAngle) * clockRadius * 0.82
    );
    ctx.stroke();
    ctx.globalAlpha = oldAlpha;

    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(3, clockRadius * 0.03), 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  }
};

export default ClockVisualizer;
