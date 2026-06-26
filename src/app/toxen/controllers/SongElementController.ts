import Controller from './Controller';
import type Song from '../Song';
import ImageCache from '../ImageCache';

/**
 * Per-song-element controller. Replaces the imperative `SongElement` class
 * component handle stored on `Song.currentElement`.
 *
 * The {@link SongElement} view creates one of these per mount, registers it on
 * its `Song`, and subscribes to it. External code (notably `Song`) drives the
 * row via {@link select}, {@link setPlaying} and {@link setProgressBar}.
 */
export default class SongElementController extends Controller {
  constructor(public readonly song: Song, playing = false) {
    super();
    this._playing = playing;
  }

  private _selected = false;
  private _playing: boolean;
  private _progressBar = 0;

  /** The visible row element (set inside the virtualized wrapper). */
  public divElement: HTMLDivElement = null;
  /** The always-present wrapper element. */
  public divPermanentElement: HTMLDivElement = null;

  public get selected() {
    return this._selected;
  }

  public get playing() {
    return this._playing;
  }

  public get progressBar() {
    return this._progressBar;
  }

  public play() {
    this.song.play();
  }

  public select(force?: boolean) {
    this._selected = force ?? !this._selected;
    this.notify();
  }

  public setPlaying(playing: boolean) {
    this._playing = playing;
    this.notify();
  }

  public setProgressBar(progress: number) {
    this._progressBar = progress;
    this.notify();
  }

  /**
   * Invalidate cached thumbnails for this song's background.
   * Call this when the background image changes.
   */
  public invalidateBackgroundCache() {
    if (this.song.backgroundFile()) {
      const bgFile = `${this.song.backgroundFile()}?h=${this.song.hash}`;
      ImageCache.getInstance().invalidate(bgFile);
    }
  }
}
