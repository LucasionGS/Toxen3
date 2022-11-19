import HueSync from "hue-sync";

namespace HueManager {
  export let HueSyncStatic = HueSync;
  export let instance: HueSync;

  export interface BridgeArguments {
    username: string;
    clientkey: string;
    ip: string;
  }

  /**
   * Initializes the Hue API instance.
   */
  export function init(credentials: BridgeArguments) {
    dispose();
    instance = new HueSync({
      credentials: {
        username: credentials.username,
        clientkey: credentials.clientkey,
      },
      url: credentials.ip,
      id: credentials.ip,
    });
  }

  export function dispose() {
    if (instance) {
      try { instance.stop(); } catch (error) { }
      instance = null;
    }
  }

  /**
   * Gets the current state of the bridge.
   * @returns The current state of the bridge.
   */
  export async function getState() {
    return await instance.getEntertainmentAreas();
  }
}

export default HueManager;