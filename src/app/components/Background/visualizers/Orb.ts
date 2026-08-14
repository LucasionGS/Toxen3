import { VisualizerRenderer } from "./types";

const OrbVisualizer: VisualizerRenderer = {
  id: "orb",
  name: "Orb",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, storedColor, isRainbow, isGlow, getMaxHeight, getImage, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      opaque: getOption<boolean>("opaque") ?? false,
      orbImage: getOption<string>("orbImage") ?? "",
    };

    const maxHeight = getMaxHeight(0.25);
    const unitAngle = (2 * Math.PI) / len;
    const unitH = maxHeight / dataSize;
    const rSizeX = vWidth / 2;
    const rSizeY = vHeight / 2;
    let centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    let centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;
    const radius = (vsOptions.size > 0 ? (
      vsOptions.size + (vsOptions.size * (dynLight / 4))
    ) : (
      (Math.min(rSizeX, rSizeY) * 0.45) + (Math.min(rSizeX, rSizeY) * 0.2) * dynLight
    ));

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    const rotation = Math.PI / 2 + ((time / 20000) * Math.PI);
    let highest = 0;

    ctx.lineWidth = 3;
    ctx.globalAlpha = opacity;

    // Batching all bars into one path matters for glow: shadow blur is rasterised once per
    // stroke() rather than once per bar.
    if (!isRainbow) {
      if (isGlow) setBarShadowBlur(maxHeight * 0.4);

      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH);
        if (barHeight > highest) highest = barHeight;

        const angle = i * unitAngle + rotation;
        const mirroredAngle = (-i - 1) * unitAngle + rotation;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const cosM = Math.cos(mirroredAngle);
        const sinM = Math.sin(mirroredAngle);

        ctx.moveTo(centerX + cosA * radius, centerY + sinA * radius);
        ctx.lineTo(centerX + cosA * (radius + barHeight), centerY + sinA * (radius + barHeight));

        ctx.moveTo(centerX + cosM * radius, centerY + sinM * radius);
        ctx.lineTo(centerX + cosM * (radius + barHeight), centerY + sinM * (radius + barHeight));
      }
      ctx.stroke();
    } else {
      const oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;
      for (let i = 0; i < len; i++) {
        const barHeight = Math.max(1, dataArray[i] * unitH);
        if (barHeight > highest) highest = barHeight;

        const angle = i * unitAngle + rotation;
        const mirroredAngle = (-i - 1) * unitAngle + rotation;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const cosM = Math.cos(mirroredAngle);
        const sinM = Math.sin(mirroredAngle);

        const x1 = centerX + cosA * radius;
        const y1 = centerY + sinA * radius;

        setRainbowIfEnabled(ctx, x1, y1, barHeight, barHeight, i);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(centerX + cosA * (radius + barHeight), centerY + sinA * (radius + barHeight));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + cosM * radius, centerY + sinM * radius);
        ctx.lineTo(centerX + cosM * (radius + barHeight), centerY + sinM * (radius + barHeight));
        ctx.stroke();
      }
      ctx.shadowBlur = oldShadow;
    }

    ctx.globalAlpha = 1;

    if (vsOptions.opaque) {
      ctx.save();
      setBarShadowBlur(highest);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.fillStyle = storedColor;
      ctx.fill();
      ctx.restore();
    }

    const orbImg = vsOptions.orbImage ? getImage(vsOptions.orbImage) : null;
    if (orbImg) {
      ctx.save();
      setBarShadowBlur(highest);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
      const d = radius * 2;
      // Centre-crop: largest centred square from the source image
      const srcSize = Math.min(orbImg.width, orbImg.height);
      const sx = (orbImg.width - srcSize) / 2;
      const sy = (orbImg.height - srcSize) / 2;
      ctx.drawImage(orbImg.source, sx, sy, srcSize, srcSize, centerX - radius, centerY - radius, d, d);
      ctx.restore();
    }
  }
};

export default OrbVisualizer;
