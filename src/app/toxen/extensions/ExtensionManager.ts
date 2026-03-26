import Settings, { VisualizerStyleOption } from "../Settings";
import CrossPlatform from "../desktop/CrossPlatform";
import Theme from "../Theme";

// ─── Types ───────────────────────────────────────────────────────────

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  authorId?: number;
  description: string;
  main?: string;
  /** Whether this extension is compatible with the Toxen web client. Web-compatible extensions must not use Node.js or Electron APIs. */
  webCompatible?: boolean;
  visualizers?: ExtensionVisualizerManifest[];
  themes?: ExtensionThemeManifest[];
}

export interface ExtensionThemeManifest {
  name: string;
  displayName?: string;
  description?: string;
  styles: Record<string, { value: any }>;
  customCSS?: string;
  /** Whether this theme entry is compatible with the Toxen web client. Defaults to the parent extension's webCompatible flag. */
  webCompatible?: boolean;
}

export interface ExtensionVisualizerManifest {
  id: string;
  name: string;
  options?: VisualizerStyleOption[];
}

export interface VisualizerRenderContext {
  ctx: CanvasRenderingContext2D;
  dataArray: Uint8Array;
  len: number;
  dataSize: number;
  vWidth: number;
  vHeight: number;
  vLeft: number;
  vTop: number;
  time: number;
  dynLight: number;
  opacity: number;
  pulseEnabled: boolean;
  storedColor: string;
  isRainbow: boolean;
  isGlow: boolean;
  intensityMultiplier: number;
  getMaxHeight(mult?: number): number;
  getMaxWidth(mult?: number): number;
  setBarShadowBlur(val: number): void;
  setRainbowIfEnabled(x: number, y: number, w: number, h: number, i: number): void;
  getOption(key: string): any;
}

export type VisualizerRendererFn = (rc: VisualizerRenderContext) => void;

export interface ToxenExtensionAPI {
  apiVersion: number;
  registerVisualizer(localId: string, renderFn: VisualizerRendererFn): void;
}

export interface ExtensionExports {
  activate(api: ToxenExtensionAPI): void;
  deactivate?(): void;
}

// ─── Extension Class ─────────────────────────────────────────────────

/**
 * Shared helper that builds a ToxenExtensionAPI for a given extension ID + manifest.
 * Used by both the desktop `Extension` and web `WebExtension` classes to avoid duplication.
 */
function buildExtensionAPI(
  extensionId: string,
  manifest: ExtensionManifest,
  apiVersion: number
): ToxenExtensionAPI {
  return {
    apiVersion,
    registerVisualizer: (localId, renderFn) => {
      const fullId = `ext:${extensionId}:${localId}`;
      ExtensionManager.visualizerRenderers.set(fullId, renderFn);

      const vizManifest = manifest.visualizers?.find(v => v.id === localId);
      if (vizManifest?.options) {
        ExtensionManager.visualizerOptions.set(fullId, vizManifest.options);
      }
      if (vizManifest?.name) {
        ExtensionManager.visualizerNames.set(fullId, vizManifest.name);
      }
    },
  };
}

export class Extension {
  /**
   * API version that extensions must target. Incremented when large additions or breaking changes are made to the API.
   */
  public static apiVersion = 1;
  
  public manifest: ExtensionManifest;
  public dirPath: string;
  public enabled: boolean;
  public loaded: boolean = false;
  private exports: ExtensionExports | null = null;

  constructor(manifest: ExtensionManifest, dirPath: string, enabled: boolean) {
    this.manifest = manifest;
    this.dirPath = dirPath;
    this.enabled = enabled;
  }

