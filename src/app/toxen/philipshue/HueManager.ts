import { HueAPI, HueEntertainmentArea, HueBridgeDevice, HueCredentials, HueRegistrationResponse } from "./HueAPI";
import { Toxen } from "../../ToxenApp";
import Settings from "../Settings";

namespace HueManager {
  export function isEnabled(): boolean {
    return Settings.get("hueEnabled") && !!instance;
  }
  
  // Export HueAPI as static for external access (e.g., discovery, registration)
  export let HueAPIStatic = HueAPI;
  export let instance: HueAPI | null = null;

  export interface BridgeArguments {
    username: string;
    clientkey: string;
    ip: string;
    bridgeId?: string; // Add optional bridge ID for better identification
  }

  /**
   * Initializes the Hue API instance.
   */
  export function init(credentials: BridgeArguments) {
    dispose();
    
    try {
      // Validate IP format
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipRegex.test(credentials.ip)) {
        throw new Error(`Invalid IP address format: ${credentials.ip}. Please use a valid IPv4 address (e.g., 192.168.1.100)`);
      }
      
      console.log(`Initializing HueAPI with IP: ${credentials.ip}, Bridge ID: ${credentials.bridgeId || 'N/A'}`);
      
      // Create new HueAPI instance
      instance = new HueAPI(credentials.ip);
      instance.setCredentials({
        username: credentials.username,
        clientkey: credentials.clientkey
      });
      
      console.log(`HueManager initialized successfully`);
    } catch (error) {
      console.error("Error in HueManager.init:", error);
      throw error;
    }
  }

  export function dispose() {
    if (instance) {
      try { 
        stop(); 
      } catch (error) { 
        console.warn("Error stopping HueSync during disposal:", error);
      }
      instance = null;
    }
  }

  export let currentArea: HueEntertainmentArea | null = null;
  export function setCurrentArea(area: HueEntertainmentArea) {
    currentArea = area;
    currentLightNodes = area?.light_services.map(() => [0, 0, 0]) ?? [];
    // Reset connection state when area changes
    if (started) {
      stop();
    }
  }

  export let currentLightNodes: [number, number, number][] = [];

  let attemptingReconnect = false;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  
  export function setLightNodes(nodes: [number, number, number][]) {
    currentLightNodes = nodes;
  }

  export let started = false;
  export function transition() {
    if (isEnabled() && started && !attemptingReconnect && instance) {
      try {
        instance.sendLightColors(currentLightNodes);
      } catch (error) {
        console.error("Failed to transition lights:", error);
        if (!attemptingReconnect) {
          Toxen.error("Hue connection lost. Attempting to reconnect...", 3000);
          attemptingReconnect = true;
          
          // Clear any existing reconnect timeout
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          // Attempt to reconnect after a delay
          reconnectTimeout = setTimeout(async () => {
            try {
              await stop();
              await start(true);
              Toxen.log("Hue connection restored!", 2000);
            } catch (reconnectError) {
              console.error("Reconnection failed:", reconnectError);
              Toxen.error("Failed to reconnect to Hue bridge", 3000);
              attemptingReconnect = false;
            }
          }, 2000);
        }
      }
    }
  }

  export async function start(bypass = false) {
    console.log(`Starting Hue Entertainment - started: ${started}, currentArea: ${!!currentArea}, bypass: ${bypass}`);
    if (!bypass && (started || !currentArea || !instance)) return;
    
    try {
      console.log("Starting entertainment streaming with Hue Bridge...");
      await instance.startEntertainment(currentArea);
      console.log("Hue Entertainment API started successfully");
      started = true;
      
      // Clear any reconnection state on successful start
      attemptingReconnect = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    } catch (error) {
      console.error("Failed to start Hue Entertainment API:", error);
      stop();
      throw error;
    }
  }

  export function stop() {
    if (!started) return;
    console.log("Stopping Hue Entertainment");
    started = false;
    
    // Clear any reconnection timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    attemptingReconnect = false;
    
    try {
      if (instance) {
        instance.stopEntertainment();
      }
    } catch (error) {
      console.warn("Error stopping Hue instance:", error);
    }
  }

  /**
   * Call this frequently to update the lights with current color data
   */
  export function update() {
    transition();
  }

  /**
   * Test entertainment streaming with an area
   */
  export async function testEntertainmentStreaming(area: HueEntertainmentArea, duration = 5000): Promise<boolean> {
    if (!instance) {
      throw new Error("HueManager not initialized");
    }
    
    return await instance.testEntertainmentStreaming(area, duration);
  }
}

export default HueManager;