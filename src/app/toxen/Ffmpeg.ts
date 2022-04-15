const ffmpeg: typeof import("fluent-ffmpeg") = require("fluent-ffmpeg/lib/fluent-ffmpeg");
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

  const downloadLocations = {
    aix: "",
    android: "",
    darwin: "",
    freebsd: "",
    linux: "",
    openbsd: "",
    sunos: "",
    win32: "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-04-14-12-31/ffmpeg-N-106612-gea84eb2db1-win64-gpl.zip",
    cygwin: "",
    netbsd: "",
  }

  export async function installFFmpeg(): Promise<boolean> {
    return Promise.resolve().then(async () => {
      if (isFFmpegInstalled()) return true;
      Toxen.log("Downloading FFmpeg...", 2000);
      const url = downloadLocations[os.platform()];
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
              resolve(true);
            }, 1000);
          });
        });
      });
    });
  }

  export function trimSong(song: Song, startTime: number, endTime: number): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
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
        .on("error", err => {
          reject(err);
        })
        .run();
    });
  }
}

export default Ffmpeg;