  public async load(): Promise<void> {
    if (this.loaded) return;

    const Path = await import("path");
    const entryFile = this.manifest.main ?? "index.js";
    const entryPath = Path.resolve(this.dirPath, entryFile);

    try {
      // Clear require cache so reloads work
      delete require.cache[require.resolve(entryPath)];
      this.exports = require(entryPath) as ExtensionExports;
    } catch (e) {
      console.error(`[Extensions] Failed to require extension "${this.manifest.id}":`, e);
      return;
    }

    if (typeof this.exports?.activate !== "function") {
      console.error(`[Extensions] Extension "${this.manifest.id}" has no activate() export.`);
      this.exports = null;
      return;
    }

    const api = buildExtensionAPI(this.manifest.id, this.manifest, Extension.apiVersion);

    try {
      this.exports.activate(api);
      this.loaded = true;
      console.log(`[Extensions] Loaded extension "${this.manifest.name}" v${this.manifest.version}`);
    } catch (e) {
      console.error(`[Extensions] Error activating extension "${this.manifest.id}":`, e);
      this.exports = null;
    }
  }

  public unload(): void {
    if (!this.loaded || !this.exports) return;

    try {
      this.exports.deactivate?.();
    } catch (e) {
      console.error(`[Extensions] Error deactivating extension "${this.manifest.id}":`, e);
    }

    // Remove registered visualizers
    for (const [key] of ExtensionManager.visualizerRenderers) {
      if (key.startsWith(`ext:${this.manifest.id}:`)) {
        ExtensionManager.visualizerRenderers.delete(key);
        ExtensionManager.visualizerOptions.delete(key);
        ExtensionManager.visualizerNames.delete(key);
      }
    }

    this.exports = null;
    this.loaded = false;
  }
}

// ─── Web Extension ───────────────────────────────────────────────────

/** Persisted data for a web extension stored in localStorage. */
export interface WebExtensionData {
  storeId: number;
  manifest: ExtensionManifest;
  enabled: boolean;
}

/**
 * A web-compatible extension loaded directly from the server CDN.
 * Extension code is fetched as text and evaluated in a sandboxed CommonJS-like context.
 * Node.js / Electron APIs must NOT be used by web extensions.
 */
export class WebExtension {
  public static apiVersion = Extension.apiVersion;

  public manifest: ExtensionManifest;
  public storeId: number;
  public enabled: boolean;
  public loaded: boolean = false;
  private exports: ExtensionExports | null = null;

  constructor(manifest: ExtensionManifest, storeId: number, enabled: boolean) {
    this.manifest = manifest;
    this.storeId = storeId;
    this.enabled = enabled;
  }

  public async load(): Promise<void> {
    if (this.loaded) return;

    const entryFile = this.manifest.main ?? "index.js";
    const url = `${Settings.getServer()}/extensions/store/${this.storeId}/serve/${entryFile}`;

    let jsCode: string;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      jsCode = await res.text();
    } catch (e) {
      console.error(`[Extensions] Failed to fetch web extension "${this.manifest.id}":`, e);
      return;
    }

    // Evaluate in a sandboxed CommonJS-like context.
    // require() is intentionally unsupported — web extensions must be self-contained.
    const moduleObj: { exports: any } = { exports: {} };
    const requireShim = (mod: string) => {
      throw new Error(`[Web Extensions] require('${mod}') is not available in web extensions. Web extensions must not use Node.js or Electron APIs.`);
    };
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("require", "module", "exports", jsCode);
      fn(requireShim, moduleObj, moduleObj.exports);
    } catch (e) {
      console.error(`[Extensions] Failed to evaluate web extension "${this.manifest.id}":`, e);
      return;
    }

    this.exports = moduleObj.exports as ExtensionExports;
    if (typeof this.exports?.activate !== "function") {
      console.error(`[Extensions] Web extension "${this.manifest.id}" has no activate() export.`);
      this.exports = null;
      return;
    }

    const api = buildExtensionAPI(this.manifest.id, this.manifest, WebExtension.apiVersion);

    try {
      this.exports.activate(api);
      this.loaded = true;
      console.log(`[Extensions] Loaded web extension "${this.manifest.name}" v${this.manifest.version}`);
    } catch (e) {
      console.error(`[Extensions] Error activating web extension "${this.manifest.id}":`, e);
      this.exports = null;
    }
  }

  public unload(): void {
    if (!this.loaded || !this.exports) return;

    try {
      this.exports.deactivate?.();
    } catch (e) {
      console.error(`[Extensions] Error deactivating web extension "${this.manifest.id}":`, e);
    }

    for (const [key] of ExtensionManager.visualizerRenderers) {
      if (key.startsWith(`ext:${this.manifest.id}:`)) {
        ExtensionManager.visualizerRenderers.delete(key);
        ExtensionManager.visualizerOptions.delete(key);
        ExtensionManager.visualizerNames.delete(key);
      }
    }

    this.exports = null;
    this.loaded = false;
  }
}

