// const RPC: typeof import("discord-rpc") = require("../../modified_node_modules/discord-rpc");
import * as RPC from "../../modified_node_modules/discord-rpc/src";
// RPC: I had to modify the code itself for it to work.
// It would only work if I added (error) after the catch on line 48 in the websocket code.
// If anyone has any better solutions I am all ears.
import { Toxen } from "../ToxenApp";
import Song from "./Song";
import * as remote from "@electron/remote";
import Settings from "./Settings";
type Client = InstanceType<typeof RPC.Client>;
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
      //@ts-ignore
      this.client.once("ready", () => {
        this.isReady = true;
        // Toxen.log("Discord connected", 2000);
        resolve();
      });

      //@ts-ignore
      this.client.addListener("error", (err) => {
        Toxen.error("Discord error", 2000);
        console.error(err);
      })
    });
  }

  async disconnect() {
    try {
      await this.client.destroy();
    } catch (error) { }
    this.isReady = false;
    this.isDestroyed = true;
    // Toxen.log("Disconnected from Discord", 3000);
  }

  private totalFails = 0;

  /**
   * Update Discord presence. Uses the currently playing song.
   */
  async setPresence(): Promise<void>;
  /**
   * Update Discord presence. Use a specific song.
   */
  async setPresence(song: Song): Promise<void>;
  async setPresence(song = Song.getCurrent()) {
    if (this.totalFails >= 5) return; // Failsafe to not spam failure messages.

    const enabled = Settings.get("discordPresence");
    if (enabled && this.isDestroyed) this.connect();
    if (!enabled && !this.isDestroyed) return this.disconnect();
    if (!enabled) return;
    let attemptCount = 0;
    while (true) {
      if (attemptCount > 30) {
        if (this.totalFails == 5) {
          // Toxen.error("Discord Presence disabled due to too many failed attempts.\nRestart Toxen to try again.", 10000);
          return;
        }

        if (this.totalFails < 5) {
          // Toxen.error("Failed to set presence", 2000);
          this.totalFails++;
        }

        break;
      }

      if (isNaN(Toxen?.musicPlayer?.media?.duration) || !this.isReady) {
        attemptCount++;
        // await 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      this.totalFails = 0;

      let options: Presence = {
        details: `${song?.isVideo() ? "Watching a video" : "Listening to a song"}`,
        largeImageKey: "toxen",
        largeImageText: remote.app.isPackaged ? "Toxen " + remote.app.getVersion() : "Toxen " + remote.app.getVersion() + " | Developer Mode",
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
      this.client.setActivity(options, process.pid);
      break;
    }
  }
}