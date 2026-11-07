import React from 'react';
import Song from '../Song';
import { Toxen, ToxenEvent } from '../../ToxenApp';
import Settings from '../Settings';
import Time from '../Time';
import PulsingLogo from '../../components/PulsingLogo/PulsingLogo';
import StoryboardParser from '../StoryboardParser';
import Controller from './Controller';
import { SongStorage } from "../storage/SongStorage";
import { StorageSelector } from "../storage/StorageSelector";
import { PlayQueue } from "../PlayQueue";
import Stats from "../Statistics";
import { friendSocket } from "../FriendSocket";
import type { ProviderAudioSource } from "../providers/Provider";
import { updateNotification } from "@mantine/notifications";
//@ts-expect-error PNG imports have no type declaration
import ToxenMax from "../../../icons/skull_max.png";

export type MediaSourceInfo = string;

export interface PlaySongOptions {
  /**
   * Prevent this play from being added to the history
   */
  disableHistory?: boolean;
}

export interface MusicPlayerSourceOptions {
  crossOrigin?: "anonymous" | "use-credentials" | "";
}

/**
 * Controller for the {@link MusicPlayer} view. Owns the audio/video element and
 * all playback logic that previously lived inside the `MusicPlayer` class component.
 *
 * The view binds the `<video>` element via {@link attachMedia}, starts the
 * controller via {@link start} on mount, and disposes it via {@link dispose} on unmount.
 */
export default class MusicPlayerController extends Controller {
  /** The underlying media element, bound by the view. */
  public media: HTMLMediaElement = null;

  private _src: MediaSourceInfo = null;
  private _crossOrigin: MusicPlayerSourceOptions["crossOrigin"] = undefined;

  private _interval: NodeJS.Timeout | null = null;
  private crossfadeInProgress = false;
  private tempCrossfadeElement: HTMLAudioElement | null = null;
  /**
   * The source the temporary crossfade element plays (the outgoing song's).
   */
  private _tempCrossfadeSrc: MediaSourceInfo = null;
  /**
   * The outgoing song's transcoded blob URL, revoked once the temporary crossfade element stops playing it.
   */
  private _tempCrossfadeBlobUrl: string = null;
  private crossfadeTriggered = false; // Track if crossfade has been triggered for current song
  private activeFadeInterval: NodeJS.Timeout | null = null; // Track the active fade interval
  private isSeeking = false;

  private _pendingSourceCallback: (() => void) | null = null;

  /**
   * Incremented by every {@link playSong} and {@link crossfade} call. A call that finds its token is no longer the
   * latest after an `await` has been superseded and must not touch the player, the subtitles or the background.
   */
  private _playToken = 0;
  private _crossfadeToken = 0;
  /**
   * Blob URL of the transcoded audio of the song that is currently playing. Revoked when another song starts.
   */
  private _playingAudioBlobUrl: string = null;
  /**
   * Blob URL of the media session artwork of the song that is currently playing. Revoked when another song starts.
   */
  private _playingArtworkBlobUrl: string = null;
  /**
   * The last provider audio source handed out for each song, released when the song is played again.
   */
  private _providerSources = new WeakMap<Song, ProviderAudioSource>();

  public get src() {
    return this._src;
  }

  public get crossOrigin() {
    return this._crossOrigin;
  }

  /**
   * Crossfade fades a second element's volume from a timer. Mobile browsers throttle that timer in
   * the background and iOS ignores `volume` entirely, so raw audio mode switches it off.
   */
  public get crossfadeEnabled() {
    return Settings.get('crossfadeEnabled', false) && !Settings.get('rawAudioMode');
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
    if (options.updateDiscord) Toxen.discord?.setPresence();
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
    if (this.crossfadeTriggered) return; // Already triggered
    if (this.crossfadeInProgress) return; // Crossfade already happening

    if (!this.crossfadeEnabled) return;

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

    this.disposeTempCrossfadeElement();

    // Reset flags
    this.crossfadeInProgress = false;
  }

