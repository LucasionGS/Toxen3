import ToxenController from "./ToxenController";
import React from "react";
import Path from "path";
import fs, { Dir, Dirent } from "fs";
import fsp from "fs/promises";
//@ts-ignore
import os from "os";
import * as remote from "@electron/remote";
import CrossPlatform from "../app/toxen/desktop/CrossPlatform";
import type Settings from "../app/toxen/Settings";
import { ISettings } from "../app/toxen/Settings";
import type Stats from "../app/toxen/Statistics";
import { IStatistics } from "../app/toxen/Statistics";
import type Theme from "../app/toxen/Theme";
import Ytdlp from "../app/toxen/desktop/Ytdlp";
import Ffmpeg from "../app/toxen/desktop/Ffmpeg";
import ffmpegPath from "ffmpeg-static";
import yazl from "yazl";
import yauzl from "yauzl";
import Song, { type SongDiff } from "../app/toxen/Song"; // can i import? I forgor 💀
import type { Toxen } from "../app/ToxenApp";
import type User from "../app/toxen/User";
import { hashElement } from "folder-hash";
import { } from "buffer";
import packageJson from "../../package.json";
import { ISong } from "../app/toxen/Song";
import System from "../app/toxen/System";
import { Checkbox, Menu, RangeSlider, Button, Progress, Group, Stack } from "@mantine/core";
import { hideNotification, updateNotification } from "@mantine/notifications";
import Discord from "../app/toxen/desktop/Discord";
import TaskbarControls from "../app/toxen/desktop/TaskbarControls";

/**
 * DesktopController is a controller for desktop-specific functions. Overwrites the web version of the controller.
 */
export default class DesktopController extends ToxenController {
  constructor() {
    super();
    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Hue bullshit
  }
  
  public packageJson = packageJson;
  
  public isDesktop(): this is DesktopController { return true; }
  CrossPlatform = CrossPlatform;
  public remote = remote;

  public joinPath(...paths: string[]) {
    return Path.join(...paths);
  }

  public fs = fs;
  public path = Path;
  public os = os;

  /**
   * Save Toxen's current settings file.
   */
  private readonly settingsFilePath = CrossPlatform.getToxenDataPath("settings.json");

  /**
   * Save Toxen's current settings.
   */
  public async saveSettings($settings: typeof Settings) {
    if (!(await fsp.stat(this.CrossPlatform.getToxenDataPath()).then(() => true).catch(() => false))) {
      await fsp.mkdir(this.CrossPlatform.getToxenDataPath(), { recursive: true });
    }
    
    return new Promise<void>((resolve, reject) => {
      let ws = fs.createWriteStream(this.settingsFilePath);
      ws.write(Buffer.from($settings.toString()));
      ws.close(() => resolve());
    })
  }

  /**
   * Load Toxen's settings from the settings's filepath.
   */
  public async loadSettings($settings: typeof Settings): Promise<ISettings> {
    if (!(await fsp.stat(this.settingsFilePath).then(() => true).catch(() => false))) {
      const musicPath = Path.resolve(os.homedir(), "Music", "ToxenMusic");
      if (await fsp.stat(musicPath).then(() => false).catch(() => true)) {
        await fsp.mkdir(musicPath, { recursive: true });
      }
      await $settings.applyDefaultSettings({
        libraryDirectory: musicPath
      });
      await $settings.save();
    }
    try {
      let data = await fsp.readFile(this.settingsFilePath, "utf8");
      $settings.data = JSON.parse(data);
      await $settings.applyDefaultSettings();
      return $settings.data;
    } catch (error) {
      throw "Unable to parse settings file";
    }
  }

  public readonly statisticsFilePath = CrossPlatform.getToxenDataPath("statistics.json");
  
  /**
   * Save Toxen's current statistics.
   */
  public async saveStats($stats: typeof Stats) {
    if (!(await fsp.stat(CrossPlatform.getToxenDataPath()).then(() => true).catch(() => false))) {
      await fsp.mkdir(CrossPlatform.getToxenDataPath(), { recursive: true });
    }
    return new Promise<void>((resolve, reject) => {
      let ws = fs.createWriteStream(this.statisticsFilePath);
      ws.write(Buffer.from($stats.toString()));
      ws.close(() => resolve());
    })
  }

  /**
   * Load Toxen's statistics from the statistics's filepath.
   */
  public async loadStats($stats: typeof Stats): Promise<IStatistics> {
    if (!(await fsp.stat(this.statisticsFilePath).then(() => true).catch(() => false))) {
      await $stats.save();
    }
    try {
      let data = await fsp.readFile(this.statisticsFilePath, "utf8");
      return $stats.data = JSON.parse(data);
    } catch (error) {
      throw "Unable to parse statistics file";
    }
  }

