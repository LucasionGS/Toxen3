import ToxenController from "./ToxenController";
import React from "react";
import Path from "path";
import fs from "fs";
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
import Ytdlp from "../app/toxen/Ytdlp";
import Ffmpeg from "../app/toxen/Ffmpeg";
import yazl from "yazl";
import type Song from "../app/toxen/Song";
import { type Toxen } from "../app/ToxenApp";
import type User from "../app/toxen/User";
import { hashElement } from "folder-hash";
import { } from "buffer";

/**
 * DesktopController is a controller for desktop-specific functions. Overwrites the web version of the controller.
 */
export default class DesktopController extends ToxenController {
  constructor() {
    super();
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Hue bullshit
  }
  
  
  public isDesktop(): this is DesktopController { return true; }
  CrossPlatform = CrossPlatform;
  public remote = remote;

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
    }).catch(async () => {
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

  public async syncSong($toxen: typeof Toxen, user: User, song: Song, { silenceValidated }: { silenceValidated?: boolean; }): Promise<void> {
    song.setProgressBar(0.10);
    try {
      const upToDate = await song.validateAgainstRemote();

      if (upToDate) {
        if (!silenceValidated) {
          song.completeProgressBar();
          $toxen.notify({
            title: "Update-to-date",
            content: <p><code>{song.getDisplayName()}</code> is already up to date.</p>,
            expiresIn: 1000
          });
        }
        return;
      }
    } catch (error) {
      song.completeProgressBar();
      return $toxen.notify({
        title: "Failed to validate against remote",
        content: error.message,
        expiresIn: 5000,
        type: "error"
      }) && null;
    }

    // Sync from disk to remote (Using archiver to zip the folder in memory)
    song.setProgressBar(0.25);
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
          zip.addReadStream(fs.createReadStream(filePath), relativePath);
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
      return $toxen.fetch(user.getCollectionPath() + "/" + song.uid, {
        method: "PUT",
        body: formData
      });
    }).then(async res => {
      if (res.ok) {
        song.completeProgressBar();
        $toxen.notify({
          title: "Synced",
          content: song.getDisplayName(),
          expiresIn: 5000
        });
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

  public async validateSongAgainstRemote($toxen: typeof Toxen, user: User, song: Song): Promise<boolean> {
    const { hash: localHash } = await hashElement(song.dirname(), {
      folders: {
        ignoreBasename: true,
      }
    });
    console.log("Local hash", localHash);
    const remoteHash: string = await $toxen.fetch(user.getCollectionPath() + "/" + song.uid, {
      method: "OPTIONS"
    }).then(res => res.json()).then(res => res.hash).catch(() => null);
    console.log("Remote hash", remoteHash);
    return localHash === remoteHash;
  }
}