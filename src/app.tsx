import React from "react";
import ReactDOM from "react-dom";
import { remote } from "electron";
import ToxenApp, { Toxen } from "./app/ToxenApp";
import "@fortawesome/fontawesome-free/js/all"; // Import FA

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
            Toxen.sidePanel.toggle();
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

// Inactivity functionality
let inactivityCounter = 3;
setInterval(() => {
  if (inactivityCounter > 0) {
    inactivityCounter--;
  }
  else if (inactivityCounter === 0) {
    inactivityCounter = -1;
    document.body.classList.add("inactive");
  }
}, 1000)
document.body.addEventListener("mousemove", () => {
  document.body.classList.remove("inactive");
  inactivityCounter = 3;
});

// Render app
const toxenApp = <ToxenApp /> as React.ClassicElement<ToxenApp>;
ReactDOM.render(toxenApp, document.querySelector("app-root"));