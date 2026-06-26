import SubtitleParser from '../SubtitleParser';
import Controller from './Controller';
import Time from '../Time';

interface TimeProvider {
  getTime(): Time;
}

/**
 * Controller for the {@link Subtitles} view. Owns the loaded subtitle data and
 * the currently displayed text. The view drives {@link tick} on each animation
 * frame with the active music player.
 */
export default class SubtitlesController extends Controller {
  private _subtitles: SubtitleParser.SubtitleArray = new SubtitleParser.SubtitleArray();
  private _currentText: string = "";

  private currentOptions: SubtitleParser.SubtitleItem["options"] = {};
  private lastSub: SubtitleParser.SubtitleItem = null;

  public get subtitles() {
    return this._subtitles;
  }

  public get currentText() {
    return this._currentText;
  }

  public setSubtitles(subtitles: SubtitleParser.SubtitleArray) {
    this.lastSub = null;
    this.currentOptions = {};
    this._subtitles = subtitles;
    this._currentText = "";
    this.notify();
  }

  /**
   * Advances the subtitle state for the current playback time. Called once per
   * animation frame by the view. Only notifies when the active subtitle changes.
   */
  public tick(mp: TimeProvider | null) {
    const self = this;
    if (!mp) return;
    const currentTime = mp.getTime();
    if (!currentTime) return;
    const subtitles = this._subtitles;
    if (subtitles && subtitles.song && subtitles.song.subtitleDelay) currentTime.addMilliseconds(-subtitles.song.subtitleDelay);
    const sub = subtitles?.getByTime(currentTime);
    if (sub !== this.lastSub) {
      if (sub) {
        Object.assign(this.currentOptions, sub.options);
      }
      this.lastSub = sub;
      if (!sub) {
        this._currentText = null;
        this.notify();
        return;
      }

      let text = sub.text || "";
      function getOption<T>(key: keyof SubtitleParser.SubtitleOptions, defaultValue: T = null) {
        switch (subtitles.type) {
          case "tst":
            return (sub.options[key] ?? subtitles.options[key]) || (self.currentOptions ? self.currentOptions[key] : null) || defaultValue;
          default:
            return (sub.options[key] ?? subtitles.options[key]) || defaultValue;
        }
      }
      let color = getOption("color", "white");
      let font = getOption("font", "Arial");
      let fontSize = getOption("fontSize", 24);
      let bold = getOption("bold", "false");

      text = `<span style="color: ${color}; font-family: ${font}; font-size: ${fontSize + "px"};">${text}</span>`;
      if (bold === "true") {
        text = `<b>${text}</b>`;
      }
      this._currentText = text;
      this.notify();
    }
  }
}