// ─── Extension Manager ───────────────────────────────────────────────

export default class ExtensionManager {
  public static extensions: Map<string, Extension> = new Map();
  /** Web extensions loaded from the server CDN (web mode only). */
  public static webExtensions: Map<string, WebExtension> = new Map();
  public static visualizerRenderers: Map<string, VisualizerRendererFn> = new Map();
  public static visualizerOptions: Map<string, VisualizerStyleOption[]> = new Map();
  public static visualizerNames: Map<string, string> = new Map();
  public static extensionThemes: Map<string, Theme> = new Map();

  private static WEB_EXTENSIONS_STORAGE_KEY = "toxen_web_extensions";

  public static getExtensionsDir(): string {
    return CrossPlatform.getToxenDataPath("extensions");
  }

  /**
   * Scan the extensions directory and discover all extensions.
   */
  public static async discover(): Promise<void> {
    const fs = await import("fs");
    const fsp = fs.promises;
    const Path = await import("path");

    const extDir = this.getExtensionsDir();

    // Ensure extensions directory exists
    await fsp.mkdir(extDir, { recursive: true });

    // Copy bundled first-party extensions if not present
    await this.installBundledExtensions(extDir);

    let entries: string[];
    try {
      entries = await fsp.readdir(extDir);
    } catch {
      return;
    }

    const enabledMap = Settings.get("enabledExtensions") ?? {};

    for (const entry of entries) {
      const extPath = Path.resolve(extDir, entry);
      const manifestPath = Path.resolve(extPath, "extension.json");

      let stat: import("fs").Stats;
      try {
        stat = await fsp.stat(extPath);
      } catch { continue; }
      if (!stat.isDirectory()) continue;

      let manifestRaw: string;
      try {
        manifestRaw = await fsp.readFile(manifestPath, "utf-8");
      } catch { continue; }

      let manifest: ExtensionManifest;
      try {
        manifest = JSON.parse(manifestRaw);
      } catch (e) {
        console.error(`[Extensions] Invalid extension.json in "${entry}":`, e);
        continue;
      }

      if (!manifest.id || !manifest.name) {
        console.error(`[Extensions] Extension in "${entry}" missing required id/name fields.`);
        continue;
      }

      const enabled = enabledMap[manifest.id] ?? true; // New extensions enabled by default
      const ext = new Extension(manifest, extPath, enabled);
      this.extensions.set(manifest.id, ext);

      // Register themes from manifest (themes are data-driven, don't need JS)
      if (enabled) {
        this.registerThemesFromManifest(manifest);
      }
    }

    console.log(`[Extensions] Discovered ${this.extensions.size} extension(s).`);
  }

