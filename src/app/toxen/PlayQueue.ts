import { Toxen } from "../ToxenApp";
import type Song from "./Song";

/**
 * The play history (what Previous/Next walk through) and the manual song queue (`Toxen.songQueue`).
 */
export class PlayQueue {
  private constructor() { }

  private static _history: Song[] = [];
  private static _historyIndex = 0;

  //#region History

  /**
   * Index of the current song in the play history.
   */
  public static getHistoryIndex(): number {
    return PlayQueue._historyIndex;
  }

  /**
   * Add a song to the end of the history, dropping everything after the current position first.
   * Adding the same song twice in a row does nothing.
   */
  public static historyAdd(song: Song): void {
    PlayQueue._history.splice(PlayQueue._historyIndex + 1);
    if (PlayQueue._history.length > 0 && PlayQueue._history[PlayQueue._history.length - 1] === song) return;
    PlayQueue._history.push(song);
    PlayQueue._historyIndex = PlayQueue._history.length - 1;
  }

  /**
   * Step forward in the history.
   * @returns The next song in the history, or `null` if already at the end.
   */
  public static historyForward(): Song | null {
    if (PlayQueue._historyIndex < PlayQueue._history.length - 1) {
      PlayQueue._historyIndex++;
      return PlayQueue._history[PlayQueue._historyIndex];
    }
    return null;
  }

  /**
   * Step back in the history.
   * @returns The previous song in the history, or `null` if already at the start.
   */
  public static historyBack(): Song | null {
    if (PlayQueue._historyIndex > 0) {
      PlayQueue._historyIndex--;
      return PlayQueue._history[PlayQueue._historyIndex];
    }
    return null;
  }

  //#endregion

  //#region Queue

  /**
   * Remove every song from the queue.
   */
  public static clearQueue(): void {
    Toxen.songQueue.forEach(s => s.inQueue = false);
    Toxen.songQueue = [];
    Toxen.updateSongPanels();
  }

  /**
   * Add a song to the end of the queue. Songs already in the queue keep their place.
   * @returns The queue, in the order the songs were added.
   */
  public static addToQueue(song: Song): Song[] {
    if (!Toxen.songQueue.includes(song)) Toxen.songQueue.push(song);
    song.inQueue = true;
    song.selected = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Toxen.songQueue;
  }

  /**
   * Remove a song from the queue.
   * @returns The queue.
   */
  public static removeFromQueue(song: Song): Song[] {
    const index = Toxen.songQueue.indexOf(song);
    if (index !== -1) Toxen.songQueue.splice(index, 1);
    song.inQueue = false;
    song.selected = false;
    Toxen.songQueuePanel.update();
    Toxen.songPanel.update();
    return Toxen.songQueue;
  }

  //#endregion
}

export default PlayQueue;
