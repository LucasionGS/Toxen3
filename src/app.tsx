import React from "react";
import ReactDOM from "react-dom";
import { remote } from "electron";
import ToxenAppRenderer, { Toxen } from "./app/ToxenApp";
import "@fortawesome/fontawesome-free/js/all"; // Import FA
import "@fortawesome/fontawesome-free/scss/regular.scss";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import Settings from "./app/toxen/Settings";
import Song from "./app/toxen/Song";
import Converter from "./app/toxen/Converter";
import Stats from "./app/toxen/Statistics";
import navigator from "./navigator";
import User from "./app/toxen/User";

// Setup
// Create menu actions/shortcuts
remote.Menu.setApplicationMenu(
  remote.Menu.buildFromTemplate([
    {
      label: "Toxen",
      submenu: [
        {
          label: "Toggle menu panel",
          accelerator: "ESC",
          click() {
            Toxen.sidePanel.show();
            (document.activeElement as any)?.blur();
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
            remote.getCurrentWindow().reload();
          }
        }
      ]
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Developer Console",
          accelerator: "F12",
          click() {
            let win = remote.getCurrentWindow();
            win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
          }
        }
      ]
    }
  ])
);

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

// Render app
const toxenApp = <ToxenAppRenderer /> as React.ClassicElement<ToxenAppRenderer>;
ReactDOM.render(toxenApp, document.querySelector("app-root"));