import Settings, { VisualizerStyleOption } from "../Settings";
import CrossPlatform from "../desktop/CrossPlatform";
import Theme from "../Theme";
import User from "../User";

// ─── Types ───────────────────────────────────────────────────────────

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  authorId?: number;
  description: string;
  main?: string;
  visualizers?: ExtensionVisualizerManifest[];
  themes?: ExtensionThemeManifest[];
}

export interface ExtensionThemeManifest {
  name: string;
  displayName?: string;
  description?: string;
  styles: Record<string, { value: any }>;
  customCSS?: string;
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

    const api: ToxenExtensionAPI = {
      apiVersion: Extension.apiVersion,
      registerVisualizer: (localId, renderFn) => {
        const fullId = `ext:${this.manifest.id}:${localId}`;
        ExtensionManager.visualizerRenderers.set(fullId, renderFn);

        // Register options from manifest
        const vizManifest = this.manifest.visualizers?.find(v => v.id === localId);
        if (vizManifest?.options) {
          ExtensionManager.visualizerOptions.set(fullId, vizManifest.options);
        }
        if (vizManifest?.name) {
          ExtensionManager.visualizerNames.set(fullId, vizManifest.name);
        }
      },
    };

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

// ─── Extension Manager ───────────────────────────────────────────────

export default class ExtensionManager {
  public static extensions: Map<string, Extension> = new Map();
  public static visualizerRenderers: Map<string, VisualizerRendererFn> = new Map();
  public static visualizerOptions: Map<string, VisualizerStyleOption[]> = new Map();
  public static visualizerNames: Map<string, string> = new Map();
  public static extensionThemes: Map<string, Theme> = new Map();

  /**
   * Limits for an extension package, against zip bombs.
   */
  private static readonly MAX_ZIP_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
  private static readonly MAX_ZIP_ENTRIES = 5000;

  /**
   * Called after the installed or enabled extensions changed (set by the settings sync, which records it).
   */
  public static onChange: (() => void) | null = null;

  public static getExtensionsDir(): string {
    return CrossPlatform.getToxenDataPath("extensions");
  }

  /**
   * Scan the extensions directory and discover all extensions.
   */
  public static async discover(): Promise<void> {
    const fs = await import("fs");
    const fsp = fs.promises;

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
      if (entry.startsWith(".")) continue; // Staging folders of installs in progress
      const ext = await this._readExtensionDir(extDir, entry, enabledMap);
      if (!ext) continue;
      this.extensions.set(ext.manifest.id, ext);

      // Register themes from manifest (themes are data-driven, don't need JS)
      if (ext.enabled) {
        this.registerThemesFromManifest(ext.manifest);
      }
    }

    console.log(`[Extensions] Discovered ${this.extensions.size} extension(s).`);
    this.onChange?.();
  }

  /**
   * Read the extension in `<extDir>/<entry>` without registering or loading it.
   * @returns `null` when the folder isn't a valid extension.
   */
  private static async _readExtensionDir(extDir: string, entry: string, enabledMap: Record<string, boolean>): Promise<Extension | null> {
    const fsp = (await import("fs")).promises;
    const Path = await import("path");
    const extPath = Path.resolve(extDir, entry);
    const manifestPath = Path.resolve(extPath, "extension.json");

    try {
      if (!(await fsp.stat(extPath)).isDirectory()) return null;
    } catch { return null; }

    let manifestRaw: string;
    try {
      manifestRaw = await fsp.readFile(manifestPath, "utf-8");
    } catch { return null; }

    let manifest: ExtensionManifest;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (e) {
      console.error(`[Extensions] Invalid extension.json in "${entry}":`, e);
      return null;
    }

    if (!manifest.id || !manifest.name) {
      console.error(`[Extensions] Extension in "${entry}" missing required id/name fields.`);
      return null;
    }

    return new Extension(manifest, extPath, enabledMap[manifest.id] ?? true); // New extensions enabled by default
  }

