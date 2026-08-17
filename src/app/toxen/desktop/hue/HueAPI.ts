/**
 * Philips Hue CLIP v2 + Entertainment (streaming) client for Toxen.
 *
 * REST goes over https://<bridge-ip>/clip/v2 (self-signed cert — covered by the
 * `ignore-certificate-errors` switch in main.ts). Streaming goes over DTLS 1.2
 * PSK on UDP port 2100 using the binary HueStream v2 protocol.
 *
 * Desktop-only: this module must only ever be imported from the desktop
 * controller graph (HueManager -> DesktopController), never from shared code.
 */

import Settings from "../../Settings";

// Type-only import — erased at compile time, keeps node-dtls-client out of
// every bundle graph.
import type { dtls as DtlsNS } from "node-dtls-client";

// Deliberately a lazy runtime require(), not an import (same reasoning as
// Discord.ts): node-dtls-client is a Node-only ESM package; letting Vite see it
// means esbuild pre-bundles it for the browser and breaks it. Node 24
// (Electron 43) supports require() of ESM natively. Lazy so a hueDebug DEBUG
// env can be set before the `debug` package initializes, and so a load failure
// surfaces as a connect error instead of an import crash.
let _dtls: typeof DtlsNS | null = null;
function loadDtls(): typeof DtlsNS {
  if (!_dtls) {
    if (Settings.get("hueDebug")) process.env.DEBUG = "node-dtls-client*";
    _dtls = (require("node-dtls-client") as typeof import("node-dtls-client")).dtls;
  }
  return _dtls;
}

/** Logs only when the hueDebug setting is on; never called from per-frame paths. */
function hueLog(...args: any[]) {
  if (Settings.get("hueDebug")) console.log("[Hue]", ...args);
}

export interface HueBridgeDevice {
  id: string;
  internalipaddress: string;
  port?: number;
}

export interface HueCredentials {
  username: string;
  clientkey: string;
}

export interface HueRegistrationResponse {
  username: string;
  clientkey: string;
}

export interface HuePosition {
  x: number;
  y: number;
  z: number;
}

export interface HueResourceNode {
  rid: string;
  rtype: string;
}

export interface HueEntertainmentChannel {
  channel_id: number;
  position: HuePosition;
  members: Array<{
    index: number;
    service: HueResourceNode;
  }>;
}

export interface HueServiceLocation {
  position: HuePosition;
  positions: HuePosition[];
  service: HueResourceNode;
}

export interface HueEntertainmentArea {
  id: string;
  type: string;
  name: string;
  metadata: {
    name: string;
  };
  channels: HueEntertainmentChannel[];
  configuration_type: string;
  light_services: HueResourceNode[];
  locations: {
    service_locations: HueServiceLocation[];
  };
  status: 'active' | 'inactive';
  stream_proxy: {
    mode: string;
    node: HueResourceNode;
  };
}

export interface HueLight {
  id: string;
  type: string;
  metadata: {
    name: string;
  };
  on: {
    on: boolean;
  };
  dimming: {
    brightness: number;
  };
  color?: {
    xy: {
      x: number;
      y: number;
    };
  };
  color_temperature?: {
    mirek: number;
  };
}

export interface HueApiResponse<T> {
  errors?: Array<{
    description: string;
  }>;
  data?: T;
}

export type HueRGB = [number, number, number];

export interface HueChannelFrame {
  channelId: number;
  rgb: HueRGB;
}

interface HueDTLSClientHooks {
  /** Fired when the socket closes after a successful handshake (peer drop, network loss). */
  onClosed?: () => void;
  /** Fired on socket errors after a successful handshake. */
  onError?: (error: Error) => void;
}

// HueStream v2 header: "HueStream" (9) + version (2) + sequence (1) +
// reserved (2) + colorspace (1) + reserved (1) + entertainment config id (36).
const HEADER_SIZE = 52;
const SEQUENCE_OFFSET = 11;
const BYTES_PER_CHANNEL = 7;

/**
 * DTLS client for the Hue Entertainment stream.
 * PSK identity is the hue-application-id, PSK is the binary clientkey.
 */
