import React from "react";
import { modals } from "@mantine/modals";
import { Toxen, ToxenEvent } from "./ToxenApp";
import Settings from "./toxen/Settings";
import Stats from "./toxen/Statistics";
import User from "./toxen/User";
import Song from "./toxen/Song";
import Playlist from "./toxen/Playlist";
import { SongLibrary } from "./toxen/SongLibrary";
import ExtensionManager from "./toxen/extensions/ExtensionManager";
import { friendSocket } from "./toxen/FriendSocket";
import { SyncEngine } from "./toxen/sync/SyncEngine";
import { SyncedItems } from "./toxen/SyncedItems";
import TButton from "./components/Button/Button";
import LoginForm from "./components/LoginForm/LoginForm";
import { initSyncNotifications } from "./components/Sync/SyncNotifications";
import { DeviceLibrary } from "./toxen/DeviceLibrary";

//#region Steps
/**
 * Loads the settings file and applies it.
 */
async function loadSettings() {
  await Settings.load();
}

/**
 * Points the sync API at the server and loads the library's sync state, so the library can list cloud-only songs.
 * Nothing here talks to the server.
 */
async function prepareSync() {
  SyncedItems.install();
  await SyncEngine.prepare();
}

/**
 * Loads playback statistics.
 */
async function loadStatistics() {
  await Stats.load();
}

/**
 * Pushes the loaded settings into the GUI.
 */
async function applySettings() {
  Toxen.updateSettings();
}

/**
 * Restores window size and position and syncs the fullscreen state (desktop only).
 */
async function restoreWindow() {
  if (!toxenapi.isDesktop()) return;
  const win = toxenapi.remote.getCurrentWindow();
  if (Settings.get("restoreWindowSize")) {
    // Window initial size
    win.setSize(
      Settings.set("windowWidth", Settings.get("windowWidth") ?? 1280),
      Settings.set("windowHeight", Settings.get("windowHeight") ?? 768)
    );

    const display = toxenapi.remote.screen.getPrimaryDisplay();
    const [winSizeWidth, winSizeheight] = win.getSize();
    win.setPosition(
      Math.floor(display.size.width / 2) - Math.floor(winSizeWidth / 2),
      Math.floor(display.size.height / 2) - Math.floor(winSizeheight / 2),
    );
  }

  Toxen.toggleFullscreen(win.isFullScreen());
}

/**
 * Initializes the OS taskbar media controls (desktop only).
 */
async function initTaskbarControls() {
  if (!toxenapi.isDesktop()) return;
  toxenapi.TaskbarControls.initialize();
}

/**
 * Listens to the auto updater and notifies the user about updates (desktop only).
 */
async function listenForUpdates() {
  if (!toxenapi.isDesktop()) return;
  try {
    toxenapi.remote.autoUpdater.on("update-available", () => {
      Toxen.log("A new update available and is being installed in the background...", 5000);
    });

    toxenapi.remote.autoUpdater.on("update-downloaded", (e, releaseNotes, releaseName) => {
      e.preventDefault();
      if (!toxenapi.isDesktop()) return;
      new toxenapi.remote.Notification({
        title: "Update Downloaded",
        body: `A new update is available: ${releaseName}`
      }).show();
      Toxen.log(
        React.createElement(React.Fragment, null,
          "Update downloaded: ",
          React.createElement("code", null, releaseName),
          React.createElement("br"),
          React.createElement(TButton, {
            txStyle: "action",
            onClick: () => {
              if (!toxenapi.isDesktop()) return;
              toxenapi.remote.autoUpdater.quitAndInstall();
            },
          }, "Update"),
        )
      );
    });

    toxenapi.remote.autoUpdater.on("error", (error) => {
      console.error(error);
      Toxen.error(`Error while updating: ${error.message}`);
    });
  } catch {
    Toxen.error("Error trying to listen to auto updater.", 5000);
  }
}

/**
 * Discovers and loads extensions (desktop only).
 */
async function loadExtensions() {
  if (!toxenapi.isDesktop()) return;
  await ExtensionManager.discover();
  await ExtensionManager.loadAll();
}

/**
 * Loads the available themes and applies the selected one.
 */
