import Settings from '../Settings';
import User from '../User';
import PlayQueue from '../PlayQueue';
import { Toxen } from '../../ToxenApp';
import Controller from './Controller';
import type MusicPlayerController from './MusicPlayerController';
import type Visualizer from '../../components/Background/Visualizer';
import type Storyboard from '../../components/Background/Storyboard/Storyboard';

/**
 * Controller for the {@link Background} view. Owns the runtime background image
 * and holds references to the child rendering layers (music player, visualizer,
 * storyboard), which remain class components.
 */
export default class BackgroundController extends Controller {
  private _image: string = null;

  public musicPlayer: MusicPlayerController = null;
  public visualizer: Visualizer = null;
  public storyboard: Storyboard = null;

  /** Set by the background image view; called per-frame to apply dynamic dimming. */
  public updateDimScale: (dimScale: number) => void = () => void 0;

  public get image() {
    return this._image;
  }

  public setBackground(source: string) {
    // Append the auth token to server URLs (cloud songs) so the browser can load them; local paths stay as they are
    if (source && BackgroundController._isServerUrl(source)) {
      source = User.appendAuth(source);
    }
    this._image = source;
    this.notify();
    return Promise.resolve();
  }

  /**
   * Returns the currently in use background image. It will return the default image if no image is set.
   */
  public getBackground(): string {
    // Priority: playlist background -> explicitly set runtime background -> song background via storyboard -> default(s)
    const playlistBg = (Toxen.playlist && Toxen.playlist.getBackgroundPath());
    if (playlistBg) return playlistBg;

    if (this._image) return this._image;

    // If no explicit background, use multi-backgrounds only
    const shuffle = Settings.get("shuffleDefaultBackgrounds");
    const list = Settings.get("defaultBackgrounds") || [];
    if (list.length > 0) {
      let bg: string;
      if (shuffle) {
        // Pick a stable random per current song to avoid flicker between frames
        const curSong = Toxen.background?.storyboard?.getSong();
        const seedStr = curSong?.uid || "global";
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) hash = ((hash << 5) - hash) + (seedStr.charCodeAt(i) + PlayQueue.getHistoryIndex());
        const idx = Math.abs(hash) % list.length;
        bg = list[idx];
      } else {
        // Deterministic: first item in list
        bg = list[0];
      }
      // Append auth for remote/web URLs
      if (bg && BackgroundController._isServerUrl(bg)) {
        bg = User.appendAuth(bg);
      }
      return bg;
    }

    // No defaults configured -- try theme background
    const themeBgUrl = Toxen.theme?.getBackgroundImageUrl?.();
    if (themeBgUrl) return themeBgUrl;

    return null;
  }

  /**
   * Whether a background source is a server URL (which needs authentication), not a local path or blob/data URL.
   */
  private static _isServerUrl(source: string): boolean {
    return /^(https?|txs?):\/\//i.test(source);
  }
}
