import React from 'react';
import Song from '../Song';
import { Toxen, ToxenEvent } from '../../ToxenApp';
import Settings from '../Settings';
import Time from '../Time';
import PulsingLogo from '../../components/PulsingLogo/PulsingLogo';
import StoryboardParser from '../StoryboardParser';
import Controller from './Controller';

export type MediaSourceInfo = string;

export interface MusicPlayerSourceOptions {
  crossOrigin?: "anonymous" | "use-credentials" | "";
}

export interface MusicPlayerControllerOptions {
  subtitleEditorMode?: boolean;
}

/**
 * Controller for the {@link MusicPlayer} view. Owns the audio/video element and
 * all playback logic that previously lived inside the `MusicPlayer` class component.
 *
 * The view binds the `<video>` element via {@link attachMedia}, starts the
 * controller via {@link start} on mount, and disposes it via {@link dispose} on unmount.
 */
export default class MusicPlayerController extends Controller {
  public readonly subtitleEditorMode: boolean;

  constructor(options?: MusicPlayerControllerOptions) {
    super();
    this.subtitleEditorMode = !!options?.subtitleEditorMode;
  }

  /** The underlying media element, bound by the view. */
  public media: HTMLMediaElement = null;

  private _src: MediaSourceInfo = null;
  private _crossOrigin: MusicPlayerSourceOptions["crossOrigin"] = undefined;

  private _interval: NodeJS.Timeout | null = null;
  private crossfadeInProgress = false;
  private tempCrossfadeElement: HTMLAudioElement | null = null;
  private crossfadeTriggered = false; // Track if crossfade has been triggered for current song
  private activeFadeInterval: NodeJS.Timeout | null = null; // Track the active fade interval
  private isSeeking = false;

  private _pendingSourceCallback: (() => void) | null = null;

  public get src() {
    return this._src;
  }

  public get crossOrigin() {
    return this._crossOrigin;
  }

  /**
   * Binds the media element rendered by the view. Passing `null` (on unmount)
   * clears the reference.
   */
  public attachMedia(media: HTMLMediaElement | null) {
    this.media = media;
  }

  /**
   * Starts the playback progress interval. Called by the view on mount.
   */
  public start() {
    if (this._interval) return;
    this._interval = setInterval(() => {
      try {
        Toxen.musicControls.setValue(this.media.currentTime);
        Toxen.musicControls.setBackgroundRange(this.media.buffered.start(0) || 0, this.media.buffered.end(this.media.buffered.length - 1) || 0);

        // Update current song's progress bar
        const currentSong = Song.getCurrent();
        if (currentSong && this.media.duration && !isNaN(this.media.duration) && this.media.duration > 0) {
          const progress = Math.min(this.media.currentTime / this.media.duration, 1);
          currentSong.setProgressBar(progress);

          // Check if we need to trigger early crossfade
          this.checkCrossfadeTrigger();
        }
      } catch {
        // Nothing
      }
    }, 50);
  }

