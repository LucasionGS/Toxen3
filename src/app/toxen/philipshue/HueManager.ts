import HueSync, { EntertainmentArea } from "hue-sync";
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

  export function setLightNodes(nodes: [number, number, number][]) {
    currentLightNodes = nodes;
    try {
      instance.transition(currentLightNodes);
    } catch (error) {
      start();
    }
  }

  export function setLightNode(index: number, color: [number, number, number]) {
    currentLightNodes[index] = color;
    try {
      instance.transition(currentLightNodes);
    } catch (error) {
      start();
    }
  }

  export let started = false;
  export let starting = false;
  export async function start() {
    if (started || starting || !currentArea) return;
    starting = true;
    console.log("Starting Hue Sync");
    try {
      await instance.start(currentArea);
      console.log("Hue Sync started");
      started = true;
      starting = false;
    } catch (error) {
      stop();
    }
    return
  }

  export function stop() {
    if (!started) return;
    console.log("Stopping Hue Sync");
    instance.stop();
    started = false;
    starting = false;
  }
}

export default HueManager;