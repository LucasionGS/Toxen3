import Settings from "./Settings";
import Song from "./Song";
import fsp from "fs/promises";
import fs from "fs";
import CrossPlatform from "./CrossPlatform";
import { Toxen } from "../ToxenApp";

export default class Playlist {
  constructor() {
    
  }

  public static playlists: Playlist[];
  public songList: Song[];

  public static create(data: IPlaylist, compareToSongObject?: {[uid: string]: Song}) {
    let pl = new Playlist();
    if (compareToSongObject) {
      pl.songList = data.songList.map(uid => compareToSongObject[uid]).filter(s => s !== null);
    }
    else {
      pl.songList = data.songList.map(uid => Toxen.songList.find(s => s.uid === uid))
    }

    return pl;
  }

  /**
   * Path for the playlists file.
   */
   public static readonly filePath = CrossPlatform.getToxenDataPath("playlists.json");
   /**
    * Save Toxen's current playlists.
    */
   public static async save() {
     console.log("Saving playlists...");
     
     if (Settings.isRemote()) {
       // Remote server
       throw "Saving playlists remotely not yet implemented";
     }
     else {
       try {
         let ws = fs.createWriteStream(Playlist.filePath);
         ws.write(Buffer.from(Playlist.toString()));
         ws.close();
       } catch (error) {
         Toxen.error(error);
       }
     }
   }
   /**
    * Save Toxen's playlists from `filePath`.
    */
   public static async load(): Promise<Playlist[]> {
     return Promise.resolve().then(async () => {
       if (Settings.isRemote()) {
         // Remote server
         throw "Loading playlists remotely not yet implemented";
       }
       else {
         // Local
         if (!(await fsp.stat(Playlist.filePath).then(() => true).catch(() => false))) {
           await Playlist.save();
         }
         try {
           let data = await fsp.readFile(Playlist.filePath, "utf8");
           let iPlaylists: IPlaylist[] = JSON.parse(data);
           let playlists: Playlist[] = iPlaylists.map(pl => Playlist.create(pl));
           return playlists;
         } catch (error) {
           throw "Unable to parse playlists file.";
         }
       }
     })
   }
}

interface IPlaylist {
  songList: string[];
}