  /**
   * Stops the interval and cancels any active crossfade. Called by the view on unmount.
   */
  public dispose() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.cancelActiveCrossfade();
  }

  /**
   * Updates the rendered source state and schedules a callback to run after the
   * view commits the new source to the media element (mirrors the old
   * `setState(..., callback)` behaviour).
   */
  private setSourceState(src: MediaSourceInfo, crossOrigin: MusicPlayerSourceOptions["crossOrigin"], callback?: () => void) {
    this._src = src;
    this._crossOrigin = crossOrigin;
    this._pendingSourceCallback = callback ?? null;
    this.notify();
  }

  /**
   * Runs any pending source callback. Invoked by the view in an effect once the
   * new `src`/`crossOrigin` have been applied to the media element.
   */
  public flushSourceCallback() {
    const callback = this._pendingSourceCallback;
    this._pendingSourceCallback = null;
    if (callback) callback();
  }

  /**
   * @param vol From 0 to 100
   */
  public setVolume(vol: number) {
    if (isNaN(vol) || typeof vol !== "number") vol = 50;
    this.media.volume = vol / 100;
  }

  public setPosition(seconds: number, options?: {
    updateDiscord?: boolean
  }) {
    options = options || {};
    this.media.currentTime = seconds;
    StoryboardParser.resetCurrentEvents();
    if (!this.subtitleEditorMode && options.updateDiscord) Toxen.discord?.setPresence();
  }

  public setSource(src: MediaSourceInfo, playWhenReady: boolean = false, options?: MusicPlayerSourceOptions) {
    // Reset storyboard on song change
    StoryboardParser.resetCurrentEvents();
    // Reset crossfade trigger for new song
    this.crossfadeTriggered = false;
    this.setSourceState(src, options?.crossOrigin, () => playWhenReady ? this.play() : this.load());
  }

  /**
   * Checks if we're near the end of the current song and should trigger crossfade early.
   * This ensures there's overlap for the fade effect to work.
   */
  private checkCrossfadeTrigger() {
    if (this.subtitleEditorMode) return;
    if (this.crossfadeTriggered) return; // Already triggered
    if (this.crossfadeInProgress) return; // Crossfade already happening

    const crossfadeEnabled = Settings.get('crossfadeEnabled', false);
    if (!crossfadeEnabled) return;

    const duration = this.media.duration;
    const currentTime = this.media.currentTime;

    if (!duration || isNaN(duration) || duration === 0) return;

    // Get crossfade duration setting
    const crossfadeDuration = Settings.get('crossfadeDuration', 3);

    // Trigger next song when we're [crossfadeDuration] seconds before the end
    const timeRemaining = duration - currentTime;

    if (timeRemaining <= crossfadeDuration && timeRemaining > 0) {
      this.crossfadeTriggered = true;

      // Trigger the next song (which will use crossfade)
      if (Settings.get("repeat") || Toxen.getPlayableSongs().length === 1) {
        // For repeat, just let it play to the end and restart
        this.crossfadeTriggered = false; // Reset so natural onEnded handles it
      } else {
        // Play next song early to allow crossfade
        this.playNext();
      }
    }
  }

  /**
   * Cancels any active crossfade and cleans up resources.
   * Safe to call even if no crossfade is active.
   */
  private cancelActiveCrossfade() {
    // Clear the fade interval
    if (this.activeFadeInterval) {
      clearInterval(this.activeFadeInterval);
      this.activeFadeInterval = null;
    }

    // Clean up temporary element
    if (this.tempCrossfadeElement) {
      this.tempCrossfadeElement.pause();
      this.tempCrossfadeElement.src = '';
      this.tempCrossfadeElement = null;
    }

    // Reset flags
    this.crossfadeInProgress = false;
  }

  /**
   * Performs a crossfade transition from the current song to a new song.
   * Creates a temporary audio element for the old song and fades between them.
   * @param newSrc The source of the new song to fade into
   * @param duration The duration of the crossfade in seconds
   */
  public async crossfade(newSrc: MediaSourceInfo, duration: number = 3, options?: MusicPlayerSourceOptions): Promise<void> {
    // Cancel any existing crossfade before starting a new one
    if (this.crossfadeInProgress) {
      console.log('Canceling previous crossfade to start new one');
      this.cancelActiveCrossfade();

      // Restore volume to the main player in case it was mid-fade
      const currentVolume = Settings.get('volume', 50);
      this.media.volume = currentVolume / 100;
    }

    // If there's no current source or it's paused, just switch normally
    if (!this._src || this.media.paused) {
      this.setSource(newSrc, true, options);
      return;
    }

    this.crossfadeInProgress = true;
    // Reset trigger flag since we're now handling the transition
    this.crossfadeTriggered = false;

    try {
      // Create temporary element for the outgoing song
      this.tempCrossfadeElement = document.createElement('audio');
      if (this._crossOrigin) this.tempCrossfadeElement.crossOrigin = this._crossOrigin;
      this.tempCrossfadeElement.src = this._src;
      this.tempCrossfadeElement.currentTime = this.media.currentTime;
      this.tempCrossfadeElement.volume = this.media.volume;

      // Start playing the temporary element (continuing the old song)
      await this.tempCrossfadeElement.play();

      // Load the new song into the main player
      this.media.volume = 0; // Start new song at 0 volume

      // Reset storyboard on song change
      StoryboardParser.resetCurrentEvents();

      this.setSourceState(newSrc, options?.crossOrigin, async () => {
        try {
          // Start playing the new song
          await this.media.play();

          // Perform the crossfade
          const startTime = Date.now();
          const fadeInterval = 50; // Update every 50ms for smooth transition

          this.activeFadeInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);

            // Get the current target volume (in case user changes it during fade)
            const targetVolume = Settings.get('volume', 50) / 100;

            // Fade out old song (check if it still exists - might be cancelled)
            if (this.tempCrossfadeElement) {
              this.tempCrossfadeElement.volume = targetVolume * (1 - progress);
            }

            // Fade in new song to the current target volume
            this.media.volume = targetVolume * progress;

            // When fade is complete
            if (progress >= 1) {
              // Clear our reference
              if (this.activeFadeInterval) {
                clearInterval(this.activeFadeInterval);
                this.activeFadeInterval = null;
              }

              // Clean up temporary element
              if (this.tempCrossfadeElement) {
                this.tempCrossfadeElement.pause();
                this.tempCrossfadeElement.src = '';
                this.tempCrossfadeElement = null;
              }

              // Ensure final volume is correct (get current setting in case it changed)
              const finalVolume = Settings.get('volume', 50) / 100;
              this.media.volume = finalVolume;
              this.crossfadeInProgress = false;

              // Update Discord presence and other integrations
              if (!this.subtitleEditorMode) {
                Toxen.discord?.setPresence();
                if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
                  toxenapi.TaskbarControls.onPlayStateChanged();
                }
              }
            }
          }, fadeInterval);

        } catch (error) {
          console.error('Error during crossfade playback:', error);

          // Clean up on error using our cleanup method
          this.cancelActiveCrossfade();

          // Restore volume and play normally
          const currentVolume = Settings.get('volume', 50);
          this.media.volume = currentVolume / 100;
          this.play();
        }
      });

    } catch (error) {
      console.error('Error starting crossfade:', error);

      // Clean up and fall back to normal transition
      this.cancelActiveCrossfade();

      // Restore volume
      const currentVolume = Settings.get('volume', 50);
      this.media.volume = currentVolume / 100;

      this.setSource(newSrc, true, options);
    }
  }

  public setPlaybackRate(rate: number) {
    this.media.playbackRate = rate;
  }

  public get playbackRate() {
    return this.media.playbackRate;
  }

  public isVideo(src: string) {
    if (!src) return false;
    return Toxen.getSupportedVideoFiles().includes(toxenapi.getFileExtension(src).toLowerCase());
  }

  public get paused() {
    return this.media.paused;
  }

  public play() {
    this.media.play();
    if (!this.subtitleEditorMode) {
      Toxen.discord?.setPresence();
      if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
        toxenapi.TaskbarControls.onPlayStateChanged();
      }
    }
  }

  public load() {
    this.media.load();
  }

  public pause() {
    this.media.pause();
    if (!this.subtitleEditorMode) {
      Toxen.discord?.setPresence();
      if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
        toxenapi.TaskbarControls.onPlayStateChanged();
      }
    }
  }

  public toggle() {
    if (this.media.paused) this.play();
    else this.pause();
  }

  public playNext() {
    if (this.subtitleEditorMode) return;
    let nextSongFromHistory = Song.historyForward();
    if (nextSongFromHistory) {
      return nextSongFromHistory.play({ disableHistory: true });
    }
    if (Settings.get("shuffle")) {
      this.playRandom();
    }
    else {
      let songs = Toxen.getPlayableSongs();
      let songCount = songs.length;
      let curSong = Song.getCurrent();
      let nextSong: Song = null;
      while (nextSong == null) {
        let nextSongIndex = (songs.findIndex(s => curSong && s.uid === curSong.uid) + 1) % songCount;
        nextSong = songs[nextSongIndex];
        if (nextSong == null) {
          Toxen.error("No songs available.", 2000);
          return;
        }
        if (curSong && nextSong.uid === curSong.uid) {
          Toxen.notify({
            content: "No more songs available.",
            type: "error",
            expiresIn: 3000
          })
          Toxen.error("No more songs available.");
          return;
        }
        return nextSong.play();
      }
    }
  }

  public playPrev() {
    if (this.subtitleEditorMode) return;
    let prevSong = Song.historyBack();
    if (prevSong) prevSong.play({ disableHistory: true });
  }

  public playRandom() {
    if (this.subtitleEditorMode) return;
    let songs = Toxen.getPlayableSongs();
    let songCount = songs.length;
    if (songCount === 0) {
      Toxen.error("No songs available.", 2000);
      return;
    }
    let randomSongIndex: number;
    let curSong = Song.getCurrent();
    let song: Song = null;
    do {
      randomSongIndex = Math.floor(Math.random() * songCount);
      song = songs[randomSongIndex];
      if (curSong && curSong.uid === song.uid && songCount > 1) {
        song = null;
      }
    } while (song == null);
    song.play();
  }

  public getTime() {
    return new Time(this.media.currentTime * 1000);
  }

  public handleEnded() {
    if (this.subtitleEditorMode) return;

    // If crossfade already triggered the next song, don't do anything
    if (this.crossfadeTriggered && Settings.get('crossfadeEnabled', false)) {
      // Reset for next song
      this.crossfadeTriggered = false;
      return;
    }

    ToxenEvent.emit("songEnded");
    StoryboardParser.resetCurrentEvents();

    // Reset current song's progress bar before moving to next song
    const currentSong = Song.getCurrent();
    if (currentSong) {
      currentSong.setProgressBar(0);
    }

    if (Settings.get("repeat") || Toxen.getPlayableSongs().length === 1) {
      this.play();
    }
    else {
      this.playNext();
    }
  }

  public handleSeeking() {
    if (!Settings.isRemote()) return;
    if (
      this.isSeeking == false
      && (this.media.currentTime < Toxen.musicControls.progressBar.state.bufferedRange[0]
        || this.media.currentTime > Toxen.musicControls.progressBar.state.bufferedRange[1])
    ) {
      Toxen.loadingScreen.show();
      Toxen.loadingScreen.setContent(
        <>
          <PulsingLogo />Buffering...
        </>
      );
      this.isSeeking = true;
    }
  }

  public handleSeeked() {
    if (!Settings.isRemote()) return;
    if (this.isSeeking) {
      Toxen.loadingScreen.hide();
      this.isSeeking = false;
    }
    this.isSeeking = false;
  }
}
