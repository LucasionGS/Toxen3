// const ffmpeg: typeof import("fluent-ffmpeg") = require("fluent-ffmpeg/lib/fluent-ffmpeg");
import ffmpeg from "fluent-ffmpeg"; // TEST: Unsure if this works?
import { Toxen } from "../ToxenApp";
import Settings from "./Settings";
import fs from "fs";
import Path from "path";
import os from "os";
import yauzl from "yauzl";
import Song from "./Song";

namespace Ffmpeg {
  export const ffmpegPath = Settings.toxenDataPath + (os.platform() === "win32" ? "/ffmpeg.exe" : "/ffmpeg");

  export function isFFmpegInstalled(): boolean {
    return fs.existsSync(ffmpegPath);
  }

  // Source: https://github.com/BtbN/FFmpeg-Builds
  const downloadLocations: Record<NodeJS.Platform, string> = {
    aix: "",
    android: "",
    darwin: "",
    freebsd: "",
    linux: "",
    openbsd: "",
    sunos: "",
    win32: "https://dl.toxen.net/tools/ffmpeg.zip",
    cygwin: "",
    netbsd: "",
    haiku: "",
  }

  export async function installFFmpeg(): Promise<boolean> {
    return Promise.resolve().then(async () => {
      if (isFFmpegInstalled()) return true;
      Toxen.log("Downloading FFmpeg...", 2000);
      const url = downloadLocations[os.platform()] ?? null;
      if (!url) {
        Toxen.error("FFmpeg is not supported on this platform.", 5000);
        return false;
      }
      const blob = await fetch(url).then(res => res.blob());
      return new Promise<boolean>(async (resolve, reject) => {
        yauzl.fromBuffer(Buffer.from(await blob.arrayBuffer()), (err, zipfile) => {
          Toxen.log("Extracting FFmpeg...", 2000);
          switch (os.platform()) {
            case "win32": {
              zipfile.on("entry", entry => {
                if (entry.fileName.endsWith(".exe")) {
                  zipfile.openReadStream(entry, (err, readStream) => {
                    console.log(entry.fileName);

                    // Get only filename
                    const filename = entry.fileName.split("/").pop();

                    readStream.pipe(fs.createWriteStream(Settings.toxenDataPath + "/" + filename));
                  });
                }
              });
              break;
            }
            default:
              Toxen.error("FFmpeg is not supported on this platform.", 5000);
              return false;
          }

          zipfile.on("end", () => {
            setTimeout(() => {
              Toxen.log("FFmpeg installed!", 2000);
              zipfile.close();
              resolve(true);
            }, 1000);
          });
        });
      });
    });
  }

  interface FfmpegProgressEvent {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
    percent: number;
  }

  export function trimSong(song: Song, startTime: number, endTime: number, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const fullPath = song.dirname(song.paths.media);
        const filename = song.paths.media.split("/").pop();
        const fileDirname = Path.dirname(fullPath);
        Toxen.log("Trimming song...", 2000);
        ffmpeg(fullPath)
          .setFfmpegPath(ffmpegPath)
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .output(fileDirname + "/trimmed." + filename)
          .on("end", async () => {
            song.paths.media = "trimmed." + filename;
            await song.saveInfo();

            if (Song.getCurrent() === song) {
              Toxen.musicPlayer.setSource(song.dirname(song.paths.media), true);
            }

            resolve(true);
          })
          .on("progress", (progress) => {
            if (onProgress) onProgress(progress);
          }).on("error", reject)
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  export async function convertToFile(ext: string, song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    if (!(await Ffmpeg.installFFmpeg())) {
      Toxen.error("FFmpeg could not be installed.");
      return false;
    }
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const fullPath = song.dirname(song.paths.media);
        const filename = song.paths.media.split("/").pop();
        const filenameWithoutExt = filename.split(".").slice(0, -1).join(".");
        const fileDirname = Path.dirname(fullPath);
        ffmpeg(fullPath)
          .setFfmpegPath(ffmpegPath)
          .output(`${fileDirname}/${filenameWithoutExt}.${ext}`)
          .on("end", async () => {
            song.paths.media = `${filenameWithoutExt}.${ext}`;
            await song.saveInfo();

            if (Song.getCurrent() === song) {
              Toxen.musicPlayer.setSource(song.dirname(song.paths.media), true);
            }

            resolve(true);
          })
          .on("progress", (progress) => {
            if (onProgress) onProgress(progress);
          }).on("error", reject)
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  export function convertToMp3(song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return convertToFile("mp3", song, onProgress);
  }

  export function convertToOgg(song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return convertToFile("ogg", song, onProgress);
  }
}

export default Ffmpeg;