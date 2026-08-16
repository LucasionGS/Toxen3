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
  private _currentVerticalPosition: string = null;

  private lastSub: SubtitleParser.SubtitleItem = null;

  public get subtitles() {
    return this._subtitles;
  }

  public get currentText() {
    return this._currentText;
  }

  /**
   * Vertical position in percent from the bottom, or null to use the default CSS position.
   */
  public get currentVerticalPosition() {
    return this._currentVerticalPosition;
  }

  public setSubtitles(subtitles: SubtitleParser.SubtitleArray) {
    this.lastSub = null;
    this._subtitles = subtitles;
    this._currentText = "";
    this._currentVerticalPosition = null;
    this.notify();
  }

  /**
   * Advances the subtitle state for the current playback time. Called once per
   * animation frame by the view. Only notifies when the active subtitle changes.
   */
  public tick(mp: TimeProvider | null) {
    if (!mp) return;
    const currentTime = mp.getTime();
    if (!currentTime) return;
    const subtitles = this._subtitles;
    if (subtitles && subtitles.song && subtitles.song.subtitleDelay) currentTime.addMilliseconds(-subtitles.song.subtitleDelay);
    const sub = subtitles?.getByTime(currentTime);
    if (sub !== this.lastSub) {
      this.lastSub = sub;
      if (!sub) {
        this._currentText = null;
        this.notify();
        return;
      }

      let text = sub.text || "";
      // TST style events accumulate up to this subtitle's start; a reset event clears back to the globals.
      const baseOptions: Partial<SubtitleParser.SubtitleOptions> = {};
      if (subtitles.type === "tst" && subtitles.styleEvents?.length > 0) {
        const events = [...subtitles.styleEvents].sort((a, b) => a.time.valueOf() - b.time.valueOf());
        for (const event of events) {
          if (event.time.valueOf() > sub.start.valueOf()) break;
          if (event.reset) {
            for (const key in baseOptions) delete (baseOptions as any)[key];
          }
          Object.assign(baseOptions, event.options);
        }
      }
      function getOption<T>(key: keyof SubtitleParser.SubtitleOptions, defaultValue: T = null) {
        switch (subtitles.type) {
          case "tst":
            return (sub.options[key] ?? baseOptions[key] ?? subtitles.options[key]) || defaultValue;
          default:
            return (sub.options[key] ?? subtitles.options[key]) || defaultValue;
        }
      }
      let color = getOption("color", "white");
      let font = getOption("font", "Arial");
      let fontSize = getOption("fontSize", 24);
      let bold = getOption("bold", "false");
      let italic = getOption("italic", "false");
      let outlineColor = getOption("outlineColor", null);
      let verticalPosition = getOption("verticalPosition", null);

      let style = `color: ${color}; font-family: ${font}; font-size: ${fontSize + "px"};`;
      if (italic === "true") style += " font-style: italic;";
      if (outlineColor) style += ` text-shadow: 0 0 10px ${outlineColor};`;
      text = `<span style="${style}">${text}</span>`;
      if (bold === "true") {
        text = `<b>${text}</b>`;
      }
      this._currentText = text;
      this._currentVerticalPosition = verticalPosition;
      this.notify();
    }
  }
}