  public readonly themeFolderPath = CrossPlatform.getToxenDataPath("themes");
  
  public async saveTheme(theme: Theme): Promise<void> {
    const themeDir = Path.resolve(this.themeFolderPath, theme.name);
    const isFolderTheme = (
      (theme.backgroundImage && !theme.backgroundImage.startsWith("data:"))
      || (theme.sidepanelImage && !theme.sidepanelImage.startsWith("data:"))
      || fs.existsSync(themeDir) && fs.statSync(themeDir).isDirectory()
    );

    if (isFolderTheme) {
      await fsp.mkdir(themeDir, { recursive: true });
      const data = JSON.stringify(theme, null, 2);
      await fsp.writeFile(Path.resolve(themeDir, "theme.json"), data);
      // Remove old single-file theme if it exists
      const oldFile = Path.resolve(this.themeFolderPath, `${theme.name}.theme.json`);
      if (fs.existsSync(oldFile)) {
        await fsp.unlink(oldFile);
      }
    } else {
      const data = JSON.stringify(theme, null, 2);
      await fsp.writeFile(Path.resolve(this.themeFolderPath, `${theme.name}.theme.json`), data);
    }
  }
  
  public async loadThemes($toxen: typeof Toxen, $theme: typeof Theme): Promise<Theme[]> {
    const themes: Theme[] = await fsp.readdir(this.themeFolderPath, { withFileTypes: true }).then(async (entries) => {
      const themePromises: Promise<Theme | null>[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".theme.json")) {
          // Auto-convert single-file theme to folder structure
          themePromises.push(
            (async () => {
              try {
                const filePath = Path.resolve(this.themeFolderPath, entry.name);
                const data = await fsp.readFile(filePath, "utf8");
                const themeData = JSON.parse(data);
                const themeName = entry.name.replace(/\.theme\.json$/, "");
                const themeDir = Path.resolve(this.themeFolderPath, themeName);

                // Create folder and write theme.json
                await fsp.mkdir(themeDir, { recursive: true });
                await fsp.writeFile(Path.resolve(themeDir, "theme.json"), data);

                // Migrate .theme.css -> custom.css if it exists
                const cssFile = Path.resolve(this.themeFolderPath, `${themeName}.theme.css`);
                if (fs.existsSync(cssFile)) {
                  await fsp.rename(cssFile, Path.resolve(themeDir, "custom.css"));
                }

                // Remove the old single-file
                await fsp.unlink(filePath);

                const theme = $theme.create(themeData);
                theme.name = themeName;
                return theme;
              } catch (error) {
                $toxen.error(`Failed to load/convert theme ${entry.name}: ${error.message}`);
                return null;
              }
            })()
          );
        } else if (entry.isDirectory()) {
          // Folder-based theme: look for theme.json inside
          const themeJsonPath = Path.resolve(this.themeFolderPath, entry.name, "theme.json");
          themePromises.push(
            fsp.readFile(themeJsonPath, "utf8").then((data) => {
              try {
                const theme = $theme.create(JSON.parse(data));
                // Ensure theme name matches folder name
                theme.name = entry.name;
                return theme;
              } catch (error) {
                $toxen.error(`Failed to load theme ${entry.name}: ${error.message}`);
                return null;
              }
            }).catch(() => null) // No theme.json in directory, skip
          );
        }
      }

      return (await Promise.all(themePromises)).filter(theme => theme !== null);
    }).catch(async (): Promise<Theme[]> => {
      await fsp.mkdir(this.themeFolderPath, { recursive: true });
      return [];
    });

    return themes;
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   * Checks both single-file format ({name}.theme.css) and folder format ({name}/custom.css).
   */
  public loadThemeExternalCSS(theme: Theme) {
    // Check single-file format: {name}.theme.css
    const singleFileCssPath = Path.resolve(this.themeFolderPath, `${theme.name}.theme.css`);
    // Check folder format: {name}/custom.css
    const folderCssPath = Path.resolve(this.themeFolderPath, theme.name, "custom.css");

    let cssPath: string | null = null;
    if (fs.existsSync(singleFileCssPath)) {
      cssPath = singleFileCssPath;
    } else if (fs.existsSync(folderCssPath)) {
      cssPath = folderCssPath;
    }

    if (cssPath) {
      const css = fs.readFileSync(cssPath, "utf8");
      if (theme.customCSS && theme.customCSS.trim()) {
        theme.customCSS += "\n\n/* External CSS */\n" + css;
      } else {
        theme.customCSS = css;
      }
    }
  }

  /**
   * Copy an image file into a theme's folder, returning the filename for theme.json.
   */
  public async saveThemeImage(themeName: string, imageType: "background" | "sidepanel", sourcePath: string): Promise<string> {
    const themeDir = Path.resolve(this.themeFolderPath, themeName);
    await fsp.mkdir(themeDir, { recursive: true });

    const ext = Path.extname(sourcePath);
    const targetFilename = imageType === "background" ? `background${ext}` : `sidepanel${ext}`;
    const targetPath = Path.resolve(themeDir, targetFilename);

    await fsp.copyFile(sourcePath, targetPath);
    return targetFilename;
  }

  /**
   * Remove a theme image file from the theme's folder.
   */
  public async removeThemeImage(themeName: string, imageFilename: string): Promise<void> {
    const filePath = Path.resolve(this.themeFolderPath, themeName, imageFilename);
    if (fs.existsSync(filePath)) {
      await fsp.unlink(filePath);
    }
  }

  /**
   * Import a .theme.zip archive, extracting it into the themes folder.
   */
  public async importThemeArchive(zipPath: string, $theme: typeof Theme): Promise<Theme> {
    return new Promise<Theme>((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const fileEntries: Array<{ fileName: string; chunks: Buffer[] }> = [];

        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
          } else {
            const fileEntry: { fileName: string; chunks: Buffer[] } = {
              fileName: entry.fileName,
              chunks: [],
            };
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              readStream.on("data", (chunk: Buffer) => fileEntry.chunks.push(chunk));
              readStream.on("end", () => {
                fileEntries.push(fileEntry);
                zipfile.readEntry();
              });
              readStream.on("error", reject);
            });
          }
        });

        zipfile.on("end", async () => {
          try {
            const themeJsonEntry = fileEntries.find(e => Path.basename(e.fileName) === "theme.json");
            if (!themeJsonEntry) {
              throw new Error("No theme.json found in archive");
            }

            const themeData = JSON.parse(Buffer.concat(themeJsonEntry.chunks).toString("utf8"));
            if (!themeData.name || !themeData.styles) {
              throw new Error("Invalid theme.json: missing name or styles");
            }

            const themeName = themeData.name.replace(/[^a-zA-Z0-9\(\)\[\]\{\}\.\-\_\s]/g, "_");
            const themeDir = Path.resolve(this.themeFolderPath, themeName);
            await fsp.mkdir(themeDir, { recursive: true });

            for (const entry of fileEntries) {
              const outPath = Path.resolve(themeDir, entry.fileName);
              const outDir = Path.dirname(outPath);
              await fsp.mkdir(outDir, { recursive: true });
              await fsp.writeFile(outPath, Buffer.concat(entry.chunks));
            }

            themeData.name = themeName;
            resolve($theme.create(themeData));
          } catch (error) {
            reject(error);
          }
        });

        zipfile.on("error", reject);
      });
    });
  }

  public getYtdlp() {
    return new Ytdlp(CrossPlatform.getToxenDataPath(os.platform() === "win32" ? "ytdlp.exe" : "ytdlp"));
  }
  
  private _ffmpeg: Ffmpeg;
  /**
   * Get the Ffmpeg instance. Cached after first call.
   * Derives the ffprobe path from the ffmpeg-static binary path so that
   * fluent-ffmpeg's ffprobe API works when the full FFmpeg suite is present.
   */
  public get ffmpeg() {
    if (!this._ffmpeg) {
      // ffmpeg-static bundles ffmpeg (and often ffprobe) in the same directory.
      // Derive the sibling ffprobe path; the Ffmpeg constructor ignores it if absent.
      const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
      this._ffmpeg = new Ffmpeg(ffmpegPath, ffprobePath);
    }
    return this._ffmpeg;
  }

  public async exportLocalSongs(...songs: Song[]) {
    // Zip all songs into one file, in separate folders
    const zip = new yazl.ZipFile();
    const zipPathTmp = Path.resolve(os.tmpdir(), "toxen-export-" + Math.random().toString().substr(2) + ".zip");
    // Pipe the zip file to the file system
    const zipStream = fs.createWriteStream(zipPathTmp);
    zip.outputStream.pipe(zipStream);

    for (const song of songs) {
      const songPath = Path.resolve(song.dirname());
      zip.addReadStream(fs.createReadStream(songPath), Path.basename(song.uid || songPath));
    }

    zip.end();

    // Wait for the zip file to be written
    return await new Promise<void>((resolve, reject) => {
      zipStream.on("finish", resolve);
      zipStream.on("error", reject);
    })
      .then(() => {
        // Open the zip file in the user's default program
        return open(zipPathTmp);
      }).then(() => {
        // Delete the zip file
        return fsp.unlink(zipPathTmp);
      }).catch(error => {
        console.error(error);
        return fsp.unlink(zipPathTmp);
      });
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  public async transcribeWithWhisper($toxen: typeof Toxen, $song: typeof Song, song: Song): Promise<void> {
    const audioPath = song.mediaFile();
    
    if (!audioPath) {
      throw new Error("No audio file found for this song.");
    }
    
    // Show loading notification
    $toxen.log("Starting Whisper transcription... This may take a few minutes.", 0);
    
    // Import child_process dynamically
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Run whisper command
    const command = `whisper "${audioPath}" -f srt -o "${song.dirname("_whisper")}"`;
    
    await execAsync(command, {
      cwd: song.dirname(),
      timeout: 600000, // 10 minutes timeout
    });

    // Get generated file from the output directory (It should be the only .srt file)
    const outputName = Path.basename(song.uid || song.dirname(), Path.extname(song.uid || song.dirname()));
    const outputDir = song.dirname("_whisper");
    const files = await fsp.readdir(outputDir);
    const srtFiles = files.filter(file => file.endsWith('.srt'));
    if (srtFiles.length === 0) {
      throw new Error("No subtitle file generated by Whisper.");
    }

    if (srtFiles.length > 1) {
      $toxen.warn("Multiple subtitle files found. Using the first one.");
    }

    // Use the first .srt file found
    const firstSrtFile = srtFiles[0];
    const srtFilePath = Path.join(outputDir, firstSrtFile);
    // Move the generated file to the song's subtitles path
    const generatedFile = `${outputName}.srt`;
    await fsp.rename(srtFilePath, Path.join(song.dirname(), generatedFile));

    // Delete the temporary whisper directory
    await fsp.rmdir(outputDir, { recursive: true });
    
    // Set the generated subtitle file
    song.paths.subtitles = generatedFile;
    await song.saveInfo();
    
    // Apply subtitles if this is the current song
    const current = Song.getCurrent();
    if (song === current) {
      await current.applySubtitles();
    }
    
    $toxen.log(`Whisper transcription completed! Generated: ${generatedFile}`);
  }

  public async syncSong($toxen: typeof Toxen, user: User, song: Song, diff: SongDiff, { silenceValidated }: { silenceValidated?: boolean; }): Promise<void> {
    song.setProgressBar(0.10);

    if (diff.download === "*") {
      // Download entire song from remote (new server-only song)
      const localDir = song.dirnameLocal();
      song.setProgressBar(0.20);

      // Fetch file listing from server
      const fileList: string[] = await $toxen.fetch(`${user.getCollectionPath()}/${song.uid}`)
        .then(res => res.ok ? res.json() : []);

      if (fileList.length === 0) {
        $toxen.error(`No files found on server for ${song.getDisplayName()}`);
        song.setProgressBar(0);
        return;
      }

      // Ensure local directory exists
      await fsp.mkdir(localDir, { recursive: true });

      let downloaded = 0;
      for (const fileName of fileList) {
        const filePath = Path.resolve(localDir, fileName);
        await fsp.mkdir(Path.dirname(filePath), { recursive: true });

        const res = await $toxen.fetch(`${user.getCollectionPath()}/${song.uid}/${fileName}`);
        if (res.ok) {
          await fsp.writeFile(filePath, (await res.blob()).stream());
          console.log("Downloaded file:", fileName);
        } else {
          console.error("Failed to download file:", fileName);
        }
        downloaded++;
        song.setProgressBar(0.20 + (downloaded / fileList.length) * 0.75);
      }

      // Reload song info from the downloaded info.json
      await song.reload();
      song.completeProgressBar();

      if (!silenceValidated) {
        $toxen.log(`Downloaded new track: ${song.getDisplayName()}`, 1500);
      }
      return;
    }
    
    if (diff.upload === "*") {
      // Sync from disk to remote (Using archiver to zip the folder in memory)
      song.setProgressBar(0.25);
      
      // Before zipping, ensure ALL files have an md5 hash
      const files = await System.recursive(song.dirname());
      let madeChange = false;
      await Promise.resolve(files.map(async (file) => {
        file.name = file.name.replace(/\\/g, "/");

        if (!song.files[file.name]) {
          song.files[file.name] = {
            action: "u",
            time: Date.now()
          };
          madeChange = true;
          console.log("⚠ Added hash to song file:", file.name);
        };
      }));

      if (!song.hash) {
        song.hash = Song.randomFileHash();
        madeChange = true;
        console.log("⚠ Added hash to song:", song.getDisplayName());
      }
      
      if (madeChange) {
        await song.saveInfo({
          callSync: false,
          forceLocal: true
        });
      }
      
      const zip = new yazl.ZipFile();
      const zipPathTmp = Path.resolve(os.tmpdir(), "toxen-sync-" + Math.random().toString().substring(2) + ".zip");
      const zipStream = fs.createWriteStream(zipPathTmp);
  
      const addFiles = async (dir: string, startingDir: string = dir) => {
        const files = await fsp.readdir(dir);
        for (const file of files) {
          const filePath = Path.resolve(dir, file);
          const stat = await fsp.stat(filePath);
          const relativePath = Path.relative(startingDir, filePath);
          if (stat.isDirectory()) {
            zip.addEmptyDirectory(relativePath);
            await addFiles(filePath, startingDir);
          } else {
            try {
              zip.addReadStream(fs.createReadStream(filePath), relativePath);
            } catch (error) {
              $toxen.error(error.message);
            }
          }
        }
      };
  
      await addFiles(song.dirnameLocal());
  
      zip.outputStream.pipe(zipStream);
  
      zip.end();
      song.setProgressBar(0.5);
  
      return await new Promise<void>((resolve, reject) => {
        zipStream.on("finish", resolve);
        zipStream.on("error", reject);
      }).then(async () => {
        const formData = new FormData();
        // Insert as blob
        formData.append("file", new Blob([await fsp.readFile(zipPathTmp)]), "sync.zip");
        formData.append("data", JSON.stringify(song.toISong()));
        formData.append("_method", "PUT");
        return $toxen.fetch(`${user.getCollectionPath()}/${song.uid}`, {
          method: "POST",
          body: formData
        });
      }).then(async res => {
        if (res.ok) {
          song.completeProgressBar();
          if (!silenceValidated) {
            $toxen.notify({
              title: "Synced",
              content: song.getDisplayName(),
              expiresIn: 5000
            });
          }
          return fsp.unlink(zipPathTmp);
        } else {
          song.setProgressBar(0);
          $toxen.notify({
            title: "Sync failed",
            content: await res.text(),
            expiresIn: 5000,
            type: "error"
          });
        }
      }).catch(error => {
        song.setProgressBar(0);
        $toxen.error("Something went wrong writing the exported zip file.");
        console.error(error);
        return fsp.unlink(zipPathTmp);
      });
    }
    else if (diff.localHash || diff.remoteHash) { // An empty array means no changes
      let hash = diff.localHash;

      if (diff.localHash && diff.remoteHash) {
        hash = Song.randomFileHash();
      }
      
      // Upload files
      if (diff.localHash && !Array.isArray(diff.upload)) {
        for (const fileKey of Object.keys(diff.upload)) {
          const file = diff.upload[fileKey];
          if (fileKey === "info.json") {

            await $toxen.fetch(`${user.getCollectionPath()}/${song.uid}/info.json`, {
              method: "PUT",
              body: JSON.stringify(song.toISong()),
              headers: {
                "Content-Type": "application/json"
              }
            })
          }
          else {
            let filePath = Path.resolve(song.dirname(), fileKey);
            console.log("Uploading file:", filePath);
            
            // let formData = new FormData();
            // formData.append("file", new Blob([await fsp.readFile(filePath)]), fileKey);
            // formData.append("_method", "PUT");
            await $toxen.fetch(`${user.getCollectionPath()}/${song.uid}/${fileKey}`, {
              method: "PUT",
              body: new Blob([await fsp.readFile(filePath)])
            });
          }
        }
        // diff.upload;
      }

      // Download files
      if (diff.remoteHash && !Array.isArray(diff.download)) {
        const preInfo = song.toISong();
        for (const fileKey of Object.keys(diff.download)) {
          let filePath = Path.resolve(song.dirname(), fileKey);
          console.log("Downloading file:", filePath);
          let res = await $toxen.fetch(`${user.getCollectionPath()}/${song.uid}/${fileKey}`);
          if (res.ok) {
            await fsp.writeFile(filePath, (await res.blob()).stream());
            console.log("Downloaded file:", fileKey);
          }
          else {
            console.error("Failed to download file:", fileKey);
          }
        }
        await song.reload();
        const postInfo = song.toISong();
        // Check if the song has changed
        if (song.uid == Song.getCurrent()?.uid) {
          if (
            preInfo.paths.background !== postInfo.paths.background
            || preInfo.files[preInfo.paths.background]?.time !== postInfo.files[postInfo.paths.background]?.time
          ) { $toxen.background.setBackground(
            `${song.backgroundFile()}?h=${song.hash}`
          ); }
          if (
            preInfo.paths.media !== postInfo.paths.media
            || preInfo.files[preInfo.paths.media]?.time !== postInfo.files[postInfo.paths.media]?.time
          ) { song.play(); }
          if (
            preInfo.paths.subtitles !== postInfo.paths.subtitles
            || preInfo.files[preInfo.paths.subtitles]?.time !== postInfo.files[postInfo.paths.subtitles]?.time
          ) { await song.applySubtitles(); }
          if (
            preInfo.paths.storyboard !== postInfo.paths.storyboard
            || preInfo.files[preInfo.paths.storyboard]?.time !== postInfo.files[postInfo.paths.storyboard]?.time
          ) { await song.applyStoryboard(); }
        }
      }

      if (!silenceValidated) {
        $toxen.log(`Synced track: ${song.getDisplayName()}`, 1500);
      }

      song.completeProgressBar();
    }
    else {
      song.completeProgressBar();
    }
  }

  public async validateSongAgainstRemote($toxen: typeof Toxen, user: User, song: Song): Promise<boolean> {
    const { hash: localHash } = await hashElement(song.dirname(), {
      folders: {
        ignoreBasename: true,
      }
    });
    console.log("Local hash", localHash);
    const remoteHash: string = await $toxen.fetch(user.getCollectionPath() + "/" + song.uid, {
      method: "OPTIONS"
    }).then(res => res.json()).then(res => res.hash).catch((): string => null);
    console.log("Remote hash", remoteHash);
    return localHash === remoteHash;
  }

  public async buildSongInfo($toxen: typeof Toxen, $song: typeof Song, fullPath: string) {
    return Promise.resolve().then(async () => {
      let info: Partial<ISong> = {
        uid: $song.generateUID(),
        // Other settings...
        paths: {
          dirname: null,
          background: null,
          media: null,
          subtitles: null,
          storyboard: null,
        },
      };
      const dir = await fsp.opendir(fullPath);
      info.paths.dirname = Path.basename(fullPath);
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isFile()) {
          let ext = Path.extname(ent.name).toLowerCase();
          if ($toxen.getSupportedMediaFiles().includes(ext)) {
            info.paths.media = ent.name;
            if (!info.title && !info.artist) {
              const name = Path.basename(ent.name, Path.extname(ent.name))
              if (ent.name.indexOf(" - ") > -1) {
                let [artist, title] = name.split(" - ");

                const prettify = (str: string) => str.replace(/[_ ]+/g, " ").trim();
                info.artist = prettify(artist);
                info.title = prettify(title);
              }
              else {
                info.title = name;
              }
            }
          }
          else if ($toxen.getSupportedImageFiles().includes(ext)) {
            if (!info.paths.background) info.paths.background = ent.name;
          }
          else if ($toxen.getSupportedSubtitleFiles().includes(ext)) {
            if (!info.paths.subtitles) info.paths.subtitles = ent.name;
          }
          else if ($toxen.getSupportedStoryboardFiles().includes(ext)) {
            if (!info.paths.storyboard) info.paths.storyboard = ent.name;
          }
        }

        // Toxen2 backwards compatibility.
        // try {
        //   if (await fsp.stat(Path.resolve(fullPath, "details.json")).then(() => true).catch(() => false)) {
        //     let path = Path.resolve(fullPath, "details.json");
        //     info = await Legacy.toxen2SongDetailsToInfo(JSON.parse(await fsp.readFile(path, "utf8")), info as ISong)
        //   }
        // } catch (error) {
        //   Toxen.error("There was an error trying to convert details.json into info.json");
        // }
      }

      await dir.close();
      return info as ISong;
    });
  }

  public async loadLocalSongs($toxen: typeof Toxen, $song: typeof Song, $settings: typeof Settings, reload?: boolean, forEach?: (song: Song) => void) {
    return Promise.resolve().then(async () => {
      if (reload !== true && !$settings.isRemote() && $toxen.songList) {
        return $toxen.songList;
      }

      let songs: Song[] = [];
      let dirName = $settings.get("libraryDirectory");
      if (!dirName) {
        return [];
      }
      let dir: Dir;
      try {
        dir = await fsp.opendir(dirName);
      } catch (error) {
        $toxen.error(error);

        return [];
      }
      let ent: Dirent;
      while (ent = await dir.read()) {
        if (ent.isDirectory() && !ent.name.startsWith(".")) { // Is music folder
          let songFolder = Path.resolve(dirName, ent.name);

          try {
            var info: ISong = JSON.parse(await fsp.readFile(Path.resolve(songFolder, "info.json"), "utf8"));
          } catch (error) {
            console.error("Failed to load info.json file in song: " + songFolder);
            info = await $song.buildInfo(songFolder);
            let s = $song.create(info);
            await s.saveInfo();
          }

          info.paths ?? ((info.paths as any) = {})
          let isDifferent = info.paths.dirname !== ent.name;
          if (isDifferent) info.paths.dirname = ent.name;


          if (info.paths.media || info.provider?.id) {
            let song = $song.create(info);
            songs.push(song);
            if (isDifferent) song.saveInfo();
            if (typeof forEach === "function") forEach(song);
          }
          else {
            // Attempt Locate media file
            const files = await System.recursive(songFolder);
            const sMedia = $toxen.getSupportedAudioFiles();
            let mediaFile = files.find(f => sMedia.includes(Path.extname(f.name)))?.name;

            let song = $song.create(info);
            if (mediaFile) {
              song.paths.media = mediaFile;
              songs.push(song);
              song.saveInfo();
              if (typeof forEach === "function") forEach(song);
            }

            if (typeof forEach === "function") forEach(null);
            console.warn(`Song "${songFolder}" is missing a media file. Excluding from song list.`);
            const nId = $toxen.notify({
              title: "Song missing media file",
              content: <div>
                <p>The song <b>{song.getDisplayName()}</b> is missing a media file. </p>
                <p>Do you want to remove it from the library?</p>
                <Group>
                  <Button color="red" onClick={() => {
                    hideNotification(nId);
                    song.delete();
                  }}>Delete</Button>
                  <Button color="green" onClick={() => hideNotification(nId)}>Ask later</Button>
                  {toxenapi.isDesktop() && (
                    <Button color="blue" onClick={() => {
                      toxenapi.remote.shell.openPath(song.dirname());
                    }}>Show Folder</Button>
                  )}
                </Group>
              </div>,
              type: "warning",
            })
          }
        }
      }
      await dir.close();
      return $song.sortSongs(songs);
    });
  }

  private _discord: Discord;
  
  public getDiscordInstance() {
    return this._discord ??= new Discord("647178364511191061"); // Toxen's Discord Application ID
  }

  public async compareLocalSongsAgainstRemote($toxen: typeof Toxen, user: User, data: any): Promise<{
    result: Record<string, SongDiff>
  }> {
    return $toxen.fetch(user.getCollectionPath(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data
      })
    }).then(async res => {
      if (res.ok) {
        return res.json();
      }
      else {
        throw await res.text();
      }
    });
  }

  /**
   * Export a theme as a .theme.json file or .theme.zip archive (if it contains images).
   * Desktop version: Opens file save dialog and saves to chosen location
   */
  public async exportTheme(theme: Theme): Promise<void> {
    try {
      const hasImages = !!(theme.backgroundImage || theme.sidepanelImage);

      if (hasImages) {
        // Export as zip archive containing theme.json + image files
        const result = await this.remote.dialog.showSaveDialog({
          title: 'Export Theme',
          defaultPath: `${theme.name}.theme.zip`,
          filters: [
            { name: 'Theme Archive', extensions: ['theme.zip'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          const zip = new yazl.ZipFile();
          const stream = fs.createWriteStream(result.filePath);

          // Add theme.json
          const themeData = {
            name: theme.name,
            displayName: theme.displayName,
            description: theme.description,
            styles: theme.styles,
            customCSS: theme.customCSS || "",
            backgroundImage: theme.backgroundImage,
            sidepanelImage: theme.sidepanelImage,
          };
          zip.addBuffer(Buffer.from(JSON.stringify(themeData, null, 2)), "theme.json");

          // Add image files from the theme folder
          const themeDir = Path.resolve(this.themeFolderPath, theme.name);
          if (theme.backgroundImage && !theme.backgroundImage.startsWith("data:")) {
            const bgPath = Path.resolve(themeDir, theme.backgroundImage);
            if (fs.existsSync(bgPath)) {
              zip.addReadStream(fs.createReadStream(bgPath), theme.backgroundImage);
            }
          }
          if (theme.sidepanelImage && !theme.sidepanelImage.startsWith("data:")) {
            const spPath = Path.resolve(themeDir, theme.sidepanelImage);
            if (fs.existsSync(spPath)) {
              zip.addReadStream(fs.createReadStream(spPath), theme.sidepanelImage);
            }
          }

          // Add custom.css if it exists in the folder
          const customCssPath = Path.resolve(themeDir, "custom.css");
          if (fs.existsSync(customCssPath)) {
            zip.addReadStream(fs.createReadStream(customCssPath), "custom.css");
          }

          zip.outputStream.pipe(stream);
          zip.end();

          await new Promise<void>((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", reject);
          });
        }
      } else {
        // Export as single .theme.json file
        const themeData = {
          name: theme.name,
          displayName: theme.displayName,
          description: theme.description,
          styles: theme.styles,
          customCSS: theme.customCSS || "",
        };

        const jsonString = JSON.stringify(themeData, null, 2);

        const result = await this.remote.dialog.showSaveDialog({
          title: 'Export Theme',
          defaultPath: `${theme.name}.theme.json`,
          filters: [
            { name: 'Theme Files', extensions: ['theme.json'] },
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          await fsp.writeFile(result.filePath, jsonString, 'utf8');
        }
      }
    } catch (error) {
      console.error('Failed to export theme:', error);
      throw new Error('Failed to export theme');
    }
  }

  TaskbarControls = TaskbarControls;

  public async exportSongPackage(song: Song): Promise<string> {
    const zip = new yazl.ZipFile();
    const tmpPath = Path.resolve(os.tmpdir(), "toxen-export-" + Math.random().toString().substring(2) + ".txz");
    const stream = fs.createWriteStream(tmpPath);

    const addFiles = async (dir: string, startingDir: string = dir) => {
      const files = await fsp.readdir(dir);
      for (const file of files) {
        const filePath = Path.resolve(dir, file);
        const stat = await fsp.stat(filePath);
        const relativePath = Path.relative(startingDir, filePath);
        if (stat.isDirectory()) {
          zip.addEmptyDirectory(relativePath);
          await addFiles(filePath, startingDir);
        } else {
          try {
            zip.addReadStream(fs.createReadStream(filePath), relativePath);
          } catch (error) {
            console.error("Failed to add file to txz:", filePath, error);
          }
        }
      }
    };

    await addFiles(song.dirnameLocal());

    zip.outputStream.pipe(stream);
    zip.end();

    await new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return tmpPath;
  }

  public async importTxzPackage(filePath: string, libDir: string): Promise<ISong> {
    return new Promise<ISong>((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const fileEntries: Array<{ fileName: string; chunks: Buffer[] }> = [];

        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry - skip, we'll create dirs as needed
            zipfile.readEntry();
          } else {
            const fileEntry: { fileName: string; chunks: Buffer[] } = {
              fileName: entry.fileName,
              chunks: [],
            };
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              readStream.on("data", (chunk: Buffer) => fileEntry.chunks.push(chunk));
              readStream.on("end", () => {
                fileEntries.push(fileEntry);
                zipfile.readEntry();
              });
              readStream.on("error", reject);
            });
          }
        });

        zipfile.on("end", async () => {
          try {
            // Look for info.json to get song metadata
            const infoEntry = fileEntries.find(e => Path.basename(e.fileName) === "info.json");
            let info: ISong | null = null;
            if (infoEntry) {
              info = JSON.parse(Buffer.concat(infoEntry.chunks).toString("utf8"));
            }

            // Determine folder name for the imported song
            let folderName: string;
            if (info?.artist && info?.title) {
              folderName = `${info.artist} - ${info.title}`;
            } else if (info?.title) {
              folderName = info.title;
            } else {
              folderName = Path.basename(filePath, ".txz");
            }
            // Sanitize folder name
            folderName = folderName.replace(/[^a-zA-Z0-9\(\)\[\]\{\}\.\-\_\s]/g, "_");

            let targetDir = Path.resolve(libDir, folderName);
            let increment = 0;
            while (await fsp.stat(targetDir).then(() => true).catch(() => false)) {
              targetDir = Path.resolve(libDir, folderName + ` (${++increment})`);
            }

            await fsp.mkdir(targetDir, { recursive: true });

            // Extract all files
            for (const entry of fileEntries) {
              const outPath = Path.resolve(targetDir, entry.fileName);
              const outDir = Path.dirname(outPath);
              await fsp.mkdir(outDir, { recursive: true });
              await fsp.writeFile(outPath, Buffer.concat(entry.chunks));
            }

            // Generate a new UID for the imported song to avoid collisions
            const newUid = Song.generateUID();

            if (info) {
              info.uid = newUid;
              info.paths.dirname = Path.basename(targetDir);
              // Reset file tracking so sync doesn't get confused
              info.files = {};
              info.hash = Song.randomFileHash();
            } else {
              // No info.json in the archive - build a minimal one
              const supported = [".mp3", ".flac", ".ogg", ".wav", ".wma", ".mp4", ".mov"];
              let mediaFile: string | null = null;
              for (const entry of fileEntries) {
                const ext = Path.extname(entry.fileName).toLowerCase();
                if (supported.includes(ext)) {
                  mediaFile = Path.basename(entry.fileName);
                  break;
                }
              }
              info = {
                uid: newUid,
                paths: {
                  dirname: Path.basename(targetDir),
                  media: mediaFile,
                  background: null,
                  subtitles: null,
                  storyboard: null,
                },
                hash: Song.randomFileHash(),
                files: {},
              } as ISong;
            }

            // Write the updated info.json
            await fsp.writeFile(
              Path.resolve(targetDir, "info.json"),
              JSON.stringify(info, null, 2)
            );

            resolve(info);
          } catch (error) {
            reject(error);
          }
        });

        zipfile.on("error", reject);
      });
    });
  }
}