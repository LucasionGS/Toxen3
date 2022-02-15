import fs from "fs";
import fsp from "fs/promises";
import CrossPlatform from "./CrossPlatform";
import Path from "path";
import Song, { ISong } from "./Song";
import { IStatistics } from "./Statistics";
import Settings from "./Settings";
import Playlist from "./Playlist";
import { Toxen } from "../ToxenApp";

export default class Legacy {
  /**
   * Converts a Toxen2 details.json file into an info.json file.
   */
  public static async toxen2SongDetailsToInfo(details: Toxen2SongDetails, info?: ISong) {
    info ?? (info = {} as ISong);

    info.uid = null;
    if (details.artist) info.artist = details.artist;
    if (details.title) info.title = details.title;
    if (details.source) info.source = details.source;
    if (details.album) info.album = details.album;
    if (details.tags) info.tags = details.tags;
    if (details.visualizerColor) {
      // Convert from format RGB -> HEX
      const { red: r, green: g, blue: b } = details.visualizerColor;
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      info.visualizerColor = ctx.fillStyle;
    }

    return info;
  }

  /**
   * Converts a Toxen2 stats.json file into an statistics.json file.
   */
  public static async toxen2StatsToStatistics(oldStats: Toxen2Stats, stats?: IStatistics) {
    stats || (stats = {} as IStatistics);

    if (oldStats.secondsPlayed) stats.secondsPlayed = oldStats.secondsPlayed;
    if (oldStats.songsPlayed) stats.songsPlayed = oldStats.songsPlayed;

    return stats;
  }

  public static getToxen2SettingsPath(): string {
    const appData = CrossPlatform.getAppDataPath();
    const toxen2SettingsPath = Path.resolve(appData, "ToxenData", "data", "settings.json");
    return fs.existsSync(toxen2SettingsPath) ? toxen2SettingsPath : null;
  }

  public static getToxen2StatisticsPath(): string {
    const appData = CrossPlatform.getAppDataPath();
    const toxen2StatsPath = Path.resolve(appData, "ToxenData", "data", "stats.json");
    return fs.existsSync(toxen2StatsPath) ? toxen2StatsPath : null;
  }

  public static async getToxen2Playlists(): Promise<Playlist[]> {
    if (Settings.isRemote()) {
      Toxen.error
      return null;
    }
    const songs = await Song.getSongs();
    const playlists: Playlist[] = [];

    await Promise.all(
      songs.map(async song => {
        const details = await song.getToxen2Details();
        if (details && details.playlists) {
          details.playlists.forEach(playlist => {
            const existingPlaylist = playlists.find(p => p.name === playlist);
            if (!existingPlaylist) {
              playlists.push(
                Playlist.create({
                  name: playlist,
                  songList: [song.uid]
                })
              );
            }
            else {
              existingPlaylist.addSong(song);
            }
          });
        }
      })
    );

    return playlists;
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

export interface Toxen2Stats {
  secondsPlayed: number,
  songsPlayed: number;
}