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

  /** Bound by the view's volume slider so {@link setVolume} can reflect changes. */
  public setVolumeSlider: React.Dispatch<React.SetStateAction<number>> = () => void 0;

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
    this.setVolumeSlider(vol);
  }
}
