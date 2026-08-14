import { VisualizerRenderer } from "./types";

// x(t) = 16sin^3(t), y negated for canvas coordinates
const heartX = (t: number) => 16 * Math.pow(Math.sin(t), 3);
const heartY = (t: number) => -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
const HEART_Y_OFFSET = 6;

const HeartVisualizer: VisualizerRenderer = {
  id: "heart",
  name: "Heart",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, dynLight, opacity, pulseEnabled, storedColor, isRainbow, isGlow, getMaxHeight, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      opaque: getOption<boolean>("opaque") ?? false,
    };

    const maxHeight = getMaxHeight(0.25);
    const unitH = maxHeight / dataSize;
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    const baseScale = vsOptions.size > 0 ? (vsOptions.size / 16) : (Math.min(rSizeX, rSizeY) * 0.035);
    const scale = baseScale + (baseScale * (dynLight / 3));

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    let highest = 0;

    ctx.lineWidth = 3;
    ctx.globalAlpha = opacity;

    // Outward normal of the heart curve at t, used to point each bar away from the shape
    const barAt = (i: number) => {
      const t = (i / len) * Math.PI;
      const hx = heartX(t) * scale;
      const hy = (heartY(t) - HEART_Y_OFFSET) * scale;

      const dx = (heartX(t + 0.01) - heartX(t - 0.01)) * scale;
      const dy = ((heartY(t + 0.01)) - (heartY(t - 0.01))) * scale;
      const tangentLen = Math.sqrt(dx * dx + dy * dy);

      let nx: number, ny: number;
      if (tangentLen > 0.001) {
        nx = dy / tangentLen;
        ny = -dx / tangentLen;
        if (nx * hx + ny * hy < 0) { nx = -nx; ny = -ny; }
      } else {
        const radLen = Math.sqrt(hx * hx + hy * hy) || 1;
        nx = hx / radLen;
        ny = hy / radLen;
      }
      return { hx, hy, nx, ny };
    };

    if (!isRainbow) {
      if (isGlow) setBarShadowBlur(maxHeight * 0.4);

      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH);
        if (barHeight > highest) highest = barHeight;
        const { hx, hy, nx, ny } = barAt(i);

        ctx.moveTo(centerX + hx, centerY + hy);
        ctx.lineTo(centerX + hx + nx * barHeight, centerY + hy + ny * barHeight);

        ctx.moveTo(centerX - hx, centerY + hy);
        ctx.lineTo(centerX - hx - nx * barHeight, centerY + hy + ny * barHeight);
      }
      ctx.stroke();
    } else {
      const oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH);
        if (barHeight > highest) highest = barHeight;
        const { hx, hy, nx, ny } = barAt(i);

        const x1 = centerX + hx;
        const y1 = centerY + hy;
        setRainbowIfEnabled(ctx, x1, y1, barHeight, barHeight, i);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(centerX + hx + nx * barHeight, centerY + hy + ny * barHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX - hx, centerY + hy);
        ctx.lineTo(centerX - hx - nx * barHeight, centerY + hy + ny * barHeight);
        ctx.stroke();
      }
      ctx.shadowBlur = oldShadow;
    }

    ctx.globalAlpha = 1;

    if (vsOptions.opaque) {
      ctx.save();
      setBarShadowBlur(highest);
      ctx.beginPath();
      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * (2 * Math.PI);
        const px = centerX + heartX(t) * scale;
        const py = centerY + (heartY(t) - HEART_Y_OFFSET) * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = storedColor;
      ctx.fill();
      ctx.restore();
    }
  }
};

export default HeartVisualizer;
