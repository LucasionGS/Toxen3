import VisualizerLayer from "../layer";
import { Canvas2D, ReadyImage } from "../types";
import { FrameDoneMessage, WorkerMessage } from "./messages";

/**
 * Draws the visualizer layer against an OffscreenCanvas transferred from the renderer.
 *
 * The main thread stays the clock: it reads the analyser, resolves settings and posts a frame.
 * Only the drawing happens here.
 */

let ctx: Canvas2D = null;
const layer = new VisualizerLayer();
const images = new Map<string, ReadyImage>();

function resolveImage(key: string): ReadyImage | null {
  return images.get(key) ?? null;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init":
      ctx = message.canvas.getContext("2d");
      break;

    case "resize":
      if (ctx) {
        ctx.canvas.width = message.width;
        ctx.canvas.height = message.height;
      }
      break;

    case "image": {
      const previous = images.get(message.key);
      if (previous) (previous.source as ImageBitmap).close?.();
      images.set(message.key, {
        source: message.bitmap,
        width: message.bitmap.width,
        height: message.bitmap.height,
      });
      break;
    }

    case "clear":
      layer.clearParticles();
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      break;

    case "frame": {
      if (ctx) layer.render(ctx, message.payload, resolveImage);

      const done: FrameDoneMessage = { type: "frameDone", spectrum: message.payload.spectrum };
      (self as unknown as Worker).postMessage(done, [message.payload.spectrum.buffer]);
      break;
    }
  }
};
