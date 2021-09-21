const RPC: typeof import("discord-rpc") = require("../../modified_node_modules/discord-rpc");
// RPC: I had to modify the code itself for it to work.
// It would only work if I added (error) after the catch on line 48 in the websocket code.
// If anyone has any better solutions I am all ears.
import { Toxen } from "../ToxenApp";
import Song from "./Song";
import { remote } from "electron";
import Settings from "./Settings";
type Client = import("discord-rpc").Client;
type Presence = import("discord-rpc").Presence;

// Class for handling Discord Game Presence
export default class Discord {
  client: Client;
  private isReady: boolean = false;
  private isDestroyed = false;
  constructor(private clientId: string) { }

  public connect() {
    this.client = new RPC.Client({
      transport: "ipc"
    });
    this.client.login({ clientId: this.clientId });
    this.isDestroyed = false;
    return new Promise<void>((resolve, reject) => {
      this.client.once("ready", () => {
        this.isReady = true;
        Toxen.log("Discord connected", 2000);
        resolve();
      });

      this.client.addListener("error", (err) => {
        Toxen.error("Discord error", 2000);
        console.error(err);
      })
    });
  }

  async disconnect() {
    await this.client.destroy();
    this.isReady = false;
    this.isDestroyed = true;
    Toxen.log("Disconnected from Discord", 3000);
  }

  /**
   * Update Discord presence. Uses the currently playing song.
   */
  async setPresence(): Promise<void>;
  /**
   * Update Discord presence. Use a specific song.
   */
  async setPresence(song: Song): Promise<void>;
  async setPresence(song = Song.getCurrent()) {
    const enabled = Settings.get("discordPresence");
    if (enabled && this.isDestroyed) this.connect();
    if (!enabled && !this.isDestroyed) return this.disconnect();
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
      let options: Presence = {
        details: `${song?.isVideo() ? "Watching a video" : "Listening to a song"}`,
        largeImageKey: "toxen",
        largeImageText: remote.app.isPackaged ? "Toxen3 " + remote.app.getVersion() : "Toxen3 " + remote.app.getVersion() + " | Developer Mode",
      };
      if (Settings.get("discordPresenceDetailed") && song) {
        // options["startTimestamp"] = Date.now(); // For Time left
        // options["endTimestamp"] = Date.now() + (SongManager.player.duration - SongManager.player.currentTime) * 1000; // For Time left
        if (!Toxen.musicPlayer.media.paused) options["startTimestamp"] = Date.now() - (Toxen.musicPlayer.media.currentTime * 1000); // For Time Elapsed
        options["details"] = (Toxen.musicPlayer.media.paused ? "(Paused) " : "")
          + (`${song.isVideo() ? "Watching " : "Listening to "}`)
          + `${song.getDisplayName()}`;
        if (song.source) options["state"] = `\nFrom ${song.source}`;
      }
      console.log(options);
      this.client.setActivity(options, process.pid);
      break;
    }
  }
}