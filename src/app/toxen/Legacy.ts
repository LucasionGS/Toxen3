import fs from "fs";
import fsp from "fs/promises";
import CrossPlatform from "./CrossPlatform";
import Path from "path";
import { ISong } from "./Song";

export default class Legacy {
  /**
   * Converts a Toxen2 details.json file into an info.json file.
   */
  public static async toxen2SongDetailsToInfo(details: Toxen2SongDetails, info?: ISong) {
    info ?? (info = {} as ISong)

    info.uid = null;
    if (details.artist) info.artist = details.artist;
    if (details.title) info.title = details.title;
    if (details.source) info.source = details.source;
    if (details.album) info.album = details.album;
    if (details.tags) info.tags = details.tags;
    if (details.visualizerColor) {
      // Convert from format RGB -> HEX
      const {red: r, green: g, blue: b} = details.visualizerColor;
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      info.visualizerColor = ctx.fillStyle;
    }

    return info;
  }

  public static toxen2Data(): string {
    const appData = CrossPlatform.getAppDataPath();
    // Locate Toxen2's data directory.
    const toxen2SettingsPath = Path.resolve(appData, "ToxenData", "data", "settings.json");
    return fs.existsSync(toxen2SettingsPath) ? toxen2SettingsPath : null;
  }
}

export interface Toxen2SongDetails {
  "artist": string;
  "title": string;
  "album": string;
  "source": string;
  "sourceLink": string;
  "language": string;
  "year": string;
  "genre": string;
  "tags": string[];
  "playlists": string[];
  "songLength": number;
  "customGroup": string;
  "visualizerColor"?: {
    "red": number;
    "green": number;
    "blue": number;
  }
}