class HueDTLSClient {
  private dtlsSocket: DtlsNS.Socket | null = null;
  private isConnected = false;
  private sequence = 0;
  private messageBuffer: Buffer | null = null;
  private channelCapacity = 0;

  constructor(
    private readonly bridgeIp: string,
    private readonly credentials: HueCredentials,
    private readonly entertainmentAreaId: string,
    private readonly applicationId: string,
    private readonly hooks: HueDTLSClientHooks = {},
  ) { }

  public get connected() {
    return this.isConnected;
  }

  public async connect(timeout = 5000): Promise<void> {
    hueLog(`DTLS connect to ${this.bridgeIp}:2100 as ${this.applicationId}`);
    const dtls = loadDtls();

    const options: DtlsNS.Options = {
      type: "udp4",
      address: this.bridgeIp,
      port: 2100,
      timeout,
      ciphers: ["TLS_PSK_WITH_AES_128_GCM_SHA256"],
      psk: {
        [this.applicationId]: Buffer.from(this.credentials.clientkey, "hex"),
      },
    };

    this.dtlsSocket = dtls.createSocket(options);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeoutHandler = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.disconnect();
        reject(new Error(`DTLS handshake timed out after ${timeout}ms`));
      }, timeout + 1000); // extra headroom beyond the library's own timeout

      this.dtlsSocket!.once("connected", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandler);
        this.isConnected = true;
        hueLog("DTLS connection established");
        resolve();
      });

      this.dtlsSocket!.once("error", (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandler);
        this.isConnected = false;
        reject(error);
      });
    });

    // Post-handshake lifecycle hooks so the manager can react to mid-stream drops.
    this.dtlsSocket!.on("close", () => {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      if (wasConnected) {
        hueLog("DTLS stream closed by peer or network");
        this.hooks.onClosed?.();
      }
    });
    this.dtlsSocket!.on("error", (error: Error) => {
      if (this.isConnected) {
        this.isConnected = false;
        this.hooks.onError?.(error);
      }
    });
  }

  public disconnect(): void {
    void this.disconnectAndWait();
  }

  /**
   * Closes the socket and resolves once the close_notify has gone out and the
   * socket reports closed (bounded at 800 ms). The bridge frees its single
   * entertainment slot instantly on a clean close_notify — but flags the
   * session as hung and locks the slot out for a minute or more if the session
   * just disappears, so waiting here matters.
   */
  public disconnectAndWait(): Promise<void> {
    const socket = this.dtlsSocket;
    this.dtlsSocket = null;
    this.isConnected = false;
    this.messageBuffer = null;
    this.channelCapacity = 0;
    if (!socket) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 800);
      try {
        socket.removeAllListeners("close");
        socket.removeAllListeners("error");
        socket.on("error", () => { /* swallow errors during teardown */ });
        socket.close(() => {
          hueLog("DTLS socket closed");
          clearTimeout(timer);
          resolve();
        });
      } catch (error) {
        hueLog("Error closing DTLS socket:", error);
        clearTimeout(timer);
        resolve();
      }
    });
  }

  /**
   * Streams one frame of channel colors. Channels are addressed by their real
   * channel_id from the entertainment configuration (NOT array index — gradient
   * strips expose several channels per light service).
   */
  public sendChannels(frames: HueChannelFrame[]): void {
    if (!this.dtlsSocket || !this.isConnected) {
      throw new Error("Hue Entertainment stream is not connected");
    }

    const buf = this.getMessageBuffer(frames.length);
    buf[SEQUENCE_OFFSET] = this.sequence = (this.sequence + 1) & 0xff;

    let off = HEADER_SIZE;
    for (const frame of frames) {
      buf[off] = frame.channelId;
      // 8-bit -> 16-bit per component: (v << 8) | v maps 255 to 0xffff exactly.
      const [r, g, b] = frame.rgb;
      buf.writeUInt16BE(((r & 0xff) << 8) | (r & 0xff), off + 1);
      buf.writeUInt16BE(((g & 0xff) << 8) | (g & 0xff), off + 3);
      buf.writeUInt16BE(((b & 0xff) << 8) | (b & 0xff), off + 5);
      off += BYTES_PER_CHANNEL;
    }

    this.dtlsSocket.send(off === buf.length ? buf : buf.subarray(0, off));
  }

  /** Builds (once) and reuses the HueStream v2 message buffer. */
  private getMessageBuffer(channelCount: number): Buffer {
    if (!this.messageBuffer || this.channelCapacity < channelCount) {
      const buf = Buffer.alloc(HEADER_SIZE + channelCount * BYTES_PER_CHANNEL);
      buf.write("HueStream", 0, "ascii");   // 0-8: protocol magic
      buf[9] = 0x02;                         // 9-10: version 2.0
      buf[10] = 0x00;
      // 11: sequence (rewritten per send), 12-13: reserved
      buf[14] = 0x00;                        // 14: colorspace RGB
      // 15: reserved
      buf.write(this.entertainmentAreaId.padEnd(36, "\0"), 16, "ascii"); // 16-51
      this.messageBuffer = buf;
      this.channelCapacity = channelCount;
    }
    return this.messageBuffer;
  }
}

