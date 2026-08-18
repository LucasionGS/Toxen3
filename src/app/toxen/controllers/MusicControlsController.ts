import React from 'react';
import Time from '../Time';
import { Toxen } from '../../ToxenApp';
import Controller from './Controller';
import ProgressBar from '../../components/ProgressBar';

/**
 * Controller for the {@link MusicControls} view. Owns the displayed time/duration
 * and the imperative API that the playback interval and other code call
 * (e.g. `Toxen.musicControls.setValue(...)`).
 *
 * The interactive {@link ProgressBar} remains a class component; the view binds it
 * via {@link attachProgressBar} so `Toxen.musicControls.progressBar` keeps working.
 */
export default class MusicControlsController extends Controller {
  public currentTime: Time = new Time();
  public duration: Time = new Time();

  /** Bound by the view. The progress bar widget is still a class component. */
  public progressBar: ProgressBar = null;

  /** Bound by volume slider views so {@link setVolume} can reflect changes in all of them. */
  private volumeSliders = new Set<React.Dispatch<React.SetStateAction<number>>>();

  /** Registers a volume slider's state setter. Returns an unsubscribe function. */
  public addVolumeSlider(setter: React.Dispatch<React.SetStateAction<number>>): () => void {
    this.volumeSliders.add(setter);
    return () => {
      this.volumeSliders.delete(setter);
    };
  }

  public attachProgressBar(progressBar: ProgressBar | null) {
    this.progressBar = progressBar;
  }

  public setValue(value: number) {
    this.currentTime = new Time(value * 1000);
    this.notify();
    this.progressBar?.setValue(value);
  }

  /**
   * Sets the background value of the progress bar. This is useful for showing what part of a song is buffered.
   */
  public setBackgroundRange(start: number, end: number) {
    this.progressBar?.setBackgroundRange(start, end);
  }

  public setMax(max: number) {
    this.duration = new Time(max * 1000);
    this.notify();
    this.progressBar?.setMax(max);
  }

  public setVolume(vol: number) {
    Toxen.musicPlayer.setVolume(vol);
    this.volumeSliders.forEach(setter => setter(vol));
  }
}
