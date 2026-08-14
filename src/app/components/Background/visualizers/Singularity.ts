import { drawCenterLogo } from "./logo";
import { VisualizerFrame, VisualizerRenderer } from "./types";

function draw(frame: VisualizerFrame, useLogo: boolean) {
  const { ctx, dataArray, len, dataSize, vWidth, vHeight, time, opacity, getMaxHeight, setBarShadowBlur, setRainbowIfEnabled } = frame;

  const cycleIncrementer = 360 / len;
  const maxHeight = getMaxHeight(0.50);
  let smallestHeight = 0;
  const unitH = maxHeight / dataSize;
  const unitW = (vWidth * 1.25 + unitH) / len;

  const barX = (vWidth / 2) - (unitW / 2);
  const barY = (vHeight / 2);
  const halfWidth = -(unitW / 2);

  // Bars radiate from a shared origin and overlap, so at alpha < 1 each has to be its own fill.
  // What can go is the per-bar save/restore and alpha write: setTransform replaces the transform
  // outright, so one reset at the end is enough.
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = opacity;

  for (let i = 0; i < len; i++) {
    const barHeight = (dataArray[i] * unitH);
    smallestHeight += barHeight;

    setBarShadowBlur(barHeight);
    setRainbowIfEnabled(ctx, barX, barY, unitW, barHeight, i, cycleIncrementer);

    ctx.setTransform(1, 0, 0, 1, barX, barY);
    ctx.rotate((cycleIncrementer * i + (time / 20000)) * Math.PI);
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

export const SingularityVisualizer: VisualizerRenderer = {
  id: "circle",
  name: "Singularity",
  draw: frame => draw(frame, false),
};

export const SingularityWithLogoVisualizer: VisualizerRenderer = {
  id: "circlelogo",
  name: "SingularityWithLogo",
  draw: frame => draw(frame, true),
};
