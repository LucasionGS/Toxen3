import Controller from './Controller';

/**
 * Minimal controller for "view" components whose only imperative API is to force
 * a re-render (previously `update()` which called `setState({})`).
 *
 * Used by panels like {@link SongPanel} / {@link SongQueuePanel} that render derived
 * data from global state and just need to be told when to refresh.
 */
export default class ViewController extends Controller {
  /** Forces subscribed views to re-render. */
  public update() {
    this.notify();
  }
}
