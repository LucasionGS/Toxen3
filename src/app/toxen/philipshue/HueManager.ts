import HueSync, { EntertainmentArea } from "hue-sync";
import { Toxen } from "../../ToxenApp";
import Settings from "../Settings";

namespace HueManager {
  export function isEnabled(): boolean {
    return Settings.get("hueEnabled") && !!instance;
  }
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
      try { stop(); } catch (error) { }
      instance = null;
    }
  }

  export let currentArea: EntertainmentArea;
  export function setCurrentArea(area: EntertainmentArea) {
    currentArea = area;
    currentLightNodes = area?.light_services.map(() => [0, 0, 0]) ?? [];
  }

  export let currentLightNodes: [number, number, number][] = [];

  let attemptingReconnect = false;
  export function setLightNodes(nodes: [number, number, number][]) {
    currentLightNodes = nodes;
  }

  export let started = false;
  export function transition() {
    if (isEnabled() && started && !attemptingReconnect) {
      try {
        instance.transition(currentLightNodes);
      } catch (error) {
        if (!attemptingReconnect) {
          Toxen.error("Failed to transition lights. Attempting to reconnect...", 1000);
          attemptingReconnect = true;
          setTimeout(() => {
            start(true).then(() => {
              attemptingReconnect = false;
            });
          }, 5000);
        }
      }
    }
  }

  export async function start(bypass = false) {
    console.log(`started: ${started}, currentArea: ${!!currentArea}, bypass: ${bypass}`);
    if (!bypass && (started || !currentArea)) return;
    
    try {
      console.log("Starting Hue Sync");
      await instance.start(currentArea, 5000);
      console.log("Hue Sync started");
      started = true;
    } catch (error) {
      console.error(error);
      stop();
    }
  }

  export function stop() {
    if (!started) return;
    console.log("Stopping Hue Sync");
    console.trace("Stopping Hue Sync");
    started = false;
    instance.stop();
  }
}

export default HueManager;