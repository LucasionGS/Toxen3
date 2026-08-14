// @ts-expect-error Vite asset import
import txnLogo from "../../../icons/toxen.png";
import { LOGO_SIZE } from "./visualizers/logo";
import { ReadyImage } from "./visualizers/types";

const MAX_CACHED = 16;
const LOGO_KEY = "logo";

/**
 * Loads and caches the images the visualizer draws. Styles never see a half-loaded image: a
 * lookup returns null until the image is usable.
 *
 * Elements are exposed as well as ReadyImages, because the worker path needs the raw element to
 * build an ImageBitmap from.
 */
export default class VisualizerImages {
  private cache = new Map<string, HTMLImageElement>();

  private logoImage = (() => {
    const img = new Image(LOGO_SIZE, LOGO_SIZE);
    img.src = txnLogo;
    return img;
  })();

  public getLogoElement(): HTMLImageElement {
    return this.logoImage;
  }

  public getLogo(): ReadyImage | null {
    return this.logoImage.complete
      ? { source: this.logoImage, width: LOGO_SIZE, height: LOGO_SIZE }
      : null;
  }

  /** Starts the load if this is the first time the source is seen. */
  public getElement(src: string): HTMLImageElement | null {
    if (!src) return null;

    let img = this.cache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      if (this.cache.size >= MAX_CACHED) {
        this.cache.delete(this.cache.keys().next().value);
      }
      this.cache.set(src, img);
    }
    return img;
  }

  public get(src: string): ReadyImage | null {
    const img = this.getElement(src);
    if (!img || !img.complete || img.naturalWidth <= 0) return null;
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  }

  /**
   * Resolves a payload image key. Mirrors what the worker does with its ImageBitmap cache, so
   * the main-thread fallback draws the same thing.
   */
  public getByKey(key: string): ReadyImage | null {
    return key === LOGO_KEY ? this.getLogo() : this.get(key);
  }

  public clear() {
    this.cache.clear();
  }
}
