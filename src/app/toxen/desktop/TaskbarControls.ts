import { nativeImage } from "electron";
import * as remote from "@electron/remote";
import Settings from "../Settings";
import Song from "../Song";
import { Toxen } from "../../ToxenApp";

export default class TaskbarControls {
  private static isInitialized = false;

  /**
   * Initialize taskbar controls for the current window
   */
  public static initialize() {
    if (!process.platform.startsWith('win')) {
      // Taskbar thumbnail buttons are Windows-only
      return;
    }

    if (!remote || !remote.getCurrentWindow) {
      console.warn('Remote module not available for taskbar controls');
      return;
    }

    TaskbarControls.setupButtons();
    TaskbarControls.isInitialized = true;
  }

  /**
   * Create icon with appropriate symbol
   */
  private static createControlIcon(type: 'shuffle' | 'previous' | 'play' | 'pause' | 'next' | 'repeat', enabled: boolean = false): Electron.NativeImage {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 16;
      canvas.height = 16;

      if (!ctx) return nativeImage.createEmpty();

      // Clear canvas
      ctx.clearRect(0, 0, 16, 16);

      // Set colors
      const fillColor = '#FFFFFF';
      const strokeColor = enabled ? '#50C878' : '#FFFFFF'; // Green when enabled, white otherwise
      
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = enabled ? 2 : 1.5;

      // Draw the appropriate icon
      switch (type) {
        case 'shuffle':
          // Draw shuffle icon (crossed arrows)
          ctx.beginPath();
          ctx.lineWidth = enabled ? 2 : 1.5;
          ctx.lineCap = 'round';
          
          // First arrow: bottom-left to top-right
          ctx.moveTo(3, 11);
          ctx.lineTo(11, 3);
          // Arrow head
          ctx.moveTo(9, 3);
          ctx.lineTo(11, 3);
          ctx.lineTo(11, 5);
          
          // Second arrow: top-left to bottom-right
          ctx.moveTo(3, 5);
          ctx.lineTo(11, 13);
          // Arrow head
          ctx.moveTo(9, 13);
          ctx.lineTo(11, 13);
          ctx.lineTo(11, 11);
          
          ctx.stroke();
          break;

        case 'previous':
          // Draw previous icon (two triangles pointing left)
          ctx.beginPath();
          ctx.moveTo(10, 3);
          ctx.lineTo(6, 8);
          ctx.lineTo(10, 13);
          ctx.closePath();
          ctx.moveTo(6, 3);
          ctx.lineTo(2, 8);
          ctx.lineTo(6, 13);
          ctx.closePath();
          break;

        case 'play':
          // Draw play icon (triangle pointing right)
          ctx.beginPath();
          ctx.moveTo(4, 3);
          ctx.lineTo(13, 8);
          ctx.lineTo(4, 13);
          ctx.closePath();
          break;

        case 'pause':
          // Draw pause icon (two rectangles)
          ctx.fillRect(4, 3, 3, 10);
          ctx.fillRect(9, 3, 3, 10);
          break;

        case 'next':
          // Draw next icon (two triangles pointing right)
          ctx.beginPath();
          ctx.moveTo(6, 3);
          ctx.lineTo(10, 8);
          ctx.lineTo(6, 13);
          ctx.closePath();
          ctx.moveTo(10, 3);
          ctx.lineTo(14, 8);
          ctx.lineTo(10, 13);
          ctx.closePath();
          break;

        case 'repeat':
          // Draw repeat icon (circular arrow with arrow heads)
          ctx.beginPath();
          ctx.lineWidth = enabled ? 2 : 1.5;
          ctx.lineCap = 'round';
          
          // Main circular path (almost complete circle)
          ctx.arc(8, 8, 4, Math.PI * 0.2, Math.PI * 1.8);
          ctx.stroke();
          
          // Arrow head at the end
          ctx.beginPath();
          ctx.moveTo(5, 4);
          ctx.lineTo(3, 6);
          ctx.lineTo(5, 8);
          ctx.stroke();
          
          // Arrow head at the start (optional, for better visibility)
          ctx.beginPath();
          ctx.moveTo(11, 12);
          ctx.lineTo(13, 10);
          ctx.lineTo(11, 8);
          ctx.stroke();
          break;
      }

      // Apply fill to solid icons (play, pause, previous, next)
      if (type === 'play' || type === 'pause' || type === 'previous' || type === 'next') {
        ctx.fill();
        if (enabled) {
          ctx.strokeStyle = '#50C878';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      const dataURL = canvas.toDataURL();
      return nativeImage.createFromDataURL(dataURL);
    } catch (error) {
      console.warn('Failed to create control icon:', error);
      return nativeImage.createEmpty();
    }
  }

  /**
   * Set up the thumbnail toolbar buttons
   */
  private static setupButtons() {
    try {
      const window = remote.getCurrentWindow();
      if (!window || !window.setThumbarButtons) {
        console.warn('Window or setThumbarButtons not available');
        return;
      }

      const isShuffleEnabled = Settings.get("shuffle");
      const isRepeatEnabled = Settings.get("repeat");
      const isPlaying = Toxen.musicPlayer && !Toxen.musicPlayer.paused;

      const buttons: Electron.ThumbarButton[] = [
        {
          tooltip: `Shuffle ${isShuffleEnabled ? '(On)' : '(Off)'}`,
          icon: TaskbarControls.createControlIcon('shuffle', isShuffleEnabled),
          click: () => {
            Settings.set("shuffle", !Settings.get("shuffle"));
            Settings.save({ suppressNotification: true });
            TaskbarControls.updateButtons();
          }
        },
        {
          tooltip: 'Previous Track',
          icon: TaskbarControls.createControlIcon('previous'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.playPrev();
            }
          }
        },
        {
          tooltip: isPlaying ? 'Pause' : 'Play',
          icon: TaskbarControls.createControlIcon(isPlaying ? 'pause' : 'play'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.toggle();
              TaskbarControls.updateButtons();
            }
          }
        },
        {
          tooltip: 'Next Track',
          icon: TaskbarControls.createControlIcon('next'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.playNext();
            }
          }
        },
        {
          tooltip: `Repeat ${isRepeatEnabled ? '(On)' : '(Off)'}`,
          icon: TaskbarControls.createControlIcon('repeat', isRepeatEnabled),
          click: () => {
            Settings.set("repeat", !Settings.get("repeat"));
            Settings.save({ suppressNotification: true });
            TaskbarControls.updateButtons();
          }
        }
      ];

