import { FramePayload } from "../layer";
import { FrameDoneMessage, WorkerMessage } from "./messages";
// eslint-disable-next-line import/no-unresolved -- Vite virtual module
import VisualizerWorker from "./VisualizerWorker?worker&inline";

/**
 * Main-thread half of the worker rendering path.
 *
 * Owns capability detection, the transferred canvas, the image channel, and a pair of spectrum
 * buffers that are transferred back and forth so no frame allocates.
 */
export default class WorkerBridge {
  private worker: Worker = null;
  private failed = false;
  private sentImages = new Set<string>();

  /** Buffers ping-pong with the worker; a frame is skipped if neither is back yet. */
  private spare: Uint8Array<ArrayBuffer> = null;
  private inFlight = false;

  public static isSupported() {
    return typeof Worker !== "undefined"
      && typeof OffscreenCanvas !== "undefined"
      && typeof HTMLCanvasElement !== "undefined"
      && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function"
      && typeof createImageBitmap === "function";
  }

  public get isActive() {
    return this.worker !== null && !this.failed;
  }

  /**
   * Hands the canvas to the worker. This is irreversible for that element, so it only happens
   * once and only when the worker actually starts.
   */
  public attach(canvas: HTMLCanvasElement): boolean {
    if (this.failed || this.worker) return this.isActive;

    try {
      this.worker = new VisualizerWorker();
      this.worker.onerror = event => {
        console.error("[Visualizer] Worker failed, falling back to main thread rendering:", event.message);
        this.failed = true;
        this.worker?.terminate();
        this.worker = null;
      };
      this.worker.onmessage = (event: MessageEvent<FrameDoneMessage>) => {
        if (event.data?.type !== "frameDone") return;
        this.spare = event.data.spectrum as Uint8Array<ArrayBuffer>;
        this.inFlight = false;
      };

      const offscreen = canvas.transferControlToOffscreen();
      this.post({ type: "init", canvas: offscreen }, [offscreen]);
      return true;
    } catch (error) {
      console.error("[Visualizer] Could not start the render worker, falling back to main thread:", error);
      this.failed = true;
      this.worker = null;
      return false;
    }
  }

  public resize(width: number, height: number) {
    this.post({ type: "resize", width, height });
  }

  public clear() {
    this.sentImages.clear();
    this.post({ type: "clear" });
  }

  /**
   * Uploads an image once per key. Bitmaps are transferred, so the source stays on this side.
   */
  public async sendImage(key: string, source: ImageBitmapSource) {
    if (!this.isActive || this.sentImages.has(key)) return;
    this.sentImages.add(key);

    try {
      const bitmap = await createImageBitmap(source);
      if (!this.isActive) {
        bitmap.close();
        return;
      }
      this.post({ type: "image", key, bitmap }, [bitmap]);
    } catch (error) {
      this.sentImages.delete(key);
      console.warn(`[Visualizer] Could not transfer image "${key}" to the render worker:`, error);
    }
  }

  /**
   * Copies the spectrum into a transferable buffer and posts the frame. Returns false when the
   * worker has not returned the previous buffer yet, in which case the frame is dropped rather
   * than queued: a stale frame is worse than a missing one.
   */
  public sendFrame(payload: FramePayload, spectrum: Uint8Array): boolean {
    if (!this.isActive || this.inFlight) return false;

    let buffer = this.spare;
    if (!buffer || buffer.length !== spectrum.length) {
      buffer = new Uint8Array(spectrum.length);
    }
    buffer.set(spectrum);
    this.spare = null;
    this.inFlight = true;

    payload.spectrum = buffer;
    this.post({ type: "frame", payload }, [buffer.buffer]);
    return true;
  }

  public dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.sentImages.clear();
  }

  private post(message: WorkerMessage, transfer?: Transferable[]) {
    if (!this.worker) return;
    this.worker.postMessage(message, transfer ?? []);
  }
}
