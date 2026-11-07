import React from "react";
import Song from "./Song";
import Theme from "./Theme";
import { Toxen } from "../ToxenApp";
import { Progress } from "@mantine/core";
import Settings from "./Settings";
import { SongLibrary } from "./SongLibrary";
import { SongStorage } from "./storage/SongStorage";
import { StorageSelector } from "./storage/StorageSelector";

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
      let sStoryboard = Toxen.getSupportedStoryboardFiles();

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
        // Electron 32 removed File.path; resolve it through the controller once
        // per file. Empty string means "no filesystem path" (a browser File).
        const filePath = toxenapi.getFilePath(file);

        // If directory - Only on desktop, into a local library
        if (toxenapi.isDesktop() && StorageSelector.forLibrary().kind === SongStorage.Kind.Local) {
          const stat: import("fs").Stats | null = await toxenapi.fs.promises.stat(filePath).then(a => a).catch(() => null as any);
          if (stat?.isDirectory()) {
            mediaPack = true;
            let dirFiles = await System.recursive(filePath);

            await System.handleImportedFiles(dirFiles.map(f => ({
              path: toxenapi.path.resolve(filePath, toxenapi.path.basename(f.name)),
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
          await SongLibrary.importMedia(file).then(res => {
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
          
          // Always use the new file name to avoid overwriting existing backgrounds
          // since users can now delete backgrounds if they want to remove them
          let imageName = file.name; // name with extension
          const existing = await song.listFiles().catch((): string[] => []);
          if (existing.includes(imageName)) {
            const ext = toxenapi.getFileExtension(imageName);
            const baseName = imageName.slice(0, imageName.length - ext.length);
            let counter = 1;
            do {
              imageName = `${baseName}_${counter}${ext}`;
              counter++;
            } while (existing.includes(imageName));
          }

          try {
            await song.storage.writeFile(song, imageName, System.toWriteData(file, filePath));
            // Invalidate cache for old background before changing
            Toxen.invalidateSongBackgroundCache(song);

            // Set the new background file without deleting the old one
            // since users can now manually delete backgrounds if they want to
            song.paths.background = imageName;
            await song.saveInfo();
            if (song.storage.kind === SongStorage.Kind.Cloud) Toxen.log("Uploaded background image", 3000);
            Toxen.background.setBackground(song.backgroundFile() + "?h=" + song.hash);
          } catch (reason) {
            Toxen.error("Unable to change background");
            Toxen.error(`${reason}`);
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

          try {
            await song.storage.writeFile(song, subName, System.toWriteData(file, filePath));
            song.paths.subtitles = subName;
            await song.saveInfo();
            if (song.storage.kind === SongStorage.Kind.Cloud) Toxen.log("Uploaded subtitle file", 3000);
            song.applySubtitles();
          } catch (reason) {
            Toxen.error("Unable to change subtitles");
            Toxen.error(`${reason}`);
          }

          break;
        }
        // Storyboard files
        else if (sStoryboard.some(ext => file.name.endsWith(ext))) {
          if (mediaPack) {
            if (verbose) Toxen.warn("Unable to mix media and storyboard files. Skipping storyboard file.");
            continue;
          }

          let song = Song.getCurrent();
          if (!song) break;
          let sbName = file.name;

          try {
            await song.storage.writeFile(song, sbName, System.toWriteData(file, filePath));
            song.paths.storyboard = sbName;
            await song.saveInfo();
            if (song.storage.kind === SongStorage.Kind.Cloud) Toxen.log("Uploaded storyboard file", 3000);
            await song.applyStoryboard();
          } catch (reason) {
            Toxen.error("Unable to change storyboard");
            Toxen.error(`${reason}`);
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
            
            if (toxenapi.isDesktop() && filePath) {
              // Desktop: read from file path
              themeData = await toxenapi.fs.promises.readFile(filePath, 'utf8');
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
        // Theme archive files
        else if (file.name.endsWith('.theme.zip')) {
          if (!toxenapi.isDesktop()) {
            if (verbose) Toxen.error("Importing .theme.zip archives is only available on the desktop version.");
            continue;
          }

          Toxen.loadingScreen.setContent(
            <Content>
              Importing theme archive {file.name}...
            </Content>
          );

          try {
            const theme = await toxenapi.importThemeArchive(filePath, Theme);

            const existingIndex = Toxen.themes.findIndex(t => t.name === theme.name);
            if (existingIndex === -1) {
              Toxen.themes.push(theme);
            } else {
              Toxen.themes[existingIndex] = theme;
            }

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
            Toxen.error(`Failed to import theme archive ${file.name}: ${error.message}`);
            Toxen.loadingScreen.setContent(
              <Content>
                Failed to import {file.name}
              </Content>
            );
          }
        }
        // Toxen song package (.txz)
        else if (file.name.endsWith(".txz")) {
          mediaPack = true;
          Toxen.loadingScreen.setContent(
            <Content>
              Importing song package {file.name}...
            </Content>
          );

          try {
            if (toxenapi.isDesktop() && StorageSelector.forLibrary().kind === SongStorage.Kind.Local) {
              // Desktop local import
              const libDir = Settings.get("libraryDirectory");
              const info = await toxenapi.importTxzPackage(filePath, libDir);
              const song = Song.create(info);
              Toxen.songList.push(song);

              Toxen.loadingScreen.setContent(
                <Content>
                  Imported {song.getDisplayName()}
                </Content>
              );

              if (verbose) {
                Toxen.log(`Imported song package: ${song.getDisplayName()}`, 3000);
              }
            } else {
              // Web / remote import: upload .txz to server
              const user = Settings.getUser();
              if (!user) {
                Toxen.error("Not logged in. Cannot import song package.");
                continue;
              }

              const uid = Song.generateUID();
              const formData = new FormData();

              let fileBlob: Blob;
              if (file instanceof File) {
                fileBlob = file;
              } else if (toxenapi.isDesktop() && filePath) {
                const buf = await toxenapi.fs.promises.readFile(filePath);
                fileBlob = new Blob([new Uint8Array(buf)]);
              } else {
                throw new Error("Unable to read .txz file");
              }

              formData.append("file", fileBlob, file.name);

              const res = await Toxen.fetch(`${user.getCollectionPath()}/import/${uid}`, {
                method: "POST",
                body: formData,
              });

              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Upload failed" }));
                throw new Error(err.error || "Failed to import song package");
              }

              const info = await res.json();
              const song = Song.create(info);
              Toxen.songList.push(song);

              Toxen.loadingScreen.setContent(
                <Content>
                  Imported {song.getDisplayName()}
                </Content>
              );

              if (verbose) {
                Toxen.log(`Imported song package: ${song.getDisplayName()}`, 3000);
              }
            }
          } catch (error) {
            console.error("Failed to import .txz package:", error);
            Toxen.error(`Failed to import ${file.name}: ${error.message}`);
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

  /**
   * What to hand `SongStorage.writeFile` for an imported file: its path on disk when it has one, otherwise its bytes.
   */
  public static toWriteData(file: File | ToxenFile, filePath: string): SongStorage.WriteData {
    if (filePath) return { diskPath: filePath };
    if (typeof File !== "undefined" && file instanceof File) return file;
    throw new Error(`Unable to read ${file.name}: it has no file path.`);
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