import React from "react";
import Song from "./Song";
import Theme from "./Theme";
import { Toxen } from "../ToxenApp";
import { Progress } from "@mantine/core";
import Settings from "./Settings";

export default class System {
  public static async recursive(path: string): Promise<{ name: string }[]>;
  public static async recursive(path: string, orgPath: string): Promise<{ name: string }[]>;
  public static async recursive(path: string, orgPath: string = path) {
    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly("recursive");
    }
    
    let files = await toxenapi.fs.promises.readdir(path, { withFileTypes: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let newPath = toxenapi.path.resolve(path, file.name);
      file.name = toxenapi.path.relative(orgPath, newPath);

      if (file.isDirectory()) {
        let newFiles = await System.recursive(newPath, orgPath)
        files.push(...newFiles as any); // This works fine assuming Desktop checks works, but TypeScript disagrees.
      }
    }

    return files;
  }

  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose?: boolean): Promise<void>;
  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose?: boolean, _initial?: boolean, _plusIndex?: number, _plusTotal?: number): Promise<void>;
  public static async handleImportedFiles(files: FileList | (File | ToxenFile)[], verbose = true, _initial = true, _plusIndex = 0, _plusTotal = 0) {
    // if (!toxenapi.isDesktop()) {
    //   return toxenapi.throwDesktopOnly("handleImportedFiles"); // This does work on web, but this is for safety checks.
    // }
    // Desktop version
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
      var i = 0; // Not entirely sure why this is here??? Was I silly? im keeping it
      for (i = 0; i < files.length; i++) {
        const file = files[i];

        // If directory - Only on desktop
        if (toxenapi.isDesktop() && !Settings.isRemote()) {
          const stat: import("fs").Stats | null = await toxenapi.fs.promises.stat(file.path).then(a => a).catch(() => null as any);
          if (stat?.isDirectory()) {
            mediaPack = true;
            let dirFiles = await System.recursive(file.path);
  
            await System.handleImportedFiles(dirFiles.map(f => ({
              path: toxenapi.path.resolve(file.path, toxenapi.path.basename(f.name)),
              name: toxenapi.path.basename(f.name)
            })), false, false, i, files.length);
  
            continue;
          }
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
          // let ext = toxenapi.getFileExtension(imageName); // getting extension
          // imageName = toxenapi.getBasename(imageName, ext); // Removing extension for path testing
          // imageName = imageName.replace(/^(.*?)(?:_\$tx(\d+))?$/, (_, $1: string, $2: string) => {
          //   return `${$1}_$tx${(+$2 || 0) + 1}`;
          // });
          // imageName += ext; // Reading the extension

          if (toxenapi.isLocal(Settings)) {
            let dest = song.dirname(imageName);
            let prePic = song.backgroundFile() || null;
            const postProcess = async () => {
              // if (prePic !== dest && await toxenapi.fs.promises.stat(prePic).then(() => true).catch(() => false))
              // {
              //   await toxenapi.fs.promises.rm(prePic);
              //   const local = toxenapi.path.relative(song.dirname(), prePic);
              //   song.setFile(local, "d");
              // }
              song.paths.background = toxenapi.getBasename(dest);
              song.setFile(song.paths.background = toxenapi.getBasename(dest), "u");
              await song.saveInfo();
              Toxen.background.setBackground(dest + "?h=" + song.hash);
            };

            if (file.path == "" && file instanceof File) { // Likely a web file
              await toxenapi.fs.promises.writeFile(dest, file.stream()).then(postProcess)
            }
            else {
              await toxenapi.fs.promises.copyFile(file.path, dest).then(postProcess)
              .catch((reason) => {
                Toxen.error("Unable to change background");
                Toxen.error(reason);
              });
            }

          }
          else if (file instanceof File) {
            // let reader = new FileReader();
            // let base64 = reader.result as string;
            song.paths.background = imageName;

            // Upload to server
            let filetime = Date.now();
            song.setFile(imageName, "u", filetime);
            await Toxen.fetch(`${song.backgroundFile()}`, {
              method: "PUT",
              body: file
            }).then(() => {
              Toxen.log("Uploaded background image", 3000);
            }).catch((reason) => {
              Toxen.error("Unable to upload background image");
              Toxen.error(reason);
            });
            
            await song.saveInfo();
            Toxen.background.setBackground(song.backgroundFile() + "?h=" + song.hash);
            // reader.onload = async () => {
            // }
            // reader.readAsDataURL(file);
          }
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

          if (toxenapi.isLocal(Settings)) {
            let dest = song.dirname(subName);
            await toxenapi.fs.promises.copyFile(file.path, dest).then(async () => {
              song.paths.subtitles = toxenapi.getBasename(dest);
              song.setFile(subName, "u");
              await song.saveInfo();
              song.applySubtitles();
            })
              .catch((reason) => {
                Toxen.error("Unable to change subtitles");
                Toxen.error(reason);
              });
          }
          else if (file instanceof File) {
            let reader = new FileReader();
            reader.onload = async () => {
              song.paths.subtitles = subName;

              // Upload to server
              let filetime = Date.now();
              song.setFile(subName, "u", filetime);
              await Toxen.fetch(`${song.subtitleFile()}`, {
                method: "PUT",
                body: file
              }).then(() => {
                Toxen.log("Uploaded subtitle file", 3000);
              }).catch((reason) => {
                Toxen.error("Unable to upload subtitle file");
                Toxen.error(reason);
              });

              song.setFile(subName, "u");
              await song.saveInfo();
              song.applySubtitles();
            }
            reader.readAsDataURL(file);
          }

          break;
        }
        // Theme files
        else if (file.name.endsWith('.theme.json')) {
          Toxen.loadingScreen.setContent(
            <Content>
              Importing theme {file.name}...
            </Content>
          );

          try {
            let themeData: string;
            
            if (toxenapi.isDesktop() && file.path) {
              // Desktop: read from file path
              themeData = await toxenapi.fs.promises.readFile(file.path, 'utf8');
            } else if (file instanceof File) {
              // Web or dropped file: read from File object
              themeData = await file.text();
            } else {
              throw new Error("Unable to read theme file");
            }

            // Parse and validate theme data
            const themeObject = JSON.parse(themeData);
            if (!themeObject.name || !themeObject.styles) {
              throw new Error("Invalid theme file format");
            }

            // Create theme instance
            const theme = Theme.create(themeObject);
            
            // Save the theme
            await theme.save();
            
            // Add to themes list if not already present
            const existingIndex = Toxen.themes.findIndex(t => t.name === theme.name);
            if (existingIndex === -1) {
              Toxen.themes.push(theme);
            } else {
              Toxen.themes[existingIndex] = theme;
            }
            
            // Apply the theme immediately
            Toxen.setTheme(theme);
            
            if (verbose) {
              Toxen.log(`Theme "${theme.displayName || theme.name}" imported and applied successfully.`, 3000);
            }
            
            Toxen.loadingScreen.setContent(
              <Content>
                Imported theme {theme.displayName || theme.name}
              </Content>
            );
          } catch (error) {
            Toxen.error(`Failed to import theme ${file.name}: ${error.message}`);
            Toxen.loadingScreen.setContent(
              <Content>
                Failed to import {file.name}
              </Content>
            );
          }
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
    if (toxenapi.isDesktop()) {
      return toxenapi.fs.promises.stat(path).then(() => true).catch(() => false);
    }
    else {
      toxenapi.throwDesktopOnly("pathExists");
    }
  }

  public static async exportFile(name: string, data: string | Buffer, fileFilters?: { name: string, extensions: string[] }[]) {
    if (!toxenapi.isDesktop()) {
      return toxenapi.throwDesktopOnly("exportFile");
    }
    let filters: { name: string, extensions: string[] }[] = [{ name: "All Files", extensions: ["*"] }];
    if (fileFilters) filters = filters = fileFilters;
    const newPath = await toxenapi.remote.dialog.showSaveDialog(toxenapi.remote.getCurrentWindow(), {
      title: "Export File",
      buttonLabel: "Export",
      filters: filters,
      defaultPath: name
    });
    if (!newPath.canceled) toxenapi.fs.promises.writeFile(newPath.filePath, data as any).then(() => { // TODO: Might need fix? (data as any)
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

  public static isWindows() {
    return toxenapi.isDesktop() && toxenapi.remote.process.platform === "win32";
  }

  public static isMac() {
    return toxenapi.isDesktop() && toxenapi.remote.process.platform === "darwin";
  }

  public static isLinux() {
    return toxenapi.isDesktop() && toxenapi.remote.process.platform === "linux";
  }
}

export interface ToxenFile {
  readonly name: string;
  readonly path: string;
}