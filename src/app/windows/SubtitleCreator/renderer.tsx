import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { NotificationsProvider } from "@mantine/notifications";
import React from "react";
import ReactDOM from "react-dom";
import "../../ToxenApp.scss";
import AppBar from "../../components/AppBar/AppBar";
import "@fortawesome/fontawesome-free/js/all"; // Import FA
import "@fortawesome/fontawesome-free/scss/regular.scss";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import MusicPlayer from "../../components/MusicPlayer";
import MusicControls from "../../components/MusicControls";
import { Toxen } from "../../ToxenApp";

export default function SubtitleCreatorScreen() {

  return (
    <>
      <AppBar />
      {/* TODO: Include controls */}
      {/* Currently MusicControls directly manipulates settings, which it shouldn't. */}
      {/* Possibly solution: A prop that allows calls of settings to be disabled? */}
      <MusicPlayer ref={mp => Toxen.musicPlayer = mp} />
      {/* <MusicControls ref={mc => Toxen.musicControls = mc} /> */}
      <h1>This is a test to see if it works.</h1>
    </>
  );
}

// Render app
const toxenSubtitleScreen = (
  <MantineProvider theme={{
    colorScheme: "dark",
    colors: {
      white: ["fff000"],
    }
  }}>
    <NotificationsProvider>
      <ModalsProvider>
        <SubtitleCreatorScreen />
      </ModalsProvider>
    </NotificationsProvider>
  </MantineProvider>
);
ReactDOM.render(toxenSubtitleScreen, document.querySelector("app-root"));