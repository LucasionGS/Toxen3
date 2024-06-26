import React from "react";
import fs from "fs";
import fsp from "fs/promises";
import { Dirent } from "fs";
import Path from "path";
import Song from "./Song";
import { Toxen } from "../ToxenApp";
import ArrayX from "./ArrayX";
import ProgressBar from "../components/ProgressBar";
import * as remote from "@electron/remote";
import Settings from "./Settings";
import SubtitleParser from "./SubtitleParser";
import { Progress } from "@mantine/core";

export default class System {
  public static async recursive(path: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string = path) {
    let files = await fsp.readdir(path, { withFileTypes: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let newPath = Path.resolve(path, file.name);
      file.name = Path.relative(orgPath, newPath);

      if (file.isDirectory()) {
        let newFiles = await System.recursive(newPath, orgPath)
        files.push(...newFiles);
      }
    }

    return files;
  }

  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose?: boolean): Promise<void>;
  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose?: boolean, _initial?: boolean, _plusIndex?: number, _plusTotal?: number): Promise<void>;
  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose = true, _initial = true, _plusIndex = 0, _plusTotal = 0) {
    return Promise.resolve().then(async () => {
      if (files instanceof FileList) files = [...files];
      let sMedia = Toxen.getSupportedMediaFiles();
      let sImage = Toxen.getSupportedImageFiles();
      let sSubtitle = Toxen.getSupportedSubtitleFiles();

      const Content = (props: { children?: React.ReactNode }) => (
        <>
          {props.children}
          {/* <ProgressBar initialValue={0} max={files.length} /> */}
          <Progress value={((i ?? 0) + _plusIndex) / (files.length + _plusTotal) * 100} style={{
            width: "30vw",
          }} />
        </>
      );

      if (_initial) {
        Toxen.loadingScreen.toggleVisible(true);
        Toxen.loadingScreen.setContent(
          <Content>
            Preparing...
          </Content>
        );
      }

      let mediaPack = !_initial; // Only set to false if this is the first call of this function within itself.
      var i = 0;
      for (i = 0; i < files.length; i++) {
        const file = files[i];

        // If directory
        const stat: fs.Stats | null = await fsp.stat(file.path).then(a => a).catch(() => null);
        if (stat?.isDirectory()) {
          mediaPack = true;
          let dirFiles = await System.recursive(file.path);

          await System.handleImportedFiles(dirFiles.map(f => ({
            path: Path.resolve(file.path, Path.basename(f.name)),
            name: Path.basename(f.name)
          })), false, false, i, files.length);

          continue;
        }


        if (sMedia.some(ext => file.name.endsWith(ext))) {
          mediaPack = true;
          Toxen.loadingScreen.setContent(
            <Content>
              Importing {file.name}...
            </Content>
          );
          await Song.importSong(file).then(res => {
            if (res.isSuccess()) {
              Toxen.songList.push(res.data);
              if (verbose) Toxen.log(file.name + " imported successfully.", 500);
              Toxen.loadingScreen.setContent(
                <Content>
                  Imported {file.name}
                </Content>
              );
            }
            else if (res.isFailure()) {
              Toxen.error(res.message);
              Toxen.loadingScreen.setContent(
                <Content>
                  Unable to load {file.name}
                </Content>
              );
            }
          });
        }
        else if (sImage.some(ext => file.name.endsWith(ext))) {
          if (mediaPack) {
            if (verbose) Toxen.warn("Unable to mix media and images. Skipping image file.");
            continue;
          }

          let song = Song.getCurrent();
          if (!song) break;
          let imageName = song.paths.background || file.name; // name with extension
          let ext = Path.extname(imageName); // getting extension
          imageName = Path.basename(imageName, ext); // Removing extension for path testing
          imageName = imageName.replace(/^(.*?)(?:_\$tx(\d+))?$/, (_, $1: string, $2: string) => {
            return `${$1}_$tx${(+$2 || 0) + 1}`;
          });
          imageName += ext; // Reading the extension

          let dest = song.dirname(imageName);
          let prePic = song.backgroundFile() || null;
          await fsp.copyFile(file.path, dest).then(async () => {
            if (prePic !== dest && await fsp.stat(prePic).then(() => true).catch(() => false)) await fsp.rm(prePic);
            song.paths.background = Path.basename(dest);
            Toxen.background.setBackground(dest);
            song.saveInfo();
          })
            .catch((reason) => {
              Toxen.error("Unable to change background");
              Toxen.error(reason);
            });

          break;
        }
        else if (sSubtitle.some(ext => file.name.endsWith(ext))) {
          if (mediaPack) {
            if (verbose) Toxen.warn("Unable to mix media and subtitles. Skipping subtitle file.");
            continue;
          }

          let song = Song.getCurrent();
          if (!song) break;
          let subName = file.name; // name with extension

          let dest = song.dirname(subName);
          await fsp.copyFile(file.path, dest).then(async () => {
            song.paths.subtitles = Path.basename(dest);
            await song.saveInfo();
            song.applySubtitles();
          })
            .catch((reason) => {
              Toxen.error("Unable to change subtitles");
              Toxen.error(reason);
            });

          break;
        }
        // Unsupported
        else {
          if (verbose) Toxen.error(file.name + " is unsupported.");
        }
      }
      if (_initial) Toxen.loadingScreen.toggleVisible(false);

      if (_initial && mediaPack) {
        console.log("Media pack detected. Loading first song.");
        
        // Toxen.loadSongs();
        Toxen.songList[Toxen.songList.length - 1].play();
        Song.sortSongs(Toxen.songList);
        if (Toxen.sidePanel.getSectionId() === "songPanel") {
          Toxen.showCurrentSong();
          Toxen.songPanel.update();
        }
      }

      return Promise.resolve();
    });
  }

  public static async pathExists(path: string) {
    return fsp.stat(path).then(() => true).catch(() => false);
  }

  public static async exportFile(name: string, data: string | Buffer, fileFilters?: Electron.FileFilter[]) {
    let filters: Electron.FileFilter[] = [{ name: "All Files", extensions: ["*"] }];
    if (fileFilters) filters = filters = fileFilters;
    const newPath = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: "Export File",
      buttonLabel: "Export",
      filters: filters,
      defaultPath: name
    });
    if (!newPath.canceled) fsp.writeFile(newPath.filePath, data).then(() => {
      Toxen.log("Exported " + newPath.filePath, 3000);
    });
  }

  public static async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async logSleep(ms: number, ...args: any[]) {
    console.log(...args);
    await System.sleep(ms);
  }

  public static randomString(length: number) {
    let result = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

export interface ToxenFile {
  readonly name: string;
  readonly path: string;
}