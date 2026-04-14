// const RPC: typeof import("discord-rpc") = require("../../modified_node_modules/discord-rpc");
// import * as RPC from "../../modified_node_modules/discord-rpc/src";
const RPC: typeof import("discord-rpc") = require("discord-rpc-electron");
// RPC: I had to modify the code itself for it to work.
// It would only work if I added (error) after the catch on line 48 in the websocket code.
// If anyone has any better solutions I am all ears.
import { Toxen } from "../../ToxenApp";
import Song from "../Song";
import * as remote from "@electron/remote";
import Settings from "../Settings";
type Client = InstanceType<typeof RPC.Client>;

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

      const isVideo = song?.isVideo();
      // type 2 = Listening, type 3 = Watching
      const activityType = isVideo ? 3 : 2;

      const rawActivity: Record<string, unknown> = {
        type: activityType,
        details: isVideo ? "Watching a video" : "Listening to a song",
        assets: {
          large_image: "toxen",
          large_text: remote.app.isPackaged
            ? "Toxen " + remote.app.getVersion()
            : "Toxen " + remote.app.getVersion() + " | Developer Mode",
        },
        buttons: [
          {
            label: "Get Toxen",
            url: "https://toxen.net",
          },
        ],
      };

      if (Settings.get("discordPresenceDetailed") && song) {
        if (!Toxen.musicPlayer.media.paused) {
          rawActivity["timestamps"] = {
            start: Math.floor((Date.now() - Toxen.musicPlayer.media.currentTime * 1000) / 1000),
          };
        }
        rawActivity["details"] = (Toxen.musicPlayer.media.paused ? "(Paused) " : "")
          + (isVideo ? "Watching " : "Listening to ")
          + song.getDisplayName();
        if (song.source) rawActivity["state"] = `From ${song.source}`;
      }

      // Use raw request so we can pass `type` — setActivity() does not expose it.
      (this.client as any).request("SET_ACTIVITY", {
        pid: process.pid,
        activity: rawActivity,
      });
      break;
    }
  }
}