  /**
   * Install (or replace) an extension from its store zip into `<extensions>/<extensionId>`. Doesn't load it: use
   * `reloadInstalled()` afterwards. The zip must hold an `extension.json` with a matching `id` at its root. Whatever goes
   * wrong, the previously installed version stays in place.
   * @throws If the zip is invalid, too large, or can't be swapped in.
   */
  public static async installZip(extensionId: string, zip: ArrayBuffer): Promise<void> {
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Installing extensions");
    const desktop = toxenapi;
    const yauzl = await import("yauzl");
    const fsp = (await import("fs")).promises;
    const Path = await import("path");

    const extDir = this.getExtensionsDir();
    const targetDir = desktop.safeJoinInside(extDir, extensionId);
    // Extract next to the target and swap it in only once extraction succeeded, so a bad download keeps the old version.
    // Dot-prefixed, so `discover()` skips leftover staging and backup folders.
    const stagingDir = desktop.safeJoinInside(extDir, `.installing-${extensionId}`);
    const backupDir = desktop.safeJoinInside(extDir, `.old-${extensionId}`);
    await fsp.rm(stagingDir, { recursive: true, force: true });
    await fsp.mkdir(stagingDir, { recursive: true });

    try {
      await this._extractZip(yauzl, zip, stagingDir);

      let manifest: Partial<ExtensionManifest>;
      try {
        manifest = JSON.parse(await fsp.readFile(Path.join(stagingDir, "extension.json"), "utf-8"));
      } catch (error) {
        if (error?.code === "ENOENT") throw new Error("The extension package is missing extension.json at its root.");
        throw new Error("The extension package has an invalid extension.json.");
      }
      if (manifest?.id !== extensionId) throw new Error("The package's extension id doesn't match the store entry.");
    } catch (error) {
      await fsp.rm(stagingDir, { recursive: true, force: true });
      throw error;
    }

    // Move the old version aside instead of deleting it, so it can be put back if the new one can't be moved in.
    await fsp.rm(backupDir, { recursive: true, force: true });
    const hadOld = await fsp.stat(targetDir).then(() => true).catch(() => false);
    try {
      if (hadOld) await fsp.rename(targetDir, backupDir);
    } catch (error) {
      await fsp.rm(stagingDir, { recursive: true, force: true });
      throw new Error(`Couldn't replace the installed extension (${error?.message ?? error}). Close anything using its files and try again.`);
    }
    try {
      await fsp.rename(stagingDir, targetDir);
    } catch (error) {
      if (hadOld) await fsp.rename(backupDir, targetDir).catch(rollbackError => console.error("[Extensions] Couldn't restore the previous version:", rollbackError));
      await fsp.rm(stagingDir, { recursive: true, force: true });
      throw new Error(`Couldn't move the new extension into place (${error?.message ?? error}).`);
    }
    if (hadOld) await fsp.rm(backupDir, { recursive: true, force: true }).catch(error => console.warn("[Extensions] Couldn't remove the previous version:", error));
  }

  /**
   * Re-read the installed extension `id` from disk: unload the running instance (if any) and load the new one. Other
   * extensions are untouched.
   * @returns `false` when there's no valid extension with that id on disk.
   */
  public static async reloadInstalled(id: string): Promise<boolean> {
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Installing extensions");
    const existing = this.extensions.get(id);
    if (existing) {
      existing.unload();
      this.unregisterThemesFromManifest(existing.manifest);
      this.extensions.delete(id);
    }

    const enabledMap = Settings.get("enabledExtensions") ?? {};
    if (existing) enabledMap[id] ??= existing.enabled; // Keep the state of a re-install
    const ext = await this._readExtensionDir(this.getExtensionsDir(), id, enabledMap);
    if (!ext || ext.manifest.id !== id) {
      this.onChange?.();
      return false;
    }

    this.extensions.set(id, ext);
    if (ext.enabled) {
      this.registerThemesFromManifest(ext.manifest);
      await ext.load();
    }
    this.onChange?.();
    return true;
  }

