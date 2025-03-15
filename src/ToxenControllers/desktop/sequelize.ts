import fs from "fs";
import path from "path";
import { Toxen } from "../../app/ToxenApp";
import CrossPlatform from "../../app/toxen/desktop/CrossPlatform";
import Song, { ISong } from "../../app/toxen/Song";

const dataFilePath = CrossPlatform.getToxenDataPath("trackCache.json");

if (!fs.existsSync(CrossPlatform.getToxenDataPath())) {
  fs.mkdirSync(CrossPlatform.getToxenDataPath(), { recursive: true });
}

if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({}));
}

// type DBSong = {
//   uid: string;
//   json: string;
// };

export class TrackCache {
  private static loadData(): Record<string, Song> {
    try {
      const data = fs.readFileSync(dataFilePath, "utf-8");
      const parsedData = JSON.parse(data);
      return Object.entries(parsedData).reduce((acc, [uid, song]) => {
        acc[uid] = Object.assign(new Song(), song);
        return acc;
      }, {} as Record<string, Song>);
    } catch (err) {
      console.error(err);
      return {};
    }
  }

  private static saveData(data: Record<string, ISong> | (Song | ISong)[]) {
    if (Array.isArray(data)) {
      data = data.reduce((acc, song) => {
        acc[song.uid] = song instanceof Song ? song.toISong() : song;
        return acc;
      }, {} as Record<string, ISong>);
    }
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(data));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async init() {
    // No initialization needed for JSON storage
    return Promise.resolve(true);
  }

  public static async get(uid: string): Promise<Song> {
    try {
      const data = this.loadData();
      const song = data[uid];
      return song;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  public static async getAll(): Promise<Song[]> {
    try {
      const data = this.loadData();
      return Object.values(data);
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  public static async set(song: Song) {
    try {
      const data = this.loadData();
      data[song.uid] = song;
      this.saveData(data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async setBulk(tracks: Song[]) {
    try {
      const data = this.loadData();
      for (const track of tracks) {
        data[track.uid] = track;
      }
      this.saveData(data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async remove(uid: string) {
    try {
      const data = this.loadData();
      delete data[uid];
      this.saveData(data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async clear() {
    try {
      this.saveData({});
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
