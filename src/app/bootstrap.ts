import React from "react";
import { modals } from "@mantine/modals";
import { Toxen } from "./ToxenApp";
import Settings from "./toxen/Settings";
import Stats from "./toxen/Statistics";
import User from "./toxen/User";
import ExtensionManager from "./toxen/extensions/ExtensionManager";
import { friendSocket } from "./toxen/FriendSocket";
import TButton from "./components/Button/Button";
import LoginForm from "./components/LoginForm/LoginForm";

//#region Steps
/**
 * Loads the settings file and applies it.
 */
async function loadSettings() {
  await Settings.load();
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
async function startPlaybackOrLogin() {
  if (toxenapi.isDesktop()) {
    Toxen.musicPlayer.playRandom();
    return;
  }

  if (User.getCurrentUser()) {
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
  ["connect Discord", connectDiscord],
  ["connect friend socket", connectFriendSocket],
  ["check Media Downloader", checkMediaDownloader],
];

/**
 * Runs the app startup sequence. Every step is caught and logged on its own, so a failing step never
 * stops the ones after it. `Toxen.whenReady()` always resolves once the sequence ends.
 */
export function bootstrap(): Promise<void> {
  return (async () => {
    for (const [name, run] of STEPS) {
      try {
        await run();
      } catch (error) {
        console.error(error);
        Toxen.error(`Startup step "${name}" failed: ${error?.message ?? error}`);
      }
    }
  })()
    .catch(error => {
      console.error(error);
      Toxen.error(`Toxen failed to finish starting up: ${error?.message ?? error}`);
    })
    .finally(() => Toxen._resolveWhenReady());
}

export default bootstrap;
