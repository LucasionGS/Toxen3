import Theme from '../Theme';
import Controller from './Controller';

/**
 * Controller for the {@link ThemeContainer} view. Owns the active theme whose
 * CSS variables are injected into the document.
 */
export default class ThemeContainerController extends Controller {
  private _theme: Theme = null;

  public get theme() {
    return this._theme;
  }

  public setTheme(theme: Theme) {
    this._theme = theme;
    this.notify();
  }
}
