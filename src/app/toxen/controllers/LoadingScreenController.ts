import React from 'react';
import Controller from './Controller';

/**
 * Controller for the {@link LoadingScreen} view. Owns visibility and content.
 */
export default class LoadingScreenController extends Controller {
  private _visible = false;
  private _content: React.ReactNode = null;

  public get visible() {
    return this._visible;
  }

  public get content() {
    return this._content;
  }

  public toggleVisible(): void;
  public toggleVisible(force?: boolean): void;
  public toggleVisible(force?: boolean) {
    this._visible = force ?? !this._visible;
    this.notify();
  }

  public show() {
    this.toggleVisible(true);
  }

  public hide() {
    this.toggleVisible(false);
  }

  public setContent(content: React.ReactNode) {
    this._content = content;
    this.notify();
  }
}
