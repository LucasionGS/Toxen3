/**
 * Base class for the "Controller" architecture used to standardize imperative
 * functionality that used to live inside React class components.
 *
 * A Controller owns state and imperative methods (e.g. {@link MusicPlayerController.crossfade}).
 * A function component acts as a thin "view": it binds its DOM element(s) to the
 * controller and subscribes to it via the `useController` hook so it re-renders
 * whenever the controller calls {@link Controller.notify}.
 *
 * External (non-React) code keeps calling the imperative API directly, e.g.
 * `Toxen.musicPlayer.crossfade(...)`, because `Toxen.*` now points at controller
 * instances rather than mounted component refs.
 */
export type ControllerListener = () => void;

export default abstract class Controller {
  private _listeners = new Set<ControllerListener>();

  /**
   * Subscribe a listener that is invoked whenever the controller notifies of a change.
   * @returns An unsubscribe function.
   */
  public subscribe(listener: ControllerListener): () => void {
    this._listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  public unsubscribe(listener: ControllerListener): void {
    this._listeners.delete(listener);
  }

  /**
   * Notify all subscribed views that they should re-render.
   * Controllers call this after mutating any state that affects rendering.
   */
  public notify(): void {
    this._listeners.forEach(listener => listener());
  }
}
