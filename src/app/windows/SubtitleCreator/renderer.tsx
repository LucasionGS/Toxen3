import { Alert, Loader, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { NotificationsProvider } from "@mantine/notifications";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import "../../ToxenApp.scss";
import AppBar from "../../components/AppBar/AppBar";
import "@fortawesome/fontawesome-free/js/all"; // Import FA
import "@fortawesome/fontawesome-free/scss/regular.scss";
import "@fortawesome/fontawesome-free/scss/solid.scss";
import MusicPlayer from "../../components/MusicPlayer";
import MusicControls from "./components/MusicControls/MusicControls";
import { Toxen } from "../../ToxenApp";
import Song from "../../toxen/Song";
import { remote, ipcRenderer } from "electron";
import InitialData from "./models/InitialData";
import SubtitleParser from "../../toxen/SubtitleParser";
import fsp from "fs/promises";
import fs from "fs";
import Path from "path";
import Subtitles from "../../components/Subtitles/Subtitles";

export default function SubtitleCreatorScreen() {
  const [data, setData] = useState<InitialData>(null);
  const [subtitles, setSubtitles] = useState<SubtitleParser.SubtitleArray>(null);
  const [mediaPath, setMediaPath] = useState<string>(null);
  const [subtitlePath, setSubtitlePath] = useState<string>(null);
  useEffect(() => {
    ipcRenderer.on("song_to_edit", (event, songString: string) => {
      const init: InitialData = JSON.parse(songString);
      const { song, libraryDirectory } = init;
      const mediaPath = Path.resolve(libraryDirectory, song.paths.dirname, song.paths.media);
      setMediaPath(mediaPath);
      const subtitlePath = Path.resolve(libraryDirectory, song.paths.dirname, song.paths.subtitles);

      Promise.resolve().then(() => {
        const exists = !!song.paths.subtitles && fs.existsSync(subtitlePath);
        return exists ? fsp.readFile(subtitlePath, "utf8") : null;
      }).then(subtitleString => {
        if (subtitleString === null) {
          setSubtitles(new SubtitleParser.SubtitleArray());
        } else {
          const subs = SubtitleParser.parseByExtension(subtitleString, Path.extname(subtitlePath));
          setSubtitles(subs);
          console.log(subs);

          setSubtitlePath(subtitlePath);
        }
        console.log(init);
        setData(init);
      });
    });
    remote.getCurrentWindow().webContents.toggleDevTools();
  }, []);

  if (!data) return <>
    <AppBar />
    <Alert color="green">
      <p>
        <Loader /> Please wait while we load the song.
      </p>
    </Alert>
  </>

  const song = data.song;
  const musicPlayer: { current: MusicPlayer } = { current: null };
  return (
    <>
      <AppBar />
      {/* TODO: Include controls */}
      {/* Currently MusicControls directly manipulates settings, which it shouldn't. */}
      {/* Possibly solution: A prop that allows calls of settings to be disabled? */}
      <MusicPlayer useSubtitleEditorMode ref={mp => Toxen.musicPlayer = musicPlayer.current = mp} />
      <MusicControls ref={mc => Toxen.musicControls = mc} />
      <Subtitles ref={ref => {
        Toxen.subtitles = ref;

        Toxen.musicPlayer.setSource(mediaPath, true);
        Toxen.subtitles.setSubtitles(subtitles);
        // if (musicPlayer.current && !musicPlayer.current.media.src) {
        // }
      }} musicPlayer={musicPlayer} />
      <h1>
        {(song.artist || "Unknown") + " - " + (song.title || "Unknown")}
      </h1>
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