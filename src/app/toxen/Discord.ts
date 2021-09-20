import RPC from "discord-rpc";
import { Toxen } from "../ToxenApp";
import Song from "./Song";
import { remote } from "electron";
import Settings from "./Settings";

// Class for handling Discord Game Presence
export default class Discord {
  client: RPC.Client;
  private isReady: boolean = false;
  constructor(private clientId: string) { }

  public connect() {
    this.client = new RPC.Client({
      transport: "ipc"
    });
    this.client.login({ clientId: this.clientId });
    this.client.on("ready", () => {
      this.isReady = true;
      Toxen.log("Discord connected");
    });
  }

  async discordDisconnect() {
    await this.client.destroy();
    this.isReady = false;
    Toxen.log("Disconnected from Discord", 3000);
  }

  /**
   * Update Discord presence
   */
  async setPresence(): Promise<void>;
  async setPresence(song: Song): Promise<void>;
  async setPresence(song = Song.getCurrent()) {
    let attemptCount = 0;
    while (true) {
      if (attemptCount > 30) {
        Toxen.error("Failed to set presence", 3000);
        break;
      }
      if (isNaN(Toxen?.musicPlayer?.media?.duration) || !this.isReady) {
        attemptCount++;
        // await 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      let options: RPC.Presence = {
        details: `${song.isVideo() ? "Watching a video" : "Listening to a song"}`,
        largeImageKey: "toxen",
        largeImageText: remote.app.isPackaged ? "Toxen3 " + remote.app.getVersion() : "Toxen Developer Mode"
      };
      if (Settings.get("discordPresenceDetailed")) {
        // options["startTimestamp"] = Date.now(); // For Time left
        // options["endTimestamp"] = Date.now() + (SongManager.player.duration - SongManager.player.currentTime) * 1000; // For Time left
        if (!Toxen.musicPlayer.media.paused) options["startTimestamp"] = Date.now() - (Toxen.musicPlayer.media.currentTime * 1000); // For Time Elapsed
        options["details"] = (Toxen.musicPlayer.media.paused ? "(Paused) " : "")
          + (`${song.isVideo ? "Watching " : "Listening to "}`)
          + `${song.getDisplayName()}`;
        if (song.source) options["state"] = `\nFrom ${song.source}`;
      }
      this.client.setActivity(options);
      break;
    }
  }
}