/**
 * Bridge REST client (CLIP v2) + entertainment streaming lifecycle.
 */
export class HueAPI {
  private credentials: HueCredentials | null = null;
  private dtlsClient: HueDTLSClient | null = null;
  private currentEntertainmentArea: HueEntertainmentArea | null = null;
  /** Fired when an established stream drops unexpectedly (not on manual stop). */
  public onStreamClosed: ((error?: Error) => void) | null = null;

  constructor(private readonly bridgeIp: string) { }

  /**
   * Discover Hue bridges on the network via Philips' discovery endpoint.
   * Requires internet access; manual IP entry is the fallback.
   */
  public static async discover(): Promise<HueBridgeDevice[]> {
    const response = await fetch("https://discovery.meethue.com/", {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Bridge discovery failed: ${response.status} ${response.statusText}`);
    }
    return await response.json() as HueBridgeDevice[];
  }

  /**
   * Register with a bridge. The user must press the physical link button first;
   * callers retry this while the bridge reports "link button not pressed".
   */
  public static async register(bridgeIp: string, deviceType = "toxen-music-player"): Promise<HueRegistrationResponse> {
    const response = await fetch(`http://${bridgeIp}/api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devicetype: deviceType, generateclientkey: true }),
    });
    if (!response.ok) {
      throw new Error(`Registration request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      if (result.error) throw new Error(result.error.description || "Registration failed");
      if (result.success) {
        return {
          username: result.success.username,
          clientkey: result.success.clientkey,
        };
      }
    }
    throw new Error("Unexpected response format from bridge");
  }

  public setCredentials(credentials: HueCredentials): void {
    this.credentials = credentials;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.credentials) {
      throw new Error("No credentials set. Call setCredentials() first.");
    }

    const response = await fetch(`https://${this.bridgeIp}${endpoint}`, {
      ...options,
      headers: {
        "hue-application-key": this.credentials.username,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Hue API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as HueApiResponse<T>;
    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].description);
    }
    if (data.data === undefined) {
      throw new Error("No data in Hue API response");
    }
    return data.data;
  }

  public async getEntertainmentAreas(): Promise<HueEntertainmentArea[]> {
    return this.makeRequest<HueEntertainmentArea[]>("/clip/v2/resource/entertainment_configuration");
  }

  public async getEntertainmentArea(id: string): Promise<HueEntertainmentArea> {
    const areas = await this.makeRequest<HueEntertainmentArea[]>(`/clip/v2/resource/entertainment_configuration/${id}`);
    if (!areas || areas.length === 0) {
      throw new Error(`Entertainment area ${id} not found`);
    }
    return areas[0];
  }

  public async getLights(): Promise<HueLight[]> {
    return this.makeRequest<HueLight[]>("/clip/v2/resource/light");
  }