async function loadThemes() {
  await Toxen.loadThemes();
}

/**
 * Loads the song library and playlists.
 */
async function loadSongs() {
  await Toxen.loadSongs();
}

/**
 * Initializes the image cache for optimized background thumbnails.
 */
async function initImageCache() {
  Toxen.initializeImageCache();
}

/**
 * Shows the song list and hides the loading screen.
 */
async function showLibrary() {
  Toxen.songPanel.update();
  Toxen.sidePanel.setWidth(Settings.get("panelWidth"));
  Toxen.loadingScreen.toggleVisible(false);
}

/**
 * Starts playback on desktop. On web it opens the song panel, or asks the user to log in.
 */
/**
 * Imports files shared to the installed web app while it was closed (Android). Not awaited, since the import shows
 * its own progress.
 */
async function importSharedFiles() {
  if (toxenapi.isDesktop()) return;
  DeviceLibrary.importInbox().catch(error => console.error("Unable to import the shared files.", error));
}

async function startPlaybackOrLogin() {
  if (toxenapi.isDesktop()) {
    Toxen.musicPlayer.playRandom();
    return;
  }

  // Songs kept on this device play without an account; the login stays one tap away in the panel
  if (User.getCurrentUser() || Toxen.songList?.length > 0) {
    Toxen.sidePanel.setSectionId("songPanel");
    Toxen.sidePanel.show(true);
  }
  else {
    modals.open({
      title: "Login",
      children: React.createElement("div", null,
        React.createElement("h2", null, "Not logged in"),
        React.createElement(LoginForm),
      ),
      size: "md"
    });
  }
}

/**
 * Connects Discord Rich Presence when enabled. Not awaited, since it can take a while.
 */
async function connectDiscord() {
  if (!Settings.get("discordPresence")) return;
  Toxen.discord?.connect().then(() => {
    Toxen.discord?.setPresence();
  }).catch(error => console.warn("Unable to connect to Discord:", error));
}

/**
 * Connects the real-time friends socket if the user is logged in.
 */
async function connectFriendSocket() {
  if (User.getCurrentUser()) {
    friendSocket.connect();
  }
}

/**
 * Song uids whose media changed while they were playing. The new media is used from the next play, and a repeating
 * song switches to it when it ends, never mid-play.
 */
const pendingMediaChanges = new Set<string>();

/**
 * Media path of each song before a sync change replaced its info, to tell when `applied` changed the media.
 */
const mediaBeforeChange = new Map<string, string | null>();

/**
 * Turns sync engine events into song list updates, notifications (`initSyncNotifications`) and live updates of the
 * playing song, and feeds socket events into the engine. Runs once.
 */
function wireSync() {
  const events = SyncEngine.events;

  events.on("song", change => {
    mediaBeforeChange.set(change.uid, SongLibrary.getSong(change.uid)?.paths?.media ?? null);
    SongLibrary.applySyncChange(change);
  });

  events.on("applied", applied => {
    const current = Song.getCurrent();
    if (!current || current.uid !== applied.uid) return;
    const mediaBefore = mediaBeforeChange.get(applied.uid);
    mediaBeforeChange.delete(applied.uid);
    const touched = (relPath?: string | null) => Boolean(relPath) && applied.paths.includes(relPath);

    if (applied.infoChanged || touched(current.paths?.background)) {
      const bg = current.backgroundFile();
      Toxen.background.setBackground(bg ? `${bg}?h=${current.hash}` : null);
    }
    if (applied.infoChanged || touched(current.paths?.subtitles)) current.applySubtitles();
    if (applied.infoChanged || touched(current.paths?.storyboard)) current.applyStoryboard();
    if (applied.infoChanged) current.setAppTitle();
    if (touched(current.paths?.media) || (mediaBefore !== undefined && mediaBefore !== (current.paths?.media ?? null))) {
      pendingMediaChanges.add(current.uid);
    }
  });

  ToxenEvent.on("songEnded", () => {
    const current = Song.getCurrent();
    if (!current || !pendingMediaChanges.delete(current.uid)) return;
    // The player restarts a repeating song on the old media element; load the new media instead
    if (Settings.get("repeat") || Toxen.getPlayableSongs().length === 1) setTimeout(() => current.play(), 0);
  });

  initSyncNotifications();

  friendSocket.on("sync:changed", event => SyncEngine.handleRemoteEvent(event));
  friendSocket.on("connected", reconnect => {
    if (reconnect) SyncEngine.handleReconnect();
  });

  // Flush the sync state when the window closes; pending jobs resume on the next start
  window.addEventListener("beforeunload", () => {
    SyncEngine.stop();
  });
}

