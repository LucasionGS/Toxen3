import YTDlpWrap, { Progress } from "yt-dlp-wrap";
import Settings from "../Settings";
import fs from "fs";
import os from "os";
import { Toxen } from "../../ToxenApp";
import System, { ToxenFile } from "../System";
import {  } from "@mantine/modals";
import { useModals } from "@mantine/modals";

export default class Ytdlp {
  constructor(ytdlpPath: string) {
    this.ytdlpPath = ytdlpPath;
  }
  
  public readonly ytdlpPath: string;

  public isYtdlpInstalled(): boolean {
    return fs.existsSync(this.ytdlpPath);
  }

  public async installYtdlp(force = false): Promise<boolean> {
    return Promise.resolve().then(async () => {
      if (!force && this.isYtdlpInstalled()) return true;
      Toxen.log("Downloading ytdlp...", 2000);
      try {

        if (!force) {
          
        }
        // Confirm responsibility
        
        if (fs.existsSync(this.ytdlpPath)) fs.unlinkSync(this.ytdlpPath);
        await YTDlpWrap.downloadFromGithub(this.ytdlpPath);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the file to be written
        return true;
      } catch (error) {
        Toxen.error("Failed to download ytdlp.", 5000);
        return false;
      }
    });
  }

  public async getYtdlpWrap(): Promise<YTDlpWrap> {
    if (!this.isYtdlpInstalled()) await this.installYtdlp();
    // Check version
    const ytd = new YTDlpWrap(this.ytdlpPath);
    
    return ytd;
  }

  public async getVideoInfo(url: string): Promise<VideoInfo[]> {
    const ytdlp = await this.getYtdlpWrap();
    try {
      const info = await ytdlp.getVideoInfo(url);
      const videos = Array.isArray(info) ? info : [info];
      
      // Enhance each video with subtitle information
      return videos.map(video => ({
        ...video,
        subtitles: video.subtitles || {},
        automatic_captions: video.automatic_captions || {}
      }));
    } catch (error) {
      return [];
    }
  }

  public async importAudio(videoInfo: VideoInfo, onProgress?: (progress: Progress) => void, subtitleLanguage?: string | null): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const ytdlp = await this.getYtdlpWrap();
      // Download audio only in mp3 format
      const eightRandomChars = Math.random().toString(36).substring(2, 10);
      const tmpAudioOutput = `${os.tmpdir()}/${eightRandomChars}.mp3`;
      // const thumbnail = videoInfo.thumbnail.split("/").pop().split("?")[0];
      // const tmpBackgroundOutput = `${os.tmpdir()}/${eightRandomChars}_${thumbnail}`;
      let tmpSubtitleOutput: string | null = null;

      // Download thumbnail
      // await fetch(videoInfo.thumbnail).then(async (res) => {
      //   const dest = fs.createWriteStream(tmpBackgroundOutput);
      //   return res.blob().then(async (blob) => {
      //     dest.write(Buffer.from(await blob.arrayBuffer()));
      //     return dest.close();
      //   });
      // });