  /**
   * Stops the temporary element playing the outgoing song of a crossfade and releases the blob URL it was playing.
   */
  private disposeTempCrossfadeElement() {
    if (this.tempCrossfadeElement) {
      this.tempCrossfadeElement.pause();
      this.tempCrossfadeElement.src = '';
      this.tempCrossfadeElement = null;
    }
    if (this._tempCrossfadeBlobUrl) URL.revokeObjectURL(this._tempCrossfadeBlobUrl);
    this._tempCrossfadeBlobUrl = null;
    this._tempCrossfadeSrc = null;
  }

  /**
   * Revoke a blob URL of the song that stopped playing, unless the crossfade element is still fading it out; then it is
   * revoked when that element is disposed.
   */
  private releasePlayingBlobUrl(url: string) {
    if (!url) return;
    if (this.tempCrossfadeElement && this._tempCrossfadeSrc === url) {
      if (this._tempCrossfadeBlobUrl && this._tempCrossfadeBlobUrl !== url) URL.revokeObjectURL(this._tempCrossfadeBlobUrl);
      this._tempCrossfadeBlobUrl = url;
    }
    else {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Performs a crossfade transition from the current song to a new song.
   * Creates a temporary audio element for the old song and fades between them.
   * @param newSrc The source of the new song to fade into
   * @param duration The duration of the crossfade in seconds
   */
  public async crossfade(newSrc: MediaSourceInfo, duration: number = 3, options?: MusicPlayerSourceOptions): Promise<void> {
    // A newer crossfade or source switch makes this one obsolete once it has awaited
    const crossfadeToken = ++this._crossfadeToken;
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
      this._tempCrossfadeSrc = this._src;
      this.tempCrossfadeElement.currentTime = this.media.currentTime;
      this.tempCrossfadeElement.volume = this.media.volume;

      // Start playing the temporary element (continuing the old song)
      await this.tempCrossfadeElement.play();
      if (crossfadeToken !== this._crossfadeToken) return;

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

              this.disposeTempCrossfadeElement();

              // Ensure final volume is correct (get current setting in case it changed)
              const finalVolume = Settings.get('volume', 50) / 100;
              this.media.volume = finalVolume;
              this.crossfadeInProgress = false;

              // Update Discord presence and other integrations
              Toxen.discord?.setPresence();
              if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
                toxenapi.TaskbarControls.onPlayStateChanged();
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
      if (crossfadeToken !== this._crossfadeToken) return;
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
    Toxen.discord?.setPresence();
    Toxen.hue?.reconcile();
    if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
      toxenapi.TaskbarControls.onPlayStateChanged();
    }
  }

  public load() {
    this.media.load();
  }

  public pause() {
    this.media.pause();
    Toxen.discord?.setPresence();
    Toxen.hue?.reconcile();
    if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
      toxenapi.TaskbarControls.onPlayStateChanged();
    }
  }

  public toggle() {
    if (this.media.paused) this.play();
    else this.pause();
  }

