import { ensureScratch } from "./scratch";
import { Canvas2D, VisualizerRenderer } from "./types";

const SMOOTHING_PASSES = 3;
const SMOOTHING_WINDOW = 5;

/** Parallel x/y/height arrays for one curve, reused across frames. */
interface Curve {
  x: Float64Array;
  y: Float64Array;
  h: Float64Array;
}

const curve: Curve = { x: null, y: null, h: null };
const mirror: Curve = { x: null, y: null, h: null };
let smoothed: Float64Array = null;
let smoothingScratch: Float64Array = null;

function ensureCurve(target: Curve, size: number) {
  target.x = ensureScratch(target.x, size);
  target.y = ensureScratch(target.y, size);
  target.h = ensureScratch(target.h, size);
}

/**
 * Appends a closed smooth curve as a subpath without calling beginPath. `reverse` walks the
 * points backwards so two curves can be clipped as a single shape.
 */
function appendSmoothCurve(ctx: Canvas2D, pts: Curve, n: number, reverse = false) {
  if (n < 2) return;
  const at = (i: number) => (reverse ? n - 1 - i : i);

  const last = at(n - 1);
  const first = at(0);
  ctx.moveTo(
    (pts.x[last] + pts.x[first]) / 2,
    (pts.y[last] + pts.y[first]) / 2
  );
  for (let i = 0; i < n; i++) {
    const curr = at(i);
    const next = at((i + 1) % n);
    ctx.quadraticCurveTo(pts.x[curr], pts.y[curr], (pts.x[curr] + pts.x[next]) / 2, (pts.y[curr] + pts.y[next]) / 2);
  }
  ctx.closePath();
}

const FluidOrbVisualizer: VisualizerRenderer = {
  id: "fluidorb",
  name: "FluidOrb",
  draw({ ctx, dataArray, len, dataSize, vWidth, vHeight, time, dynLight, opacity, pulseEnabled, storedColor, isRainbow, isGlow, getMaxHeight, getImage, getOption, setBarShadowBlur, setRainbowIfEnabled }) {
    const vsOptions = {
      x: getOption<number>("x") ?? 50,
      y: getOption<number>("y") ?? 50,
      size: getOption<number>("size") ?? 0,
      speed: getOption<number>("speed") ?? 1,
      opaque: getOption<boolean>("opaque") ?? false,
      orbImage: getOption<string>("orbImage") ?? "",
    };

    const maxHeight = getMaxHeight(0.3);
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

    const rotation = Math.PI / 2 + Math.PI + ((time / 20000) * Math.PI * vsOptions.speed);
    let highest = 0;
    ctx.globalAlpha = opacity;

    smoothed = ensureScratch(smoothed, len);
    smoothingScratch = ensureScratch(smoothingScratch, len);
    ensureCurve(curve, len);
    ensureCurve(mirror, len);

    for (let i = 0; i < len; i++) {
      smoothed[i] = Math.max(1, dataArray[i] * unitH);
    }

    // Triangle-weighted circular moving average, ping-ponging between two buffers
    let source = smoothed;
    let target = smoothingScratch;
    for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
      for (let i = 0; i < len; i++) {
        let sum = 0;
        let weight = 0;
        for (let j = -SMOOTHING_WINDOW; j <= SMOOTHING_WINDOW; j++) {
          const idx = (i + j + len) % len;
          const wt = 1 - Math.abs(j) / (SMOOTHING_WINDOW + 1);
          sum += source[idx] * wt;
          weight += wt;
        }
        target[i] = sum / weight;
      }
      const swap = source;
      source = target;
      target = swap;
    }

    for (let i = 0; i < len; i++) {
      const barHeight = source[i];
      if (barHeight > highest) highest = barHeight;
      const r = radius + barHeight;

      const angle = i * unitAngle + rotation;
      curve.x[i] = centerX + Math.cos(angle) * r;
      curve.y[i] = centerY + Math.sin(angle) * r;
      curve.h[i] = barHeight;

      const mirroredAngle = (-i - 1) * unitAngle + rotation;
      mirror.x[i] = centerX + Math.cos(mirroredAngle) * r;
      mirror.y[i] = centerY + Math.sin(mirroredAngle) * r;
      mirror.h[i] = barHeight;
    }

    const drawSmoothCurve = (pts: Curve) => {
      if (len < 2) return;
      ctx.beginPath();
      appendSmoothCurve(ctx, pts, len);
    };

    if (!isRainbow) {
      ctx.lineWidth = 3;
      if (isGlow) setBarShadowBlur(maxHeight * 0.5);

      drawSmoothCurve(curve);
      ctx.strokeStyle = storedColor;
      ctx.stroke();
      ctx.fillStyle = storedColor.replace("rgb(", "rgba(").replace(")", ", 0.12)");
      ctx.fill();

      drawSmoothCurve(mirror);
      ctx.stroke();
      ctx.fill();
    } else {
      ctx.lineWidth = 3;
      const oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;

      const strokeSegments = (pts: Curve) => {
        for (let i = 0; i < len; i++) {
          const next = (i + 1) % len;
          const prev = i === 0 ? len - 1 : i - 1;
          setRainbowIfEnabled(ctx, pts.x[i], pts.y[i], pts.h[i], pts.h[i], i);
          ctx.beginPath();
          ctx.moveTo((pts.x[prev] + pts.x[i]) / 2, (pts.y[prev] + pts.y[i]) / 2);
          ctx.quadraticCurveTo(pts.x[i], pts.y[i], (pts.x[i] + pts.x[next]) / 2, (pts.y[i] + pts.y[next]) / 2);
          ctx.stroke();
        }
      };

      strokeSegments(curve);
      strokeSegments(mirror);
      ctx.shadowBlur = oldShadow;
    }

    ctx.globalAlpha = 1;

    if (vsOptions.opaque) {
      ctx.save();
      setBarShadowBlur(highest);
      drawSmoothCurve(curve);
      ctx.fillStyle = storedColor;
      ctx.fill();
      drawSmoothCurve(mirror);
      ctx.fill();
      ctx.restore();
    }

    const orbImg = vsOptions.orbImage ? getImage(vsOptions.orbImage) : null;
    if (orbImg) {
      ctx.save();
      setBarShadowBlur(highest);
      // Reverse the mirror so both curves wind the same direction and clip as one shape
      ctx.beginPath();
      appendSmoothCurve(ctx, curve, len);
      appendSmoothCurve(ctx, mirror, len, true);
      ctx.clip();
      const extent = radius + highest;
      const d = extent * 2;
      const srcSize = Math.min(orbImg.width, orbImg.height);
      const sx = (orbImg.width - srcSize) / 2;
      const sy = (orbImg.height - srcSize) / 2;
      ctx.drawImage(orbImg.source, sx, sy, srcSize, srcSize, centerX - extent, centerY - extent, d, d);
      ctx.restore();
    }
  }
};

export default FluidOrbVisualizer;
