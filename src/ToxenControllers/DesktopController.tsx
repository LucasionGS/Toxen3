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
import yazl from "yazl";
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
    
    let ws = fs.createWriteStream(this.settingsFilePath);
    ws.write(Buffer.from($settings.toString()));
    ws.close();
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
      $settings.applyDefaultSettings({
        libraryDirectory: musicPath
      });
      await $settings.save();
    }
    try {
      let data = await fsp.readFile(this.settingsFilePath, "utf8");
      $settings.data = JSON.parse(data);
      $settings.applyDefaultSettings();
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
    let ws = fs.createWriteStream(this.statisticsFilePath);
    ws.write(Buffer.from($stats.toString()));
    ws.close();
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
    const data = JSON.stringify(this, null, 2);
    return fsp.writeFile(`${this.themeFolderPath}/${theme.name}.json`, data);
  }
  
  public async loadThemes($theme: typeof Theme): Promise<Theme[]> {
    const themes: Theme[] = await fsp.readdir(this.themeFolderPath).then(async (files) => {
      const themeFiles = files.filter((file) => file.endsWith(".json"));
      const themePromises = themeFiles.map((file) => {
        return fsp.readFile(`${this.themeFolderPath}/${file}`, "utf8").then((data) => {
          return $theme.create(JSON.parse(data));
        });
      });
      return Promise.all(themePromises);
    }).catch(async (): Promise<Theme[]> => {
      await fsp.mkdir(this.themeFolderPath);
      return [];
    });

    return themes;
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   */
  public loadThemeExternalCSS(theme: Theme) {
    const cssPath = `${this.themeFolderPath}/${theme.name}.css`;
    
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, "utf8");
      theme.customCSS = css;
    }
    else theme.customCSS = "";
  }

  public getYtdlp() {
    return new Ytdlp(CrossPlatform.getToxenDataPath(os.platform() === "win32" ? "ytdlp.exe" : "ytdlp"));
  }
  
  private _ffmpeg: Ffmpeg;
  /**
   * Get the Ffmpeg instance. Cached after first call.
   */
  public get ffmpeg() {
    return this._ffmpeg ??= new Ffmpeg(CrossPlatform.getToxenDataPath(os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg"));
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
    return await new Promise((resolve, reject) => {
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

  public async syncSong($toxen: typeof Toxen, user: User, song: Song, diff: SongDiff, { silenceValidated }: { silenceValidated?: boolean; }): Promise<void> {
    song.setProgressBar(0.10);
    
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
          callSync: false
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
  
      await addFiles(song.dirname());
  
      zip.outputStream.pipe(zipStream);
  
      zip.end();
      song.setProgressBar(0.5);
  
      return await new Promise((resolve, reject) => {
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

                info.artist = artist;
                info.title = title;
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
      if (reload !== true && $toxen.songList) {
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


          if (info.paths.media) {
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

  public async compareSongsAgainstRemote($toxen: typeof Toxen, user: User, data: any): Promise<{
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
}