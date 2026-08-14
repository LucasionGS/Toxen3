import { VisualizerFrame } from "./types";

/**
 * Source rectangle the logo has always been drawn from. This is the size the `Image` was
 * constructed with rather than the asset's natural size, so it stays a literal.
 */
export const LOGO_SIZE = 256;

/**
 * Centre logo shared by the Singularity and MirroredSingularity variants.
 */
export function drawCenterLogo(frame: VisualizerFrame, size: number) {
  const { logo, vWidth, vHeight, opacity, useAlpha } = frame;
  if (!logo) return;

  useAlpha(opacity, ctx => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, (vWidth / 2) - LOGO_SIZE, (vHeight / 2) - LOGO_SIZE);
    ctx.drawImage(logo.source,
      0,
      0,

      LOGO_SIZE,
      LOGO_SIZE,

      LOGO_SIZE - size / 2,
      LOGO_SIZE - size / 2,

      size,
      size
    );
    ctx.restore();
  });
}
