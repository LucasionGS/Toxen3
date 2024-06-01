import React from "react";
import ReactDOM from "react-dom";
import ReactDOMClient from "react-dom/client";
import { getCurrentWindow } from "@electron/remote";
import ToxenAppRenderer, { Toxen } from "./app/ToxenApp";
import "@fortawesome/fontawesome-free/js/all"; // Import FA
import "@fortawesome/fontawesome-free/scss/regular.scss";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import Settings from "./app/toxen/Settings";
import Song from "./app/toxen/Song";
import Converter from "./app/toxen/Converter";
import Stats from "./app/toxen/Statistics";
// import navigator from "./navigator";
import User from "./app/toxen/User";
import { MantineProvider } from "@mantine/core";
import {  } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { app, Menu } from "@electron/remote";

// console.log("Toxen is running in development mode.");
// console.log(app);
// console.log(Menu);


app.whenReady().then(() => {
  // Setup
  // Create menu actions/shortcuts
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Toxen",
        submenu: [
          {
            label: "Toggle Menu",
            accelerator: "ESC",
            click() {
              Toxen.sidePanel.show();
              (document.activeElement as any)?.blur();
            }
          },
          {
            label: "Open Music",
            accelerator: "CTRL + M",
            click() {
              if (Toxen.isMode("Player")) {
                Toxen.sidePanel.show(true);
                Toxen.sidePanel.setSectionId("songPanel");
                (document.activeElement as any)?.blur();
              }
            }
          },
          {
            label: "Open Playlists",
            accelerator: "CTRL + P",
            click() {
              if (Toxen.isMode("Player")) {
                Toxen.sidePanel.show(true);
                Toxen.sidePanel.setSectionId("playlist");
                (document.activeElement as any)?.blur();
              }
            }
          },
          {
            label: "Open Settings",
            accelerator: "CTRL + S",
            click() {
              if (Toxen.isMode("Player")) {
                Toxen.sidePanel.show(true);
                Toxen.sidePanel.setSectionId("settings");
                (document.activeElement as any)?.blur();
              }
            }
          },
          {
            label: "Edit current song",
            accelerator: "CTRL + E",
            click() {
              if (Toxen.isMode("Player")) Toxen.editSong(Song.getCurrent());
            }
          },
          {
            label: "Toggle pause",
            accelerator: "Space",
            click(mi, win, e) {
              switch (document.activeElement.tagName) {
                // Exceptions
                case "INPUT":
                case "TEXTAREA":
                case "SELECT":
                case "BUTTON":
                  break;

                default: // Run toggling.
                  Toxen.musicPlayer.toggle();
                  break;
              }
            }
          },
          {
            type: "separator"
          },
          {
            label: "Reload Theme",
            accelerator: "CTRL + SHIFT + T",
            click() {
              Toxen.loadThemes();
              Toxen.notify({
                content: "Themes reloaded",
                expiresIn: 1000
              });
            }
          },
          {
            label: "Reload Storyboard",
            accelerator: "CTRL + SHIFT + S",
            click() {
              Song.getCurrent()?.applyStoryboard();
              Toxen.notify({
                content: "Storyboard reloaded",
                expiresIn: 1000
              });
            }
          }
        ]
      },
      {
        label: "Window",
        submenu: [
          {
            label: "Reload",
            accelerator: "CTRL + R",
            click() {
              getCurrentWindow().reload();
            }
          },
          {
            label: "Full screen",
            accelerator: "F11",
            click() {
              Toxen.toggleFullscreen();
            }
          },
          {
            label: "Toggle Miniplayer",
            accelerator: "CTRL + F11",
            click() {
              Toxen.toggleMiniplayer();
            }
          },
        ]
      },
      {
        label: "Tools",
        submenu: [
          {
            label: "Subtitle Editor" + (app.isPackaged ? " (Coming soon)" : " (Development Only)"),
            // accelerator: "F10",
            click() {
              Toxen.openSubtitleCreator(Song.getCurrent())
            },
            enabled: !app.isPackaged
          },
          {
            type: "separator"
          },
          {
            label: "Developer Console",
            accelerator: "F12",
            click() {
              let win = getCurrentWindow();
              win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
            }
          }
        ]
      }
    ])
  );


  
  // Render app
  // ReactDOM.render(toxenApp, document.querySelector("app-root"));
  const root = ReactDOMClient.createRoot(document.querySelector("app-root"));
  root.render(
    <MantineProvider forceColorScheme="dark">
      {/* <Notifications> */}
        <ModalsProvider>
          <ToxenAppRenderer />
        </ModalsProvider>
      {/* </Notifications> */}
    </MantineProvider>
    // <ToxenAppRenderer />
  );
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Hue bullshit

//#region Background tasks
// Inactivity functionality
let inactivityCounter = 3;
let resizing = -1;
setInterval(() => {
  if (inactivityCounter > 0) {
    inactivityCounter--;
  }
  else if (inactivityCounter === 0) {
    inactivityCounter = -1;
    document.body.classList.add("inactive");
  }

  if (resizing === 1) resizing = 0;
  else if (resizing === 0) {
    resizing = -1;
    if (Settings.get("restoreWindowSize")) {
      Settings.set("windowWidth", window.outerWidth);
      Settings.set("windowHeight", window.outerHeight);
      Settings.save({ suppressNotification: true });
    }
  }
}, 1000);

document.body.addEventListener("mousemove", () => {
  document.body.classList.remove("inactive");
  inactivityCounter = 3;
});

window.addEventListener("resize", () => {
  resizing = 1;
});

navigator.mediaSession.setActionHandler('previoustrack', () => {
  Toxen.musicPlayer.playPrev();
});

navigator.mediaSession.setActionHandler('nexttrack', () => {
  Toxen.musicPlayer.playNext();
});

Toxen.whenReady().then(async () => {
  // Count toxen times opened
  Stats.set("timesOpened", (Stats.get("timesOpened") ?? 0) + 1);
  Stats.save(); // Store when ready

  // Interval actions
  // Store seconds played
  setInterval(() => {
    if (!Toxen.musicPlayer.media.paused) Stats.set("secondsPlayed", (Stats.data.secondsPlayed ?? 0) + 1);
  }, 1000);

  // Save Stats
  setInterval(() => Stats.save(), 30000);
});

//#endregion