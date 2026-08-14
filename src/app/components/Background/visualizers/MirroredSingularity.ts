import { drawCenterLogo } from "./logo";
import { VisualizerFrame, VisualizerRenderer } from "./types";

function draw(frame: VisualizerFrame, useLogo: boolean) {
  const { ctx, dataArray, dataSize, vWidth, vHeight, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled } = frame;

  const newData = dataArray.filter(d => d > 0);
  const len = newData.length;
  const cycleIncrementer = 180 / len;
  const maxHeight = getMaxHeight(0.50);
  let smallestHeight = 0;
  const unitH = maxHeight / dataSize;
  const unitW = (vWidth * 1.25 + unitH) / len;

  const barX = (vWidth / 2) - (unitW / 2);
  const barY = (vHeight / 2);
  const halfWidth = -(unitW / 2);
  const angleStep = cycleIncrementer * (Math.PI / 180);

  // Mirrored pairs overlap at alpha < 1, so each stays its own fill. Only the per-bar
  // save/restore and alpha writes are hoisted out.
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = opacity;

  for (let i = 0; i < len; i++) {
    const barHeight = (newData[i] * unitH);
    smallestHeight += barHeight;

    setBarShadowBlur(barHeight);
    setRainbowIfEnabled(ctx, barX, barY, unitW, barHeight, i, cycleIncrementer);

    ctx.setTransform(1, 0, 0, 1, barX, barY);
    ctx.rotate(angleStep * i);
    ctx.fillRect(halfWidth, 0, unitW, barHeight);

    ctx.setTransform(1, 0, 0, 1, barX, barY);
    ctx.rotate(0 - (angleStep * i));
    ctx.fillRect(halfWidth, 0, unitW, barHeight);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = oldAlpha;

  if (useLogo) {
    smallestHeight /= len;
    smallestHeight *= 1.5;
    drawCenterLogo(frame, smallestHeight);
  }
}

export const MirroredSingularityVisualizer: VisualizerRenderer = {
  id: "mirroredsingularity",
  name: "MirroredSingularity",
  draw: frame => draw(frame, false),
};

export const MirroredSingularityWithLogoVisualizer: VisualizerRenderer = {
  id: "mirroredsingularitywithlogo",
  name: "MirroredSingularityWithLogo",
  draw: frame => draw(frame, true),
};