  /**
   * Copy bundled extensions from app resources to the user's extensions folder.
   */
  private static async installBundledExtensions(extDir: string): Promise<void> {
    const fs = await import("fs");
    const fsp = fs.promises;
    const Path = await import("path");

    // Bundled extensions are in src/extensions/ (resolved relative to app root)
    let bundledDir: string;
    try {
      // In dev, __dirname points into .vite/build or similar
      // Try to find the bundled extensions relative to the app root
      const appRoot = Path.resolve(__dirname, "../../");
      bundledDir = Path.resolve(appRoot, "src/extensions");
      await fsp.stat(bundledDir);
    } catch {
      // Bundled extensions not found — skip
      return;
    }

    let bundledEntries: string[];
    try {
      bundledEntries = await fsp.readdir(bundledDir);
    } catch { return; }

    for (const entry of bundledEntries) {
      const srcPath = Path.resolve(bundledDir, entry);
      const destPath = Path.resolve(extDir, entry);

      let srcStat: import("fs").Stats;
      try {
        srcStat = await fsp.stat(srcPath);
      } catch { continue; }
      if (!srcStat.isDirectory()) continue;

      // Only copy if destination doesn't exist
      try {
        await fsp.stat(destPath);
        continue; // Already exists
      } catch {
        // Doesn't exist — copy it
      }

      try {
        await fsp.cp(srcPath, destPath, { recursive: true });
        console.log(`[Extensions] Installed bundled extension "${entry}".`);
      } catch (e) {
        console.error(`[Extensions] Failed to install bundled extension "${entry}":`, e);
      }
    }
  }

  /**
   * Load all enabled extensions (call activate on them).
   */
  public static async loadAll(): Promise<void> {
    // Migrate legacy "whaleshark" style to "ext:whaleshark:whaleshark"
    const currentStyle = Settings.get("visualizerStyle");
    if (currentStyle === "whaleshark") {
      Settings.set("visualizerStyle", "ext:whaleshark:whaleshark" as any);
      Settings.save({ suppressNotification: true });
    }

    for (const [, ext] of this.extensions) {
      if (ext.enabled) {
        await ext.load();
      }
    }
  }

  /**
   * Enable an extension and load it.
   */
  public static async enable(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    ext.enabled = true;
    await ext.load();
    this.registerThemesFromManifest(ext.manifest);

    const enabledMap = Settings.get("enabledExtensions") ?? {};
    enabledMap[id] = true;
    Settings.set("enabledExtensions", enabledMap);
    await Settings.save({ suppressNotification: true });
  }

  /**
   * Disable an extension and unload it.
   */
  public static async disable(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;

    ext.enabled = false;
    ext.unload();
    this.unregisterThemesFromManifest(ext.manifest);

    const enabledMap = Settings.get("enabledExtensions") ?? {};
    enabledMap[id] = false;
    Settings.set("enabledExtensions", enabledMap);
    await Settings.save({ suppressNotification: true });
  }

  // ─── Web Extension Methods ─────────────────────────────────────────