  /**
   * The DTLS PSK identity must be the bridge's hue-application-id for our key,
   * exposed as a response header on /auth/v1.
   */
  public async getApplicationId(): Promise<string> {
    if (!this.credentials) {
      throw new Error("No credentials set. Call setCredentials() first.");
    }
    try {
      const response = await fetch(`https://${this.bridgeIp}/auth/v1`, {
        headers: { "hue-application-key": this.credentials.username },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const appId = response.headers.get("hue-application-id");
      if (!appId) throw new Error("no hue-application-id header in response");
      hueLog(`hue-application-id: ${appId}`);
      return appId;
    } catch (error) {
      // A username-identity handshake usually fails; make the fallback loud
      // because a silent one turns into an opaque DTLS timeout.
      console.warn(
        "[Hue] Could not fetch hue-application-id, falling back to username as PSK identity — " +
        "the DTLS handshake will likely fail. Check bridge reachability and credentials.",
        error
      );
      return this.credentials.username;
    }
  }

  private async setStreamingAction(areaId: string, action: "start" | "stop"): Promise<void> {
    await this.makeRequest(`/clip/v2/resource/entertainment_configuration/${areaId}`, {
      method: "PUT",
      body: JSON.stringify({ action }),
    });
  }

  /**
   * Activates the entertainment area and connects the DTLS stream.
   * The bridge only listens on UDP 2100 for a short window after the start
   * action, so nothing may be awaited between the start PUT and the connect.
   */
  public async startEntertainment(entertainmentArea: HueEntertainmentArea, timeout = 5000): Promise<void> {
    if (!this.credentials) throw new Error("No credentials set");

    hueLog(`Starting entertainment for area "${entertainmentArea.metadata?.name ?? entertainmentArea.id}"`);
    this.currentEntertainmentArea = entertainmentArea;

    try {
      // Fetch the application id BEFORE the start action so the REST->DTLS gap
      // stays minimal.
      const applicationId = await this.getApplicationId();

      // Another session (a crashed Toxen, the Hue Sync app, or our own previous
      // stream still winding down) may be holding the area; a stop-then-start
      // recovers it. The bridge needs a moment to release UDP 2100 — 300 ms is
      // not enough and leads to handshake timeouts, ~1 s is reliable.
      try {
        const fresh = await this.getEntertainmentArea(entertainmentArea.id);
        if (fresh.status === "active") {
          hueLog("Area is already active; stopping the existing session first");
          await this.setStreamingAction(entertainmentArea.id, "stop");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        hueLog("Pre-start status check failed (continuing):", error);
      }

      await this.setStreamingAction(entertainmentArea.id, "start");

      // Connect immediately while port 2100 is open.
      this.dtlsClient = new HueDTLSClient(
        this.bridgeIp,
        this.credentials,
        entertainmentArea.id,
        applicationId,
        {
          onClosed: () => this.handleStreamDrop(),
          onError: (error) => this.handleStreamDrop(error),
        }
      );
      await this.dtlsClient.connect(timeout);
      hueLog("Entertainment streaming started");
    } catch (error) {
      this.currentEntertainmentArea = null;
      if (this.dtlsClient) {
        this.dtlsClient.disconnect();
        this.dtlsClient = null;
      }
      // Release the area again — leaving it "active" with no stream poisons
      // the next attempt (the bridge keeps 2100 bound to the dead session).
      try {
        await this.setStreamingAction(entertainmentArea.id, "stop");
      } catch {
        // Best effort; the bridge times it out on its own.
      }
      throw error;
    }
  }

  private handleStreamDrop(error?: Error) {
    if (!this.dtlsClient) return; // manual stop already in progress
    this.dtlsClient.disconnect();
    this.dtlsClient = null;
    this.currentEntertainmentArea = null;
    this.onStreamClosed?.(error);
  }

  /**
   * Closes the DTLS stream first, then releases the area via REST. The close
   * MUST fully land before the REST stop: if the stop reaches the bridge while
   * it still considers the DTLS session live, it treats the session as hung
   * and locks the entertainment slot out for a minute or more.
   */
  public async stopEntertainment(): Promise<void> {
    const areaId = this.currentEntertainmentArea?.id;
    this.currentEntertainmentArea = null;

    if (this.dtlsClient) {
      const client = this.dtlsClient;
      this.dtlsClient = null;
      await client.disconnectAndWait();
    }

    if (areaId) {
      try {
        await this.setStreamingAction(areaId, "stop");
        hueLog("Entertainment area released");
      } catch (error) {
        hueLog("Failed to release entertainment area (it will time out on its own):", error);
      }
    }
  }

  /**
   * Synchronous best-effort teardown for beforeunload: closes the DTLS socket
   * and fires (without awaiting) the REST stop so the bridge releases the area.
   * The bridge times the stream out on its own after ~10 s regardless.
   */
  public shutdownSync(): void {
    const areaId = this.currentEntertainmentArea?.id;
    this.currentEntertainmentArea = null;
    if (this.dtlsClient) {
      this.dtlsClient.disconnect();
      this.dtlsClient = null;
    }
    if (areaId && this.credentials) {
      fetch(`https://${this.bridgeIp}/clip/v2/resource/entertainment_configuration/${areaId}`, {
        method: "PUT",
        keepalive: true,
        headers: {
          "hue-application-key": this.credentials.username,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "stop" }),
      }).catch(() => { /* best effort */ });
    }
  }

  /** Streams one frame. Throws if the stream is not connected. */
  public sendChannels(frames: HueChannelFrame[]): void {
    if (!this.dtlsClient) {
      throw new Error("Hue Entertainment stream is not active");
    }
    this.dtlsClient.sendChannels(frames);
  }

  public isStreamingActive(): boolean {
    return !!this.dtlsClient?.connected && !!this.currentEntertainmentArea;
  }

  public getCurrentEntertainmentArea(): HueEntertainmentArea | null {
    return this.currentEntertainmentArea;
  }

  /** Bridge config; Entertainment needs firmware 1948086000 or newer. */
  public async getBridgeInfo(): Promise<{ swversion?: string; apiversion?: string;[key: string]: any }> {
    const response = await fetch(`https://${this.bridgeIp}/api/0/config`);
    if (!response.ok) {
      throw new Error(`Bridge config request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  public supportsEntertainment(swversion: string | undefined): boolean {
    return !!swversion && parseInt(swversion) >= 1948086000;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.getBridgeInfo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * One-shot DTLS diagnostic: activates the area, handshakes, streams a short
   * color cycle at 50 Hz, then tears down cleanly. Returns a human-readable log.
   *
   * The test MUST stream at a healthy rate for its whole lifetime — the bridge
   * flags sessions that only see sparse frames as hung and locks the
   * entertainment slot out for over a minute afterwards.
   */
  public async quickDTLSTest(entertainmentArea: HueEntertainmentArea): Promise<string> {
    const lines: string[] = [];
    try {
      const info = await this.getBridgeInfo();
      lines.push(`Bridge firmware: ${info.swversion ?? "unknown"} (Entertainment ${this.supportsEntertainment(info.swversion) ? "supported" : "NOT supported"})`);
      const applicationId = await this.getApplicationId();
      lines.push(`PSK identity: ${applicationId}${applicationId === this.credentials?.username ? " (FALLBACK to username — handshake will likely fail)" : ""}`);
      lines.push(`Area status before start: ${(await this.getEntertainmentArea(entertainmentArea.id)).status}`);

      await this.startEntertainment(entertainmentArea, 5000);
      lines.push("DTLS handshake: OK");

      // ~2 s red/green/blue cycle at 50 Hz — visible on the lights, and a
      // healthy stream so the teardown leaves the bridge clean.
      const colors: HueRGB[] = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
      const start = Date.now();
      while (Date.now() - start < 2000) {
        const color = colors[Math.floor((Date.now() - start) / 700) % colors.length];
        this.sendChannels(entertainmentArea.channels.map(c => ({ channelId: c.channel_id, rgb: color })));
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      lines.push(`Streamed a 2 s color cycle to ${entertainmentArea.channels.length} channel(s) at 50 Hz`);
      await this.stopEntertainment();
      lines.push("Stream stopped cleanly");
    } catch (error: any) {
      lines.push(`FAILED: ${error?.message ?? error}`);
      await this.stopEntertainment().catch(() => { /* best effort */ });
    }
    return lines.join("\n");
  }
}

export default HueAPI;
