import Settings from "./Settings";
import Song from "./Song";

// Class for handling Discord Game Presence
export default class Discord {
  constructor(private clientId: string) { }

  public connect() {
    return Promise.resolve();
  }

  async disconnect() {
    return Promise.resolve();
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
    return Promise.resolve();
  }
}