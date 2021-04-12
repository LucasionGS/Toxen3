import React from "react";
import fs from "fs";
import fsp from "fs/promises";
import { Dirent } from "fs";
import Path from "path";
import Song from "./Song";
import { Toxen } from "../ToxenApp";
import ArrayX from "./ArrayX";
import ProgressBar from "../components/ProgressBar";
import { remote } from "electron";

export default class System {
  public static async recursive(path: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string = path) {
    let files = await fsp.readdir(path, { withFileTypes: true });
    let newFiles: string[] = [];

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

  public static async handleImportedFiles(files: FileList | File[]) {
    Promise.resolve().then(async () => {
      if (files instanceof FileList) files = [...files];
      let sMedia = Toxen.getSupportedMediaFiles();
      let sImage = Toxen.getSupportedImageFiles();
      let sSubtitle = Toxen.getSupportedSubtitleFiles();
      
      const Content = (props: { children?: React.ReactNode }) => (
        <>
          {props.children}
          <ProgressBar initialValue={i ?? 0} max={files.length} />
        </>
      );
      
      Toxen.loadingScreen.show(true);
      Toxen.loadingScreen.setContent(
        <Content>
          Preparing...
        </Content>
      );
      
      let mediaPack = false;
      var i = 0;
      for (i = 0; i < files.length; i++) {
        const file = files[i];
        if (sMedia.some(ext => file.name.endsWith(ext))) {
          mediaPack = true;
          Toxen.loadingScreen.setContent(
            <Content>
              Importing {file.name}...
            </Content>
          );
          await Song.importSong(file).then(res => {
            if (res.isSuccess()) {
              Toxen.log(file.name + "\n" + file.path);
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
            else {
              Toxen.log(res);
            }
          });
        }
        else if (sImage.some(ext => file.name.endsWith(ext))) {
          if (mediaPack) {
            Toxen.warn("Unable to mix media and images. Skipping image file.");
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
          imageName += ext; // Readding the extension

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


        // Unsupported
        else {
          Toxen.log(file.name + " is unsupported.");
        }
      }
      Toxen.loadingScreen.show(false);

      if (mediaPack) {
        Toxen.loadSongs();
      }
    });
  }

  public static async pathExists(path: string) {
    return fsp.stat(path).then(() => true).catch(() => false);
  }
}