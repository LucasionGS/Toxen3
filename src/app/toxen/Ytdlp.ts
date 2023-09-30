import YTDlpWrap, { Progress } from "yt-dlp-wrap";
import Settings from "./Settings";
import fs from "fs";
import os from "os";
import { Toxen } from "../ToxenApp";
import System, { ToxenFile } from "./System";
import {  } from "@mantine/modals";
import { useModals } from "@mantine/modals";

namespace Ytdlp {
  export const ytdlpPath = Settings.toxenDataPath + (os.platform() === "win32" ? "/ytdlp.exe" : "/ytdlp");

  export function isYtdlpInstalled(): boolean {
    return fs.existsSync(ytdlpPath);
  }

  export async function installYtdlp(force = false): Promise<boolean> {
    return Promise.resolve().then(async () => {
      if (!force && isYtdlpInstalled()) return true;
      Toxen.log("Downloading ytdlp...", 2000);
      try {

        if (!force) {
          
        }
        // Confirm responsibility
        
        if (fs.existsSync(ytdlpPath)) fs.unlinkSync(ytdlpPath);
        await YTDlpWrap.downloadFromGithub(ytdlpPath);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the file to be written
        return true;
      } catch (error) {
        Toxen.error("Failed to download ytdlp.", 5000);
        return false;
      }
    });
  }

  export async function getYtdlp(): Promise<YTDlpWrap> {
    if (!isYtdlpInstalled()) await installYtdlp();
    // Check version
    const ytd = new YTDlpWrap(ytdlpPath);
    
    return ytd;
  }

  export interface VideoInfo {
    filename: string;
    title: string;
    thumbnail: string;
    original_url: string;
    uploader: string;
  }

  export async function getVideoInfo(url: string): Promise<VideoInfo[]> {
    const ytdlp = await getYtdlp();
    try {
      const info = await ytdlp.getVideoInfo(url);
      return Array.isArray(info) ? info : [info];
    } catch (error) {
      return [];
    }
  }

  export async function importAudio(videoInfo: VideoInfo, onProgress?: (progress: Progress) => void): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const ytdlp = await getYtdlp();
      // Download audio only in mp3 format
      const eightRandomChars = Math.random().toString(36).substring(2, 10);
      const tmpAudioOutput = `${os.tmpdir()}/${eightRandomChars}.mp3`;
      const thumbnail = videoInfo.thumbnail.split("/").pop().split("?")[0];
      const tmpBackgroundOutput = `${os.tmpdir()}/${eightRandomChars}_${thumbnail}`;

      await fetch(videoInfo.thumbnail).then(async (res) => {
        const dest = fs.createWriteStream(tmpBackgroundOutput);
        return res.blob().then(async (blob) => {
          dest.write(Buffer.from(await blob.arrayBuffer()));
          return dest.close();
        });
      });


      ytdlp.exec(
        [
          videoInfo.original_url,
          "--no-playlist",
          "--extract-audio",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--output",
          tmpAudioOutput,
        ]
      ).on("progress", (progress) => {
        if (onProgress) onProgress(progress);
        else {
          console.log(
            progress.percent,
            progress.totalSize,
            progress.currentSpeed,
            progress.eta
          );
        }
      }).on("ytDlpEvent", (eventType, eventData) =>
        console.log(eventType, eventData)
      ).on("error",
        (error) => reject(console.error(error))
      ).on("close",
        async () => {
          await System.handleImportedFiles([
            {
              name: videoInfo.filename.includes(" - ") ? videoInfo.filename.replace(/\.[a-zA-Z0-9]+$/, ".mp3") : (videoInfo.uploader + " - " + videoInfo.title + ".mp3"),
              path: tmpAudioOutput,
            }
          ]);

          await new Promise((resolve) => setTimeout(resolve, 250)); // make sure the song started playing.
          await System.handleImportedFiles([
            {
              name: thumbnail,
              path: tmpBackgroundOutput,
            }
          ]);

          if (fs.existsSync(tmpAudioOutput)) fs.unlinkSync(tmpAudioOutput);
          if (fs.existsSync(tmpBackgroundOutput)) fs.unlinkSync(tmpBackgroundOutput);
          resolve();
        }
      );
    });
  }
}

export default Ytdlp;