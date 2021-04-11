import React from "react";
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

  public static async handleDroppedFiles(files: FileList | File[]) {
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
          Loading files...
        </Content>
      );

      let mediaPack = false;
      var i = 0;
      for (i = 0; i < files.length; i++) {
        const file = files[i];
        if (sMedia.some(ext => file.name.endsWith(ext))) {
          mediaPack = true;
          await Song.importSong(file).then(res => {
            if (res.isSuccess()) {
              Toxen.log(file.name + "\n" + file.path);
              Toxen.loadingScreen.setContent(
                <Content>
                  {file.name}
                  <br />
                  {file.path}
                </Content>
              );
            }
            else if (res.isFailure()) {
              Toxen.log(res.message);
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
          };

          let song = Song.getCurrent();
          if (!song) break;
          let dest = song.backgroundFile() || song.dirname(file.name);
          await fsp.copyFile(file.path, dest);
          song.paths.background = Path.basename(dest);

          // This makes sure the image changes when you just change it... but it will keep cache for the rest of the program until restart.
          let dataUrl = remote.nativeImage.createFromPath(dest).toDataURL();
          Toxen.background.setBackground(dataUrl);

          song.saveInfo();
        }


        // Unsupported
        else {
          Toxen.log(file.name + " is unsupported.");
        }
      }

      Toxen.loadingScreen.show(false);
      // if (handled >= files.length) {
      // }
    });
  }
}