  /**
   * Start playing a song: load its media (transcoding it first when the format needs it), subtitles, storyboard and
   * background, then update the visuals, media session and integrations.
   *
   * Every call takes a new play token. Loading takes several `await`s, so when songs are switched quickly an older call
   * can finish after a newer one started. Until its source reaches the player, a call checks its token after every
   * `await` and stops once superseded, releasing any blob URL it created. Once its source is on the player it owns the
   * player and always finishes the song state (background, current song, title, storyboard, colours, integrations),
   * stopping only when a newer call has actually replaced the source. A newer call that is still loading, or fails,
   * can't leave this song's audio playing under the previous song's background and title.
   */
  public async playSong(song: Song, options?: PlaySongOptions): Promise<void> {
    if (Toxen.isMode("StoryboardEditor") && Toxen.editingSong && Toxen.editingSong.uid !== song.uid) {
      Toxen.sendError("CURRENTLY_EDITING_SONG");
      return;
    }

    if (Toxen.isMode("SubtitlesEditor") && Toxen.editingSong && Toxen.editingSong.uid !== song.uid) {
      Toxen.sendError("CURRENTLY_EDITING_SUBTITLES");
      return;
    }

    options ??= {};
    const token = ++this._playToken;
    const isStale = () => token !== this._playToken;

    const sourceInfo = await song.getMediaSource().catch(error => {
      console.error(error);
      Toxen.error(error?.message ?? "Unable to load media source.");
      return null as ProviderAudioSource;
    });
    if (!sourceInfo?.url) return;

    let src = sourceInfo.url;
    let audioBlobUrl: string = null; // Transcoded audio for this play, if any
    // Release what this call created when it ends before its source has been handed to the player
    const release = () => {
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
      if (sourceInfo.url !== this._src) sourceInfo.revoke?.();
    };
    if (isStale()) return release();
    if (this._src === src) return;
    if (song.storage.kind === SongStorage.Kind.Cloud && song.isVideo()) Toxen.log("Streaming a video can take some time to load... Using audio files is much faster.", 3000);
    const bg = song.backgroundFile();

    if (!song.usesProvider() && StorageSelector.isLocal(song) && toxenapi.isDesktop()) {
      // For formats not natively supported by Chromium, transcode to a Blob URL
      // in memory using FFmpeg before handing the source to the audio element.
      // Seeking works natively since the full data is in memory.
      const ext = toxenapi.path.extname(src).toLowerCase();
      const isNativeAudio = Toxen.getWebNativeAudioFiles().includes(ext);
      const isNativeVideo = Toxen.getWebNativeVideoFiles().includes(ext);
      if (!isNativeAudio && !isNativeVideo) {
        const notifId = Toxen.notify({
          title: "Transcoding " + song.getDisplayName(),
          content: "0% complete",
        });
        try {
          const blobUrl = await toxenapi.ffmpeg.transcodeToBlob(src, (percent) => {
            updateNotification({
              id: notifId,
              message: `${Math.round(percent)}% complete`,
              autoClose: false,
            });
          });
          updateNotification({ id: notifId, message: "Done", autoClose: 500 });
          audioBlobUrl = blobUrl;
          src = blobUrl;
        } catch (err) {
          updateNotification({ id: notifId, message: "Transcoding failed", autoClose: 3000 });
          console.error(err);
          Toxen.error("Could not transcode: " + song.getDisplayName());
          return;
        }
        if (isStale()) return release();
      }
    }

    await song.applySubtitles(isStale);
    if (isStale()) return release();
    await song.applyStoryboard(isStale);
    if (isStale()) return release();
    if (!options.disableHistory) PlayQueue.historyAdd(song);

    this._providerSources.get(song)?.revoke?.();
    this._providerSources.set(song, song.usesProvider() ? sourceInfo : null);

    // Use crossfade if enabled and there's a current song playing
    const crossfadeDuration = Settings.get("crossfadeDuration", 3);
    const currentSong = Song.getCurrent();

    if (this.crossfadeEnabled && currentSong && !this.media.paused) {
      // Use crossfade for smooth transition
      await this.crossfade(src, crossfadeDuration, { crossOrigin: sourceInfo.crossOrigin });
    }
    else {
      // Normal transition without crossfade
      this.setSource(src, true, { crossOrigin: sourceInfo.crossOrigin });
    }

    // Superseded while crossfading and the source never reached the player (or was already replaced)
    if (this._src !== src) return release();

    // From here this call's source is on the player. Only a newer call that replaced it makes the rest obsolete;
    // a newer call that is still loading (or fails) must not leave this song half applied.
    const replaced = () => this._src !== src;

    // The previous song's blob URLs are no longer needed (a crossfade releases the audio once its fade ends)
    if (this._playingAudioBlobUrl !== audioBlobUrl) this.releasePlayingBlobUrl(this._playingAudioBlobUrl);
    if (this._playingArtworkBlobUrl) URL.revokeObjectURL(this._playingArtworkBlobUrl);
    this._playingAudioBlobUrl = audioBlobUrl;
    this._playingArtworkBlobUrl = null;

    // If song has a background, force it. Otherwise, let Background component resolve defaults/shuffle
    await Toxen.background.setBackground(bg ? (bg + "?h=" + song.hash) : null);
    if (replaced()) return;
    Stats.set("songsPlayed", (Stats.get("songsPlayed") ?? 0) + 1);

    // Apply playlist-specific settings if playing from a playlist
    const currentPlaylist = Toxen.playlist;
    const effectiveSettings = song.getEffectiveSettings(currentPlaylist?.name);

    Toxen.setAllVisualColors(effectiveSettings.visualizerColor);
    Toxen.background.storyboard.setSong(song);
    Toxen.background.visualizer.update();

    // Apply autogenerated theme if enabled - do this after storyboard is set up
    // Use setTimeout to ensure storyboard has fully updated
    setTimeout(() => {
      Toxen.applyAutogeneratedThemeIfEnabled();
    }, 0);

    const img = new Image();
    img.src = (Toxen.background.getBackground() || ToxenMax);
    song.setCurrent();
    // Reset progress bar when starting a new song
    song.setProgressBar(0);
    song.setAppTitle();
    const addToMetadata = (blob?: Blob) => {
      if (song !== Song.getCurrent() || replaced()) {
        return;
      }

      Toxen.discord?.setPresence(song);
      // Broadcast now-playing to friends via WebSocket
      friendSocket.sendNowPlaying({
        title: song.title,
        artist: song.artist,
        album: song.album,
        uid: song.uid,
        duration: song.duration,
      });
      const artworkUrl = blob ? URL.createObjectURL(blob) : null;
      if (this._playingArtworkBlobUrl) URL.revokeObjectURL(this._playingArtworkBlobUrl);
      this._playingArtworkBlobUrl = artworkUrl;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title ?? "Unknown Title",
        artist: song.artist ?? "Unknown Artist",
        album: song.album ?? "",
        artwork: blob ? [
          { src: artworkUrl, sizes: `${img.naturalWidth}x${img.naturalHeight}`, type: "image/png" }
        ] : undefined
      });
    };

    if (Toxen.getSupportedImageFiles().includes(toxenapi.getFileExtension(bg).toLowerCase())) {
      const onLoad = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        try { ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight); } catch (error) {
          console.error(error);
          return addToMetadata();
        }

        try {
          canvas.toBlob(addToMetadata);
        } catch (error) {
          console.error("Failed to convert canvas to blob:", error);
          // Fallback to using the image directly
          addToMetadata();
        }
      };
      img.addEventListener("load", onLoad);
    }
    addToMetadata();

    if (Toxen.background.visualizer.isStopped())
      Toxen.background.visualizer.start();

    if (!song.duration || isNaN(song.duration)) {
      song.duration = await song.calculateDuration();
      song.saveInfo();
    }

    // Update taskbar controls when a new song plays
    if (toxenapi.isDesktop() && toxenapi.TaskbarControls) {
      toxenapi.TaskbarControls.onSongChanged(song);
    }
  }

  public playNext() {
    let nextSongFromHistory = PlayQueue.historyForward();
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
    let prevSong = PlayQueue.historyBack();
    if (prevSong) prevSong.play({ disableHistory: true });
  }

  public playRandom() {
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
    // If crossfade already triggered the next song, don't do anything
    if (this.crossfadeTriggered && this.crossfadeEnabled) {
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

  /**
   * Whether the current song streams from the cloud, so seeking past the buffered range has to wait for the network.
   */
  private isStreaming(): boolean {
    return (Song.getCurrent()?.storage ?? StorageSelector.forLibrary()).kind === SongStorage.Kind.Cloud;
  }

  public handleSeeking() {
    if (!this.isStreaming()) return;
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
    if (!this.isStreaming()) return;
    if (this.isSeeking) {
      Toxen.loadingScreen.hide();
      this.isSeeking = false;
    }
    this.isSeeking = false;
  }
}
