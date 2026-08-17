import HueAPI, {
  HueBridgeDevice,
  HueChannelFrame,
  HueEntertainmentArea,
  HueEntertainmentChannel,
  HueRGB,
  HueRegistrationResponse,
} from "./HueAPI";
import { Toxen } from "../../../ToxenApp";
import Settings from "../../Settings";

export type HueStatus = "disabled" | "unconfigured" | "connecting" | "connected" | "streaming" | "error";

/** Perceptual correction so mid-level values don't look washed out on LEDs. */
const GAMMA = 1.6;
/** How long a storyboard write keeps control before auto-sync resumes. */
const STORYBOARD_TTL_MS = 250;
/** Envelope smoothing factors (per tick): fast attack, slow release. */
const ATTACK = 0.55;
const RELEASE = 0.12;
/** Brightness floor while syncing so the lights never fully die mid-song. */
const SYNC_FLOOR = 0.03;
/** Idle brightness while paused — doubles as the DTLS keepalive frame. */
const IDLE_LEVEL = 0.08;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function hexToRgb(hex: string): HueRGB {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return [255, 255, 255];
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Full-saturation color wheel — RGB of the visualizer's `hsl(deg, 100%, 50%)`. */
function hueWheelRgb(hueDeg: number): HueRGB {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = Math.round(255 * (1 - Math.abs((h % 2) - 1)));
  switch (Math.floor(h)) {
    case 0: return [255, x, 0];
    case 1: return [x, 255, 0];
    case 2: return [0, 255, x];
    case 3: return [0, x, 255];
    case 4: return [x, 0, 255];
    default: return [255, 0, x];
  }
}

/**
 * Drives Philips Hue Entertainment areas in sync with Toxen's playback.
 *
 * Owns its own send loop (setInterval, deliberately NOT the visualizer's rAF
 * loop): the DTLS stream needs frames every few seconds to stay alive, and rAF
 * pauses when the window is hidden while music keeps playing. Storyboard
 * components write colors in with a short TTL; when no storyboard event holds
 * control, the manager computes audio-reactive colors itself.
 *
 * Desktop-only; reached through `Toxen.hue` (null on web). Self-reconciles from
 * Settings like Discord does — call `reconcile()` after anything Hue-related
 * changes and it figures out the rest.
 */
export default class HueManager {
  private api: HueAPI | null = null;
  private area: HueEntertainmentArea | null = null;
  private channels: HueEntertainmentChannel[] = [];
  /** Real channel ids from the entertainment configuration (NOT array indices). */
  private channelIds: number[] = [];
  /** Per-channel band assignment for spectrum mode: 0 = bass, 1 = mid, 2 = treble. */
  private channelBands: number[] = [];
  /** Per-channel 0..1 rank by x position — the rainbow spread offset. */
  private channelRankFractions: number[] = [];

  private sendTimer: ReturnType<typeof setInterval> | null = null;
  private sendTimerRate = 0;

  private _status: HueStatus = "disabled";
  private _lastError: string | null = null;
  /** Runtime toggle (Ctrl+H); intentionally not persisted. */
  private syncEnabled = true;

  private storyboardColors: HueRGB[] | null = null;
  private storyboardControlUntil = 0;
  private autoRequestUntil = 0;

  private envelope = 0;
  private bandEnvelopes: [number, number, number] = [0, 0, 0];

  private connecting = false;
  private connectedKey = "";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * The in-flight teardown of the previous session. A new handshake must wait
   * for this: the bridge allows only one DTLS client on port 2100, and
   * handshaking while the old socket is still closing times out.
   */
  private pendingStop: Promise<void> | null = null;

  constructor() {
    // Best-effort teardown so the bridge exits streaming mode when Toxen quits.
    window.addEventListener("beforeunload", () => {
      this.stopSendTimer();
      this.api?.shutdownSync();
    });
  }

  public get status(): HueStatus {
    return this._status;
  }

  public get lastError(): string | null {
    return this._lastError;
  }

  public get channelCount(): number {
    return this.channelIds.length;
  }

  public get isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  // #region Lifecycle

  /**
   * Reconciles the manager against current Settings. Idempotent and cheap when
   * nothing changed — safe to call from updateSettings(), play(), pause().
   */
  public reconcile(): void {
    if (!Settings.get("hueEnabled")) {
      if (this._status !== "disabled") this.disconnect("disabled");
      return;
    }

    const ip = Settings.get("hueBridgeIp");
    const username = Settings.get("hueUsername");
    const clientkey = Settings.get("hueClientkey");
    if (!ip || !username || !clientkey) {
      this.disconnect("unconfigured");
      return;
    }

    const fingerprint = `${ip}|${username}|${clientkey}|${Settings.get("hueEntertainmentAreaId") ?? ""}`;
    if (fingerprint === this.connectedKey && (this.connecting || this.reconnectTimer || this.api)) {
      // Config unchanged and a session is live or in progress; only the update
      // rate may need a live adjustment.
      if (this.sendTimer && this.sendTimerRate !== this.getUpdateRate()) this.startSendTimer();
      return;
    }

    this.disconnect("connecting");
    this.connectedKey = fingerprint;
    void this.connect();
  }

  /** Full teardown of the streaming session. */
  public disconnect(nextStatus: HueStatus = "disabled"): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.stopSendTimer();
    if (this.api) {
      const api = this.api;
      this.api = null;
      api.onStreamClosed = null;
      this.pendingStop = api.stopEntertainment().catch(() => { /* best effort */ });
    }
    this.area = null;
    this.channels = [];
    this.channelIds = [];
    this.channelBands = [];
    this.channelRankFractions = [];
    this.connectedKey = nextStatus === "connecting" ? this.connectedKey : "";
    this._status = nextStatus;
  }

  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    this._status = "connecting";
    this._lastError = null;

    try {
      // Let the previous session finish tearing down before handshaking anew.
      if (this.pendingStop) {
        await this.pendingStop;
        this.pendingStop = null;
      }
      const api = new HueAPI(Settings.get("hueBridgeIp"));
      api.setCredentials({
        username: Settings.get("hueUsername"),
        clientkey: Settings.get("hueClientkey"),
      });

      // Resolve the entertainment area: the saved one, else the first available.
      const savedAreaId = Settings.get("hueEntertainmentAreaId");
      let area: HueEntertainmentArea;
      if (savedAreaId) {
        area = await api.getEntertainmentArea(savedAreaId);
      } else {
        const areas = await api.getEntertainmentAreas();
        if (!areas.length) throw new Error("No entertainment areas found on the bridge. Create one in the Hue app first.");
        area = areas[0];
        // connectedKey is updated first so the reconcile() triggered by the
        // save recognizes this session and does not reconnect.
        this.connectedKey = `${Settings.get("hueBridgeIp")}|${Settings.get("hueUsername")}|${Settings.get("hueClientkey")}|${area.id}`;
        void Settings.apply({ hueEntertainmentAreaId: area.id }, true);
      }

      this.api = api;
      this.setArea(area);
      this._status = "connected";

      api.onStreamClosed = (error) => this.scheduleReconnect(error ?? new Error("Stream closed by bridge"));
      await api.startEntertainment(area);

      this.startSendTimer();
      this._status = "streaming";
      this.reconnectAttempts = 0;
    } catch (error: any) {
      this._status = "error";
      this._lastError = error?.message ?? String(error);
      this.stopSendTimer();
      if (this.api) {
        const api = this.api;
        this.api = null;
        api.onStreamClosed = null;
        this.pendingStop = api.stopEntertainment().catch(() => { /* best effort */ });
      }
      this.scheduleReconnect(error, /* silent */ this.reconnectAttempts > 0);
    } finally {
      this.connecting = false;
    }
  }

  private setArea(area: HueEntertainmentArea): void {
    this.area = area;
    this.channels = area.channels ?? [];
    this.channelIds = this.channels.map(c => c.channel_id);
    this.computeChannelLayout();
  }

  /**
   * Derives the spatial layout from channel positions (sorted by x):
   * frequency band per channel for spectrum mode (leftmost third = bass,
   * middle = mid, rightmost = treble) and the 0..1 rank fraction used to
   * spread the rainbow across the room.
   */
  private computeChannelLayout(): void {
    const count = this.channels.length;
    this.channelBands = new Array<number>(count).fill(0);
    this.channelRankFractions = new Array<number>(count).fill(0);
    if (!count) return;
    const order = this.channels
      .map((c, i) => ({ i, x: c.position?.x ?? 0 }))
      .sort((a, b) => a.x - b.x);
    order.forEach(({ i }, rank) => {
      this.channelBands[i] = Math.min(2, Math.floor((rank / count) * 3));
      this.channelRankFractions[i] = count > 1 ? rank / count : 0;
    });
  }

  private scheduleReconnect(error: any, silent = false): void {
    if (this.reconnectTimer) return;
    if (!Settings.get("hueEnabled")) return;

    this.stopSendTimer();
    if (this.api) {
      const api = this.api;
      this.api = null;
      api.onStreamClosed = null;
      this.pendingStop = api.stopEntertainment().catch(() => { /* best effort */ });
    }
    this._status = "error";
    this._lastError = error?.message ?? String(error);
    if (!silent && this.reconnectAttempts === 0) {
      Toxen.error(`Hue connection lost: ${this._lastError}. Reconnecting — this can take a minute or two…`, 5000);
    }

    // Quiet backoff, measured against a real bridge: after a session ends the
    // bridge's single entertainment slot goes into a cooldown, and every failed
    // attempt REFRESHES it (30 s-interval retries kept a bridge locked for 3+
    // minutes, while ~90 s of full silence recovers it every time). Few, widely
    // spaced attempts are the only strategy that converges.
    const RETRY_DELAYS = [20_000, 45_000, 90_000];
    const delay = RETRY_DELAYS[Math.min(this.reconnectAttempts++, RETRY_DELAYS.length - 1)];
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  // #endregion

  // #region Send loop

  private getUpdateRate(): number {
    return clamp(Settings.get("hueUpdateRate", 50), 10, 60);
  }

  private startSendTimer(): void {
    this.stopSendTimer();
    this.sendTimerRate = this.getUpdateRate();
    this.sendTimer = setInterval(() => this.tick(), Math.round(1000 / this.sendTimerRate));
  }

  private stopSendTimer(): void {
    if (this.sendTimer) {
      clearInterval(this.sendTimer);
      this.sendTimer = null;
    }
  }

  /** One frame of the entertainment stream. Runs on its own interval, never rAF. */
  private tick(): void {
    const api = this.api;
    if (!api?.isStreamingActive() || !this.channelIds.length) return;

    const now = Date.now();
    let colors: HueRGB[];
    if (this.storyboardColors && now < this.storyboardControlUntil) {
      colors = this.storyboardColors;
    } else if ((this.syncEnabled || now < this.autoRequestUntil) && this.isMusicPlaying()) {
      colors = this.computeAutoColors();
    } else {
      // Paused or sync toggled off: hold a dim idle color. This frame is also
      // the keepalive that stops the bridge from timing the stream out.
      colors = this.computeBaseColors().map(c => c.map(v => v * IDLE_LEVEL) as HueRGB);
    }

    const master = clamp(Settings.get("hueBrightness", 100) / 100, 0, 1);
    const frames: HueChannelFrame[] = this.channelIds.map((channelId, i) => {
      const rgb = colors[i] ?? colors[0] ?? [0, 0, 0];
      return {
        channelId,
        rgb: [
          Math.round(255 * Math.pow(clamp(rgb[0] / 255, 0, 1) * master, GAMMA)),
          Math.round(255 * Math.pow(clamp(rgb[1] / 255, 0, 1) * master, GAMMA)),
          Math.round(255 * Math.pow(clamp(rgb[2] / 255, 0, 1) * master, GAMMA)),
        ] as HueRGB,
      };
    });

    try {
      api.sendChannels(frames);
    } catch (error) {
      this.scheduleReconnect(error);
    }
  }

  private isMusicPlaying(): boolean {
    return !(Toxen.musicPlayer?.media?.paused ?? true);
  }

  /**
   * The color the lights should base themselves on. Prefers the color of the
   * most recent rendered frame — that is the only place live storyboard color
   * overrides exist (they are per-frame scratch data, wiped after each rAF
   * frame, so reading the storyboard from this interval loop would miss them).
   * Falls back to the settings chain when rendering is idle (hidden window).
   */
  private getBaseColor(): HueRGB {
    const hex = Toxen.background?.visualizer?.getRenderedVisualizerColor?.()
      ?? Toxen.background?.storyboard?.getVisualizerColor?.()
      ?? Settings.get("visualizerColor")
      ?? "#ffffff";
    return hexToRgb(hex);
  }

  /**
   * Whether rainbow mode is effective right now — the rendered frame's value
   * (storyboard override included), falling back to the settings chain when
   * rendering is idle.
   */
  private isRainbowActive(): boolean {
    return Toxen.background?.visualizer?.getRenderedVisualizerRainbow?.()
      ?? Toxen.background?.storyboard?.getVisualizerRainbow?.()
      ?? Settings.get("visualizerRainbowMode")
      ?? false;
  }

  /**
   * Per-channel full-brightness colors before audio modulation. In rainbow
   * mode the wheel turns with the visualizer's own phase — hue = songTime × 50°
   * (the exact formula the bars use), so it stays in step on screen, across
   * seeks, and freezes together with it on pause. With rainbow spread each
   * channel is offset around the wheel by its position in the room; otherwise
   * all channels share the cycling color.
   */
  private computeBaseColors(): HueRGB[] {
    if (this.isRainbowActive()) {
      const phase = (Toxen.musicPlayer?.media?.currentTime ?? 0) * 50;
      if (Settings.get("hueRainbowSpread", true) && this.channelRankFractions.length > 1) {
        return this.channelRankFractions.map(f => hueWheelRgb(phase + f * 360));
      }
      return [hueWheelRgb(phase)];
    }
    return [this.getBaseColor()];
  }

  private computeAutoColors(): HueRGB[] {
    const bases = this.computeBaseColors();
    const colorAt = (i: number) => bases[i] ?? bases[0];
    const levels = Toxen.background?.visualizer?.getAudioLevels?.();
    if (!levels) {
      return this.channelIds.map((_, i) => colorAt(i).map(v => v * 0.3) as HueRGB);
    }

    const intensity = clamp(Settings.get("hueSyncIntensity", 1), 0.1, 2);

    if (Settings.get("hueSyncMode", "uniform") === "spectrum" && this.channelBands.length > 1) {
      const raw: [number, number, number] = [levels.bass, levels.mid, levels.treble];
      for (let b = 0; b < 3; b++) {
        const factor = raw[b] > this.bandEnvelopes[b] ? ATTACK : RELEASE;
        this.bandEnvelopes[b] += (raw[b] - this.bandEnvelopes[b]) * factor;
      }
      const bandLevels = this.bandEnvelopes.map(env => clamp(env * intensity * 1.5, SYNC_FLOOR, 1));
      return this.channelBands.map((band, i) => colorAt(i).map(v => v * bandLevels[band]) as HueRGB);
    }

    const raw = 0.55 * levels.level + 0.45 * levels.bass;
    this.envelope += (raw - this.envelope) * (raw > this.envelope ? ATTACK : RELEASE);
    const level = clamp(this.envelope * intensity * 1.5, SYNC_FLOOR, 1);
    return this.channelIds.map((_, i) => colorAt(i).map(c => c * level) as HueRGB);
  }

  // #endregion

  // #region Storyboard interface

  /**
   * Storyboard override: sets every channel to one color and holds control for
   * a short TTL. Auto-sync resumes on its own when the writes stop.
   */
  public setAllChannels(rgb: HueRGB, ttlMs = STORYBOARD_TTL_MS): void {
    this.storyboardColors = [[
      clamp(rgb[0], 0, 255),
      clamp(rgb[1], 0, 255),
      clamp(rgb[2], 0, 255),
    ]];
    this.storyboardControlUntil = Date.now() + ttlMs;
  }

  /** Per-channel storyboard override, ordered like the area's channel list. */
  public setChannelColors(colors: HueRGB[], ttlMs = STORYBOARD_TTL_MS): void {
    if (!colors.length) return;
    this.storyboardColors = colors.map(c => [
      clamp(c[0], 0, 255),
      clamp(c[1], 0, 255),
      clamp(c[2], 0, 255),
    ] as HueRGB);
    this.storyboardControlUntil = Date.now() + ttlMs;
  }

  /**
   * Storyboard request for the built-in audio sync this frame — works even when
   * the user toggled sync off, so a `hueVisualizerSync` event always animates.
   */
  public requestAutoFrame(): void {
    this.autoRequestUntil = Date.now() + STORYBOARD_TTL_MS;
  }

  // #endregion

  // #region Runtime controls (shortcuts + UI)

  /** Flips the runtime sync toggle (not persisted). Returns the new state. */
  public toggleSync(): boolean {
    this.syncEnabled = !this.syncEnabled;
    return this.syncEnabled;
  }

  public nudgeBrightness(delta: number): void {
    const next = clamp(Math.round(Settings.get("hueBrightness", 100) + delta), 0, 100);
    void Settings.apply({ hueBrightness: next }, true);
    Toxen.log(`Hue brightness: ${next}%`, 1500);
  }

  // #endregion

  // #region Setup helpers (Settings UI)

  /** Instance methods (not statics) so the UI can reach them through `Toxen.hue`. */
  public discoverBridges(): Promise<HueBridgeDevice[]> {
    return HueAPI.discover();
  }

  /** Single registration attempt; the UI owns the press-the-link-button retry loop. */
  public registerBridge(bridgeIp: string): Promise<HueRegistrationResponse> {
    return HueAPI.register(bridgeIp);
  }

  /** Lists areas using the live session, or a temporary client from Settings. */
  public async getEntertainmentAreas(): Promise<HueEntertainmentArea[]> {
    return (this.api ?? this.createConfiguredApi()).getEntertainmentAreas();
  }

  private createConfiguredApi(): HueAPI {
    const ip = Settings.get("hueBridgeIp");
    const username = Settings.get("hueUsername");
    const clientkey = Settings.get("hueClientkey");
    if (!ip || !username || !clientkey) {
      throw new Error("Hue bridge is not configured. Register with a bridge first.");
    }
    const api = new HueAPI(ip);
    api.setCredentials({ username, clientkey });
    return api;
  }

  /**
   * Blinks every channel through R/G/B/white over the live stream so the user
   * can verify the area — and that every channel (gradient strip segments
   * included) responds.
   */
  public async identify(): Promise<void> {
    if (!this.api?.isStreamingActive()) {
      this.reconcile();
      // Give the connect a moment; identify is a user-clicked action.
      await new Promise(resolve => setTimeout(resolve, 2500));
      if (!this.api?.isStreamingActive()) {
        throw new Error("Hue stream is not active. Enable Hue and check the connection status first.");
      }
    }
    const steps: HueRGB[] = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0]];
    for (const color of steps) {
      this.setAllChannels(color, 700);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Returns a human-readable connection report.
   *
   * When a session is already streaming, the report covers the LIVE session
   * and no teardown happens — deliberately: tearing down and re-handshaking
   * just to test is exactly the kind of churn that can trip the bridge's
   * single-slot entertainment lockout. The full destructive test (handshake +
   * 50 Hz color cycle) only runs when nothing is streaming.
   */
  public async runDiagnostics(): Promise<string> {
    let api: HueAPI;
    try {
      api = this.createConfiguredApi();
    } catch (error: any) {
      return `Cannot run diagnostics: ${error.message}`;
    }

    // Live session: report health without touching it.
    if (this.api?.isStreamingActive() && this.area) {
      const lines = [
        `Streaming LIVE to "${this.area.metadata?.name ?? this.area.id}" (${this.channelCount} channels) at ${this.sendTimerRate} Hz.`,
        `Sync ${this.syncEnabled ? "enabled" : "toggled off (Ctrl+H)"} | mode: ${Settings.get("hueSyncMode", "uniform")} | brightness: ${Settings.get("hueBrightness", 100)}%`,
      ];
      try {
        const info = await api.getBridgeInfo();
        lines.push(`Bridge firmware: ${info.swversion ?? "unknown"} (Entertainment ${api.supportsEntertainment(info.swversion) ? "supported" : "NOT supported"})`);
      } catch (error: any) {
        lines.push(`Bridge REST check failed: ${error?.message ?? error}`);
      }
      lines.push("Everything looks healthy — the full handshake test is skipped while streaming. Use Identify to visually verify the lights.");
      return lines.join("\n");
    }

    let report: string;
    try {
      const savedAreaId = Settings.get("hueEntertainmentAreaId");
      const area = savedAreaId
        ? await api.getEntertainmentArea(savedAreaId)
        : (await api.getEntertainmentAreas())[0];
      if (!area) {
        report = "No entertainment areas found on the bridge. Create one in the Hue app first.";
      } else {
        report = `Area: ${area.metadata?.name ?? area.id} (${area.channels?.length ?? 0} channels)\n`
          + await api.quickDTLSTest(area)
          + "\n\nNote: after any streaming session ends, the bridge can refuse new connections for a while, and retrying too often extends it. "
          + "If the handshake failed or the status stays on \"error\", leave it alone for a couple of minutes (or power-cycle the bridge) — it recovers on its own.";
      }
    } catch (error: any) {
      report = `Diagnostics failed: ${error?.message ?? error}`;
    }

    // Restore whatever Settings say should be running.
    this.connectedKey = "";
    this.reconcile();
    return report;
  }

  // #endregion
}
