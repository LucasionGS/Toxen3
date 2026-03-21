// const ffmpeg: typeof import("fluent-ffmpeg") = require("fluent-ffmpeg/lib/fluent-ffmpeg");
import ffmpeg from "fluent-ffmpeg"; // TEST: Unsure if this works?
import { Toxen } from "../../ToxenApp";
import fs from "fs";
import Path from "path";
import os from "os";
import yauzl from "yauzl";
import Song from "../Song";

export default class Ffmpeg {
  constructor(ffmpegPath: string, ffprobePath?: string) {
    this.ffmpegPath = ffmpegPath;
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath);
    }
  }

  private ffmpegPath: string;

  // ---------------------------------------------------------------------------
  // Web-native format lists
  // ---------------------------------------------------------------------------

  /**
   * Audio extensions that Chromium/Electron can play natively without FFmpeg.
   * All other audio extensions will be transcoded in real-time.
   */
  public static readonly WEB_NATIVE_AUDIO = new Set([
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".opus", ".webm",
  ]);

  /**
   * Video extensions that Chromium/Electron can play natively without FFmpeg.
   * All other video extensions will be transcoded in real-time.
   */
  public static readonly WEB_NATIVE_VIDEO = new Set([
    ".mp4", ".webm",
  ]);

  /**
   * Returns `true` for any file extension that is NOT natively playable in
   * the browser and therefore requires real-time FFmpeg transcoding.
   */
  public static needsTranscoding(ext: string): boolean {
    const lower = ext.startsWith(".") ? ext.toLowerCase() : "." + ext.toLowerCase();
    return !Ffmpeg.WEB_NATIVE_AUDIO.has(lower) && !Ffmpeg.WEB_NATIVE_VIDEO.has(lower);
  }

  // ---------------------------------------------------------------------------
  // Blob-URL transcoding
  // ---------------------------------------------------------------------------

  /**
   * Transcodes an unsupported audio/video file to WAV (lossless PCM) using
   * FFmpeg and returns a Blob URL that the audio element can play directly.
   *
   * The entire output is collected in memory before the URL is returned, so
   * seeking works natively.  For typical audio files this finishes in well
   * under a second because FFmpeg is only demuxing and reformatting, not
   * re-encoding.
   *
   * The caller is responsible for calling `URL.revokeObjectURL()` on the
   * returned URL when it is no longer needed.
   *
   * @param onProgress  Optional callback — called with 0–100 percent as
   *                    FFmpeg processes the file.
   */
  public transcodeToBlob(
    filePath: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const command = ffmpeg(filePath)
        .noVideo()
        .audioCodec("pcm_s16le")
        .audioChannels(2)
        .audioFrequency(44100)
        .format("wav")
        .on("progress", (p) => {
          if (onProgress) onProgress(Math.min(Math.max(p.percent ?? 0, 0), 100));
        })
        .on("error", reject);

      const stream = command.pipe();
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        const blob = new Blob([Buffer.concat(chunks)], { type: "audio/wav" });
        resolve(URL.createObjectURL(blob));
      });
      stream.on("error", reject);
    });
  }

  // ---------------------------------------------------------------------------

  public isFFmpegInstalled(): boolean {
    return fs.existsSync(this.ffmpegPath);
  }

  // Source: https://github.com/BtbN/FFmpeg-Builds
  private downloadLocations: Record<NodeJS.Platform, string> = {
    aix: "",
    android: "",
    darwin: "",
    freebsd: "",
    linux: "",
    openbsd: "",
    sunos: "",
    win32: "",
    cygwin: "",
    netbsd: "",
    haiku: "",
  }

  public async installFFmpeg(): Promise<boolean> {
    if (!toxenapi.isDesktop()) {
      toxenapi.throwDesktopOnly();
    }
    
    return Promise.resolve().then(async () => {
      if (this.isFFmpegInstalled()) return true;
      Toxen.log("Downloading FFmpeg...", 2000);
      const url = this.downloadLocations[os.platform()] ?? null;
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

                    readStream.pipe(fs.createWriteStream(toxenapi.CrossPlatform.getToxenDataPath(filename)));
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

  public trimSong(song: Song, startTime: number, endTime: number, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const fullPath = song.dirname(song.paths.media);
        const filename = song.paths.media.split("/").pop();
        const fileDirname = Path.dirname(fullPath);
        Toxen.log("Trimming song...", 2000);
        ffmpeg(fullPath)
          .setFfmpegPath(this.ffmpegPath)
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .output(fileDirname + "/trimmed." + filename)
          .on("end", async () => {
            song.paths.media = "trimmed." + filename;
            song.setFile(song.paths.media);
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

  public async convertToFile(ext: string, song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    if (!(await this.installFFmpeg())) {
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
          .setFfmpegPath(this.ffmpegPath)
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

  public convertToMp3(song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return this.convertToFile("mp3", song, onProgress);
  }

  public convertToMp4(song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return this.convertToFile("mp4", song, onProgress);
  }

  public convertToOgg(song: Song, onProgress?: (progress: FfmpegProgressEvent) => void): Promise<boolean> {
    return this.convertToFile("ogg", song, onProgress);
  }
}

interface FfmpegProgressEvent {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  percent: number;
}