  /**
   * Extract `zip` into `targetDir`, refusing entries that would land outside it.
   */
  private static async _extractZip(yauzl: typeof import("yauzl"), zip: ArrayBuffer, targetDir: string): Promise<void> {
    if (!toxenapi.isDesktop()) return toxenapi.throwDesktopOnly("Installing extensions");
    const desktop = toxenapi;
    const fs = await import("fs");
    const fsp = fs.promises;
    const Path = await import("path");

    await new Promise<void>((resolve, reject) => {
      yauzl.fromBuffer(Buffer.from(zip), { lazyEntries: true }, (err: Error | null, zipfile: any) => {
        if (err || !zipfile) return reject(err ?? new Error("The extension package couldn't be read."));

        // `fail` and `done` settle the promise exactly once; every error path below goes through `fail`.
        let settled = false;
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          zipfile.close();
          reject(error);
        };

        if (zipfile.entryCount > ExtensionManager.MAX_ZIP_ENTRIES) {
          return fail(new Error(`The extension package has too many files (limit ${ExtensionManager.MAX_ZIP_ENTRIES}).`));
        }

        // yauzl validates the real stream size against the declared one, so the declared sizes can be trusted.
        let totalSize = 0;
        zipfile.on("entry", (entry: any) => {
          totalSize += entry.uncompressedSize;
          if (totalSize > ExtensionManager.MAX_ZIP_UNCOMPRESSED_SIZE) {
            return fail(new Error(`The extension package is too large once unpacked (limit ${ExtensionManager.MAX_ZIP_UNCOMPRESSED_SIZE / 1024 / 1024} MB).`));
          }
          if (/\/$/.test(entry.fileName)) return zipfile.readEntry();

          zipfile.openReadStream(entry, (err: Error | null, readStream: any) => {
            if (err || !readStream) return fail(err ?? new Error(`Couldn't read "${entry.fileName}" from the extension package.`));
            // Listen right away: an error before the output file is open would otherwise be unhandled.
            let writeStream: import("fs").WriteStream | null = null;
            readStream.on("error", (error: Error) => {
              writeStream?.destroy();
              fail(error);
            });
            (async () => {
              const outPath = desktop.safeJoinInside(targetDir, entry.fileName);
              await fsp.mkdir(Path.dirname(outPath), { recursive: true });
              if (settled) return readStream.destroy();
              writeStream = fs.createWriteStream(outPath);
              writeStream.on("error", (error: Error) => {
                readStream.destroy();
                fail(error);
              });
              writeStream.on("close", () => {
                if (!settled) zipfile.readEntry();
              });
              readStream.pipe(writeStream);
            })().catch(error => {
              readStream.destroy();
              fail(error);
            });
          });
        });
        zipfile.on("end", () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        zipfile.on("error", fail);
        zipfile.on("close", () => fail(new Error("The extension package ended unexpectedly.")));
        zipfile.readEntry();
      });
    });
  }

  /**
   * Install an extension from the extension store by its `extensionId` (the id in `extension.json`), then load it.
   * @returns `false` when the store has no extension with that id.
   * @throws If the store can't be reached or the download fails.
   */
  public static async installFromStore(extensionId: string): Promise<boolean> {
    const headers = this.getStoreHeaders();
    const list = await fetch(`${Settings.getServer()}/extensions/store?search=${encodeURIComponent(extensionId)}`, { headers });
    if (!list.ok) throw new Error(`The extension store answered ${list.status}.`);
    const found = (await list.json() as { id: number; extensionId: string }[]).find(ext => ext.extensionId === extensionId);
    if (!found) return false;
    return this.installFromStoreId(found.id, extensionId);
  }

  /**
   * Install one specific store version by its numeric store record id (the `<id>` of `toxen://extension/<id>`), then load it.
   * @param id Store record id (`Site.StoreExtension.id`).
   * @param extensionId The `id` from the extension's `extension.json`. Looked up from the store when omitted.
   * @returns `false` when the store has no approved extension with that id.
   * @throws If the store can't be reached or the download fails.
   */
  public static async installFromStoreId(id: number, extensionId?: string): Promise<boolean> {
    if (!Number.isInteger(id) || id < 0) throw new Error("That isn't a valid extension id.");
    const server = Settings.getServer();
    const headers = this.getStoreHeaders();
    if (!extensionId) {
      const detail = await fetch(`${server}/extensions/store/${id}`, { headers });
      if (detail.status === 404) return false;
      if (!detail.ok) throw new Error(`The extension store answered ${detail.status}.`);
      extensionId = (await detail.json() as { extensionId: string }).extensionId;
    }
    const res = await fetch(`${server}/extensions/store/${id}/download`, { headers });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Downloading the extension "${extensionId}" failed with ${res.status}.`);
    await this.installZip(extensionId, await res.arrayBuffer());
    // Only after the new files are in place: a failed install above leaves the running extension alone.
    if (!await this.reloadInstalled(extensionId)) throw new Error(`The installed package for "${extensionId}" isn't a valid extension.`);
    return true;
  }

  /**
   * Request headers for the extension store: the logged in user's token, when there is one.
   */
  private static getStoreHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = User.getCurrentUser()?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  /**
   * Unload and delete an installed extension.
   */
  public static async uninstall(id: string): Promise<void> {
    const ext = this.extensions.get(id);
    if (!ext) return;
    ext.unload();
    this.unregisterThemesFromManifest(ext.manifest);
    this.extensions.delete(id);
    const fs = await import("fs");
    await fs.promises.rm(ext.dirPath, { recursive: true, force: true });
    this.onChange?.();
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
      Settings.set("visualizerStyle", "ext:whaleshark:whaleshark" as any, { track: false });
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
    this.onChange?.();
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
    this.onChange?.();
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
