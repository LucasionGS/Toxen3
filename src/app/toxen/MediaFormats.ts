/**
 * File extension lists for the media, image, subtitle and storyboard files Toxen understands.
 * All extensions include the leading dot.
 */
export class MediaFormats {
  private constructor() { }

  /**
   * Audio formats natively playable in Chromium/Electron. No FFmpeg required.
   */
  public static getWebNativeAudioFiles(): string[] {
    return [".mp3", ".flac", ".ogg", ".wav", ".aac", ".m4a", ".opus", ".webm"];
  }

  /**
   * Audio formats that need real-time FFmpeg transcoding on desktop.
   * These are included in library scans but piped through the transcode server during playback.
   */
  public static getTranscodeAudioFiles(): string[] {
    return [
      ".wma",           // Windows Media Audio
      ".aiff", ".aif",  // Apple Audio Interchange
      ".ape",           // Monkey's Audio
      ".mka",           // Matroska Audio
      ".wv",            // WavPack
      ".tta",           // True Audio
      ".ac3",           // Dolby AC-3
      ".dts",           // DTS Audio
      ".mpc",           // Musepack
      ".amr",           // Adaptive Multi-Rate
      ".gsm",           // GSM Audio
      ".ra",            // RealAudio
      ".au",            // Sun/NeXT Audio
      ".snd",           // NeXT Sound
    ];
  }

  /**
   * Every audio format Toxen can play, natively or through transcoding.
   */
  public static getSupportedAudioFiles(): string[] {
    return [
      ...MediaFormats.getWebNativeAudioFiles(),
      ...MediaFormats.getTranscodeAudioFiles(),
    ];
  }

  /**
   * Video formats natively playable in Chromium/Electron. No FFmpeg required.
   */
  public static getWebNativeVideoFiles(): string[] {
    return [".mp4", ".webm"];
  }

  /**
   * Video formats that need real-time FFmpeg transcoding on desktop.
   */
  public static getTranscodeVideoFiles(): string[] {
    return [
      ".mov",           // QuickTime
      ".mkv",           // Matroska Video
      ".avi",           // Audio Video Interleave
      ".wmv",           // Windows Media Video
      ".flv",           // Flash Video
      ".ts",            // MPEG Transport Stream
      ".m2ts", ".mts",  // Blu-ray / AVCHD
      ".vob",           // DVD Video
    ];
  }

  /**
   * Every video format Toxen can play, natively or through transcoding.
   */
  public static getSupportedVideoFiles(): string[] {
    return [
      ...MediaFormats.getWebNativeVideoFiles(),
      ...MediaFormats.getTranscodeVideoFiles(),
    ];
  }

  /**
   * Every audio and video format Toxen can play.
   */
  public static getSupportedMediaFiles(): string[] {
    return MediaFormats.getSupportedAudioFiles().concat(MediaFormats.getSupportedVideoFiles());
  }

  /**
   * Image formats usable as song backgrounds.
   */
  public static getSupportedImageFiles(): string[] {
    return [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webm",
      ".webp",
      ".jfif",
    ];
  }

  /**
   * Subtitle formats Toxen can parse.
   */
  public static getSupportedSubtitleFiles(): string[] {
    return [
      ".srt",
      ".tst",
      ".lrc",
      ".vtt"
    ];
  }

  /**
   * Storyboard file formats.
   */
  public static getSupportedStoryboardFiles(): string[] {
    return [
      ".tsb",
    ];
  }
}

export default MediaFormats;