      window.setThumbarButtons(buttons);
    } catch (error) {
      console.error('Failed to set thumbnail bar buttons:', error);
    }
  }

  /**
   * Update button states based on current settings
   */
  public static updateButtons() {
    if (!TaskbarControls.isInitialized) return;

    try {
      const window = remote.getCurrentWindow();
      if (!window || !window.setThumbarButtons) return;

      const isPlaying = Toxen.musicPlayer && !Toxen.musicPlayer.paused;
      const isShuffleEnabled = Settings.get("shuffle");
      const isRepeatEnabled = Settings.get("repeat");

      const buttons: Electron.ThumbarButton[] = [
        {
          tooltip: `Shuffle ${isShuffleEnabled ? '(On)' : '(Off)'}`,
          icon: TaskbarControls.createControlIcon('shuffle', isShuffleEnabled),
          click: () => {
            Settings.set("shuffle", !Settings.get("shuffle"));
            Settings.save({ suppressNotification: true });
            TaskbarControls.updateButtons();
          }
        },
        {
          tooltip: 'Previous Track',
          icon: TaskbarControls.createControlIcon('previous'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.playPrev();
            }
          }
        },
        {
          tooltip: isPlaying ? 'Pause' : 'Play',
          icon: TaskbarControls.createControlIcon(isPlaying ? 'pause' : 'play'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.toggle();
              // Delay the update to ensure the state has changed
              setTimeout(() => TaskbarControls.updateButtons(), 100);
            }
          }
        },
        {
          tooltip: 'Next Track',
          icon: TaskbarControls.createControlIcon('next'),
          click: () => {
            if (Toxen.musicPlayer) {
              Toxen.musicPlayer.playNext();
            }
          }
        },
        {
          tooltip: `Repeat ${isRepeatEnabled ? '(On)' : '(Off)'}`,
          icon: TaskbarControls.createControlIcon('repeat', isRepeatEnabled),
          click: () => {
            Settings.set("repeat", !Settings.get("repeat"));
            Settings.save({ suppressNotification: true });
            TaskbarControls.updateButtons();
          }
        }
      ];

      window.setThumbarButtons(buttons);
    } catch (error) {
      console.error('Failed to update thumbnail bar buttons:', error);
    }
  }

  /**
   * Called when a song starts/stops playing
   */
  public static onPlayStateChanged() {
    TaskbarControls.updateButtons();
  }

  /**
   * Called when a new song starts playing
   */
  public static onSongChanged(song: Song | null) {
    TaskbarControls.updateButtons();
  }
}