  private static getStoredWebExtensions(): WebExtensionData[] {
    try {
      const stored = localStorage.getItem(this.WEB_EXTENSIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("[Extensions] Failed to parse stored web extensions from localStorage:", e);
      return [];
    }
  }

  private static saveWebExtensions(): void {
    const data: WebExtensionData[] = [];
    for (const [, ext] of this.webExtensions) {
      data.push({ storeId: ext.storeId, manifest: ext.manifest, enabled: ext.enabled });
    }
    localStorage.setItem(this.WEB_EXTENSIONS_STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Discover web extensions previously installed and stored in localStorage.
   * Call this on startup in web mode.
   */
  public static async discoverWeb(): Promise<void> {
    const stored = this.getStoredWebExtensions();
    for (const data of stored) {
      const ext = new WebExtension(data.manifest, data.storeId, data.enabled);
      this.webExtensions.set(data.manifest.id, ext);
      if (data.enabled) {
        this.registerThemesFromManifest(data.manifest);
      }
    }
    console.log(`[Extensions] Discovered ${this.webExtensions.size} web extension(s).`);
  }

  /**
   * Load all enabled web extensions (fetch JS from server and evaluate).
   */
  public static async loadAllWeb(): Promise<void> {
    for (const [, ext] of this.webExtensions) {
      if (ext.enabled) {
        await ext.load();
      }
    }
  }

  /**
   * Install (or update) a web extension from the store and enable it.
   * Fetches the manifest from the server CDN endpoint, then loads the extension.
   */
  public static async installWebExtension(storeId: number, manifest: ExtensionManifest): Promise<void> {
    // Replace existing entry if updating
    const existing = this.webExtensions.get(manifest.id);
    if (existing) {
      existing.unload();
      this.unregisterThemesFromManifest(existing.manifest);
    }

    const ext = new WebExtension(manifest, storeId, true);
    this.webExtensions.set(manifest.id, ext);
    await ext.load();
    this.registerThemesFromManifest(manifest);
    this.saveWebExtensions();
  }

  /**
   * Enable a previously installed web extension.
   */
  public static async enableWeb(id: string): Promise<void> {
    const ext = this.webExtensions.get(id);
    if (!ext) return;

    ext.enabled = true;
    await ext.load();
    this.registerThemesFromManifest(ext.manifest);
    this.saveWebExtensions();
  }

  /**
   * Disable a web extension without removing it.
   */
  public static async disableWeb(id: string): Promise<void> {
    const ext = this.webExtensions.get(id);
    if (!ext) return;

    ext.enabled = false;
    ext.unload();
    this.unregisterThemesFromManifest(ext.manifest);
    this.saveWebExtensions();
  }

  /**
   * Remove a web extension entirely (unload and delete from localStorage).
   */
  public static removeWebExtension(id: string): void {
    const ext = this.webExtensions.get(id);
    if (ext) {
      ext.unload();
      this.unregisterThemesFromManifest(ext.manifest);
      this.webExtensions.delete(id);
    }
    this.saveWebExtensions();
  }

  /**
   * Get a visualizer render function by its full style ID (e.g. "ext:whaleshark:whaleshark").
   */
  public static getVisualizerRenderer(styleId: string): VisualizerRendererFn | undefined {
    return this.visualizerRenderers.get(styleId);
  }

  /**
   * Get the style options for an extension visualizer.
   */
  public static getVisualizerOptions(styleId: string): VisualizerStyleOption[] | undefined {
    return this.visualizerOptions.get(styleId);
  }

  /**
   * Get dropdown entries for all loaded extension visualizers.
   */
  public static getVisualizerDropdownEntries(): { value: string; label: string }[] {
    const entries: { value: string; label: string }[] = [];
    for (const [fullId, name] of this.visualizerNames) {
      entries.push({ value: fullId, label: name });
    }
    return entries;
  }

  /**
   * Check if a style ID is an extension visualizer.
   */
  public static isExtensionStyle(styleId: string): boolean {
    return typeof styleId === "string" && styleId.startsWith("ext:");
  }

  // ─── Theme Helpers ─────────────────────────────────────────────────

  private static registerThemesFromManifest(manifest: ExtensionManifest): void {
    if (!manifest.themes) return;
    for (const themeDef of manifest.themes) {
      const fullId = `ext:${manifest.id}:${themeDef.name}`;
      const theme = Theme.create({
        name: fullId,
        displayName: themeDef.displayName || themeDef.name,
        description: themeDef.description || "",
        styles: themeDef.styles as any,
        customCSS: themeDef.customCSS,
      });
      this.extensionThemes.set(fullId, theme);
    }
  }

  private static unregisterThemesFromManifest(manifest: ExtensionManifest): void {
    if (!manifest.themes) return;
    for (const themeDef of manifest.themes) {
      this.extensionThemes.delete(`ext:${manifest.id}:${themeDef.name}`);
    }
  }

  /**
   * Get dropdown entries for all registered extension themes.
   */
  public static getThemeDropdownEntries(): { value: string; label: string }[] {
    const entries: { value: string; label: string }[] = [];
    for (const [fullId, theme] of this.extensionThemes) {
      entries.push({ value: fullId, label: theme.getDisplayName() });
    }
    return entries;
  }

  /**
   * Get an extension theme by its full ID.
   */
  public static getTheme(themeId: string): Theme | undefined {
    return this.extensionThemes.get(themeId);
  }
}
