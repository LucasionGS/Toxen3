import sqlite3 from "better-sqlite3";
import { Toxen } from "../../app/ToxenApp";
import CrossPlatform from "../../app/toxen/desktop/CrossPlatform";
import fs from "fs";
import Song from "../../app/toxen/Song";

if (!(fs.existsSync(CrossPlatform.getToxenDataPath()))) {
  fs.mkdirSync(CrossPlatform.getToxenDataPath(), { recursive: true });
}
export const Database = new sqlite3(CrossPlatform.getToxenDataPath("toxen.sqlite"));

type DBSong = {
  uid: string;
  json: string;
}
export class TrackCache {
  declare uid: string;
  declare json: string;

  public static init() {
    try {
      Database.prepare("CREATE TABLE IF NOT EXISTS TrackCache (uid TEXT PRIMARY KEY, json TEXT NOT NULL)").run();
      return Promise.resolve(true);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  public static async get(uid: string): Promise<Song> {
    try {
      const row: DBSong = Database.prepare<[string], DBSong>("SELECT * FROM TrackCache WHERE uid = ? LIMIT 1").get(uid);
      return row ? Object.assign(new Song(), JSON.parse(row.json)) : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  public static async getAll(): Promise<Song[]> {
    try {
      const rows: DBSong[] = Database.prepare<[], DBSong>("SELECT * FROM TrackCache").all();
      return rows.map(row => Object.assign(new Song(), JSON.parse(row.json)));
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  public static async set(uid: string, song: Song) {
    try {
      Database.prepare("INSERT OR REPLACE INTO TrackCache (uid, json) VALUES (?, ?)")
        .run(uid, JSON.stringify(song.toISong()));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async setBulk(tracks: Song[]) {
    const insert = Database.prepare("INSERT OR REPLACE INTO TrackCache (uid, json) VALUES (?, ?)");
    const transaction = Database.transaction((data: { uid: string; json: string }[]) => {
      for (const item of data) {
        insert.run(item.uid, item.json);
      }
    });

    try {
      const data = tracks.map(t => ({ uid: t.uid, json: JSON.stringify(t.toISong()) }));
      transaction(data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async remove(uid: string) {
    try {
      Database.prepare("DELETE FROM TrackCache WHERE uid = ?").run(uid);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public static async clear() {
    try {
      Database.prepare("DELETE FROM TrackCache").run();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