/**
 * Starts background sync for the logged-in user: songs, playlists, and (when this device syncs them) settings, themes
 * and extensions. Not awaited: it needs the network and must never block startup.
 */
async function startSync() {
  wireSync();
  SyncEngine.init().catch(error => {
    console.error(error);
    Toxen.error(`Unable to start sync: ${error?.message ?? error}`);
  });
}

/**
 * Checks for a newer Media Downloader (yt-dlp) and updates it (desktop only).
 * Not awaited: this needs the network and must never block startup.
 */
async function checkMediaDownloader() {
  if (!toxenapi.isDesktop()) return;
  const ytdlp = toxenapi.getYtdlp();
  if (!ytdlp.isYtdlpInstalled()) return;
  (async () => {
    const ytd = await ytdlp.getYtdlpWrap();
    const version = await ytd.getVersion();
    console.log("ytdlp version:", version);
    const latest = (await ytdlp.getGithubReleases()).pop()?.tag_name;
    console.log("ytdlp latest:", latest);
    if (latest?.trim() !== version?.trim()) {
      Toxen.warn("Media Downloader is outdated. Updating...", 2500);
      await ytdlp.installYtdlp(true);
      Toxen.log("Media Downloader updated.", 2500);
    }
  })().catch(error => console.warn("Unable to check for Media Downloader updates:", error));
}
//#endregion

/**
 * Startup steps in the order they run.
 */
const STEPS: [name: string, run: () => Promise<void>][] = [
  ["load settings", loadSettings],
  ["prepare sync", prepareSync],
  ["load statistics", loadStatistics],
  ["apply settings", applySettings],
  ["restore window", restoreWindow],
  ["initialize taskbar controls", initTaskbarControls],
  ["listen for updates", listenForUpdates],
  ["load extensions", loadExtensions],
  ["load themes", loadThemes],
  ["load songs", loadSongs],
  ["initialize image cache", initImageCache],
  ["show library", showLibrary],
  ["start playback or login", startPlaybackOrLogin],
  ["import shared files", importSharedFiles],
  ["connect Discord", connectDiscord],
  ["connect friend socket", connectFriendSocket],
  ["start sync", startSync],
  ["check Media Downloader", checkMediaDownloader],
];

/**
 * Steps that later steps depend on for user data. If one of these fails, startup stops instead of continuing,
 * because later steps save settings and would overwrite the user's file with defaults.
 * Statistics aren't critical: `Stats.load` falls back to its backup or empty statistics and never throws.
 */
const CRITICAL_STEPS = new Set(["load settings"]);

/**
 * Runs the app startup sequence. Every step is caught and logged on its own, so a failing step doesn't stop
 * the ones after it, except for `CRITICAL_STEPS`: then `Toxen.startupFailed` is set and the rest is skipped.
 * `Toxen.whenReady()` always resolves once the sequence ends.
 * @returns `true` if startup ran to the end.
 */
export function bootstrap(): Promise<boolean> {
  return (async () => {
    for (const [name, run] of STEPS) {
      try {
        await run();
      } catch (error) {
        console.error(error);
        Toxen.error(`Startup step "${name}" failed: ${error?.message ?? error}`);
        if (CRITICAL_STEPS.has(name)) {
          Toxen.startupFailed = true;
          return false;
        }
      }
    }
    return true;
  })()
    .catch(error => {
      console.error(error);
      Toxen.error(`Toxen failed to finish starting up: ${error?.message ?? error}`);
      Toxen.startupFailed = true;
      return false;
    })
    .finally(() => Toxen._resolveWhenReady());
}

export default bootstrap;