      // Download subtitle separately if requested
      if (subtitleLanguage) {
        try {
          console.log(`Attempting to download subtitles for language: ${subtitleLanguage}`);
          console.log(`Video URL: ${videoInfo.original_url}`);
          
          // First, let's see what subtitles are actually available
          console.log("Available subtitles:", videoInfo.subtitles);
          console.log("Available auto captions:", videoInfo.automatic_captions);
          
          // Check if the requested language is actually available
          const hasManualSubs = videoInfo.subtitles && videoInfo.subtitles[subtitleLanguage];
          const hasAutoCaptions = videoInfo.automatic_captions && videoInfo.automatic_captions[subtitleLanguage];
          
          if (!hasManualSubs && !hasAutoCaptions) {
            console.warn(`Requested subtitle language '${subtitleLanguage}' not found in available subtitles`);
            console.log("Available manual subtitle languages:", Object.keys(videoInfo.subtitles || {}));
            console.log("Available auto caption languages:", Object.keys(videoInfo.automatic_captions || {}));
          } else {
            console.log(`Subtitle language '${subtitleLanguage}' is available:`, {
              manual: !!hasManualSubs,
              auto: !!hasAutoCaptions
            });
          }
          
          const tmpDir = os.tmpdir();
          const baseFileName = `${eightRandomChars}`;
          
          // Clear any existing subtitle files with our prefix
          const existingFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith(baseFileName));
          console.log("Clearing existing files:", existingFiles);
          existingFiles.forEach(f => {
            try {
              fs.unlinkSync(`${tmpDir}/${f}`);
            } catch (e) {
              console.warn(`Could not delete ${f}:`, e);
            }
          });
          
          // Try downloading subtitles with a simpler approach
          const subtitleArgs = [
            videoInfo.original_url,
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", 
            `${subtitleLanguage},-live_chat`,
            "--skip-download",
            "--output",
            `${tmpDir}/${baseFileName}.%(ext)s`
          ];
          
          console.log("Executing subtitle download with args:", subtitleArgs.join(' '));
          
          try {
            const result = await ytdlp.exec(subtitleArgs);
            console.log("yt-dlp subtitle command completed successfully");
            console.log("yt-dlp result:", result);
          } catch (ytdlpError) {
            console.error("yt-dlp subtitle download failed:", ytdlpError);
            console.error("Error details:", ytdlpError.message || ytdlpError);
            
            // Try alternative approach - download everything and then filter
            console.log("Trying alternative approach - downloading all available subtitles");
            const altArgs = [
              videoInfo.original_url,
              "--write-subs",
              "--write-auto-subs",
              "--skip-download",
              "--output",
              `${tmpDir}/${baseFileName}.%(ext)s`
            ];
            
            try {
              const altResult = await ytdlp.exec(altArgs);
              console.log("Alternative subtitle download completed");
              console.log("Alternative result:", altResult);
            } catch (altError) {
              console.error("Alternative approach also failed:", altError);
            }
          }
          
          // Wait a bit and scan for subtitle files with retry mechanism
          console.log("Waiting for subtitle files to be written...");
          let subtitleFiles: string[] = [];
          let attempts = 0;
          const maxAttempts = 5;
          
          while (subtitleFiles.length === 0 && attempts < maxAttempts) {
            if (attempts > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
            }
            
            const allFiles = fs.readdirSync(tmpDir);
            subtitleFiles = allFiles.filter(f => 
              f.startsWith(baseFileName) && 
              (f.endsWith('.srt') || f.endsWith('.vtt') || f.endsWith('.ttml') || f.endsWith('.ass'))
            );
            
            attempts++;
            console.log(`Attempt ${attempts}: Looking for files starting with '${baseFileName}'`);
            console.log(`Found ${allFiles.length} total files, ${subtitleFiles.length} subtitle files`);
            
            if (subtitleFiles.length === 0) {
              // Show some files that start with similar patterns for debugging
              const similarFiles = allFiles.filter(f => f.includes(baseFileName.substring(0, 4)));
              console.log("Files with similar prefix:", similarFiles);
              
              // Also look for any subtitle files at all
              const anySubtitleFiles = allFiles.filter(f => 
                f.endsWith('.srt') || f.endsWith('.vtt') || f.endsWith('.ttml') || f.endsWith('.ass')
              );
              console.log("Any subtitle files in temp dir:", anySubtitleFiles);
              
              // If we find subtitle files but they don't match our prefix, maybe the naming is different
              if (anySubtitleFiles.length > 0) {
                console.log("Found subtitle files with different naming pattern, checking timestamps...");
                const now = Date.now();
                const recentSubtitleFiles = anySubtitleFiles.filter(f => {
                  try {
                    const stat = fs.statSync(`${tmpDir}/${f}`);
                    const fileAge = now - stat.mtime.getTime();
                    return fileAge < 60000; // Files created in last minute
                  } catch (e) {
                    return false;
                  }
                });
                console.log("Recently created subtitle files:", recentSubtitleFiles);
                
                // If we find recent subtitle files, use the first one
                if (recentSubtitleFiles.length > 0) {
                  console.log("Using recently created subtitle file as it's likely from our download");
                  subtitleFiles = recentSubtitleFiles;
                }
              }
            }
          }
          
          console.log("Final scan results:");
          console.log("Found subtitle files:", subtitleFiles);
          
          if (subtitleFiles.length === 0) {
            console.warn("No subtitle files found after download attempts");
            tmpSubtitleOutput = null;
          } else {
            // Prefer files with the exact language code we requested
            let bestMatch = subtitleFiles.find(f => f.includes(`.${subtitleLanguage}.`));
            
            // If no exact match, try to find any subtitle file
            if (!bestMatch) {
              bestMatch = subtitleFiles.find(f => f.endsWith('.srt'));
            }
            if (!bestMatch) {
              bestMatch = subtitleFiles.find(f => f.endsWith('.vtt'));
            }
            if (!bestMatch) {
              bestMatch = subtitleFiles[0]; // Take any subtitle file
            }
            
            const foundSubtitlePath = `${tmpDir}/${bestMatch}`;
            console.log(`Selected subtitle file: ${foundSubtitlePath}`);
            
            // Use the subtitle file directly - no conversion needed
            tmpSubtitleOutput = foundSubtitlePath;
            console.log(`Using subtitle file: ${tmpSubtitleOutput}`);
          }
          
        } catch (error) {
          console.error("Subtitle download process failed:", error);
          tmpSubtitleOutput = null;
        }
      }

      // Download audio
      const audioArgs = [
        videoInfo.original_url,
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--output",
        tmpAudioOutput,
      ];

      ytdlp.exec(audioArgs).on("progress", (progress) => {
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
          const filterSpecialChars = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "_");
          
          // Import audio file
          await System.handleImportedFiles([
            {
              name: videoInfo.filename.includes(" - ") ? filterSpecialChars(videoInfo.filename).replace(/\.[a-zA-Z0-9]+$/, ".mp3") : (filterSpecialChars(videoInfo.uploader) + " - " + filterSpecialChars(videoInfo.title) + ".mp3"),
              path: tmpAudioOutput,
            }
          ]);

          await new Promise((resolve) => setTimeout(resolve, 250)); // make sure the song started playing.
          
          // Import thumbnail

          // await System.handleImportedFiles([
          //   {
          //     name: thumbnail,
          //     path: tmpBackgroundOutput,
          //   }
          // ]);

          // Import subtitle if downloaded
          if (tmpSubtitleOutput && fs.existsSync(tmpSubtitleOutput)) {
            try {
              const fileExtension = tmpSubtitleOutput.split('.').pop();
              const subtitleName = filterSpecialChars(videoInfo.uploader) + " - " + filterSpecialChars(videoInfo.title) + "." + fileExtension;
              console.log(`Importing subtitle file: ${tmpSubtitleOutput} as ${subtitleName}`);
              await System.handleImportedFiles([
                {
                  name: subtitleName,
                  path: tmpSubtitleOutput,
                }
              ]);
              console.log(`Subtitle imported successfully: ${subtitleName}`);
            } catch (error) {
              console.error("Failed to import subtitle file:", error);
            }
          } else if (subtitleLanguage) {
            console.warn("Subtitle was requested but no file was found or downloaded");
          }

          // Cleanup temporary files
          if (fs.existsSync(tmpAudioOutput)) fs.unlinkSync(tmpAudioOutput);
          // if (fs.existsSync(tmpBackgroundOutput)) fs.unlinkSync(tmpBackgroundOutput);
          if (tmpSubtitleOutput && fs.existsSync(tmpSubtitleOutput)) fs.unlinkSync(tmpSubtitleOutput);
          
          resolve();
        }
      );
    });
  }

  public getAvailableSubtitleLanguages(videoInfo: VideoInfo): { code: string; name: string; type: 'subtitle' | 'caption' }[] {
    const languages: { code: string; name: string; type: 'subtitle' | 'caption' }[] = [];
    
    // Add manual subtitles
    if (videoInfo.subtitles) {
      Object.keys(videoInfo.subtitles).forEach(langCode => {
        languages.push({
          code: langCode,
          name: this.getLanguageName(langCode),
          type: 'subtitle'
        });
      });
    }
    
    // Add automatic captions
    if (videoInfo.automatic_captions) {
      Object.keys(videoInfo.automatic_captions).forEach(langCode => {
        // Don't duplicate if we already have manual subtitles for this language
        if (!languages.find(l => l.code === langCode)) {
          languages.push({
            code: langCode,
            name: this.getLanguageName(langCode),
            type: 'caption'
          });
        }
      });
    }
    
    return languages.sort((a, b) => a.name.localeCompare(b.name));
  }

  private getLanguageName(langCode: string): string {
    const languageNames: { [key: string]: string } = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'pl': 'Polish',
      'tr': 'Turkish',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'el': 'Greek',
      'he': 'Hebrew',
      'uk': 'Ukrainian',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'ro': 'Romanian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'et': 'Estonian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'mt': 'Maltese',
    };
    
    return languageNames[langCode] || langCode.toUpperCase();
  }

  public async getGithubReleases(page?: number, perPage?: number) {
    return YTDlpWrap.getGithubReleases(page, perPage);
  }
}

export interface VideoInfo {
  filename: string;
  title: string;
  thumbnail: string;
  original_url: string;
  uploader: string;
  subtitles?: {
    [languageCode: string]: {
      ext: string;
      url: string;
      name?: string;
    }[];
  };
  automatic_captions?: {
    [languageCode: string]: {
      ext: string;
      url: string;
      name?: string;
    }[];
  };
}