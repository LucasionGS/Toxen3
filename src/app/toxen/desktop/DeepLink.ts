import React from "react";
import { modals } from "@mantine/modals";
import { Toxen } from "../../ToxenApp";
import Settings from "../Settings";
import User from "../User";
import ExtensionManager from "../extensions/ExtensionManager";

/**
 * Handles `toxen://` links forwarded by the main process (see `src/main.ts`). Links come from outside the app, so
 * nothing here acts on one without parsing it strictly, and extensions are never installed without a confirmation.
 *
 * | Link | Does |
 * |---|---|
 * | `toxen://open` | Nothing more than focusing the window (main already did) |
 * | `toxen://extension/<storeId>` | Asks to install that store version |
 * | `toxen://premium` | Refreshes the account and opens the storage and upgrade settings |
 */
export class DeepLink {
  private constructor() { }

  private static readonly CHANNEL = "toxen:deep-link";
  private static readonly READY_CHANNEL = "toxen:deep-link-ready";
  private static readonly SCHEME = "toxen://";

  private static initialized = false;

  /**
   * Start listening for links from the main process. Links that arrived during startup are delivered right away.
   * Does nothing on web, and only the first call has an effect.
   */
  public static init(): void {
    if (DeepLink.initialized || !toxenapi.isDesktop()) return;
    DeepLink.initialized = true;
    // Direct `electron` access is fine here: the renderer runs with nodeIntegration (see DesktopController.getFilePath).
    const { ipcRenderer } = require("electron") as typeof import("electron");
    ipcRenderer.on(DeepLink.CHANNEL, (_event, url: unknown) => {
      if (typeof url !== "string") return;
      DeepLink.handle(url).catch(error => {
        console.error(error);
        Toxen.error(`Couldn't open the link: ${error?.message ?? error}`);
      });
    });
    ipcRenderer.send(DeepLink.READY_CHANNEL);
  }

  /**
   * Parse a `toxen://` URL.
   * @returns The action, or `null` when the URL isn't a recognized and well-formed link.
   */
  public static parse(url: string): DeepLink.Action | null {
    if (url.length > 2048 || !url.toLowerCase().startsWith(DeepLink.SCHEME)) return null;
    const path = url.slice(DeepLink.SCHEME.length).split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
    const [action, ...args] = path.split("/");
    switch (action.toLowerCase()) {
      case "open":
        return args.length === 0 ? { type: "open" } : null;
      case "premium":
        return args.length === 0 ? { type: "premium" } : null;
      case "extension": {
        if (args.length !== 1 || !/^\d+$/.test(args[0])) return null;
        const storeId = Number(args[0]);
        return Number.isSafeInteger(storeId) ? { type: "extension", storeId } : null;
      }
      default:
        return null;
    }
  }

  /**
   * Run a link. Unknown or malformed links are ignored; the window was already brought forward by the main process.
   */
  public static async handle(url: string): Promise<void> {
    const action = DeepLink.parse(url);
    if (!action) {
      console.warn("Ignoring an unrecognized toxen:// link.");
      return;
    }
    await Toxen.whenReady();
    if (Toxen.startupFailed) return; // Settings didn't load: installing or saving now could overwrite the user's data
    switch (action.type) {
      case "open":
        return;
      case "extension":
        return DeepLink.handleExtension(action.storeId);
      case "premium":
        return DeepLink.handlePremium();
    }
  }

  /**
   * Look the extension up, ask the user, and only then download and install it.
   */
  private static async handleExtension(storeId: number): Promise<void> {
    const detail = await DeepLink.fetchDetail(storeId);
    if (!detail) return;
    const installed = ExtensionManager.extensions.get(detail.extensionId)?.manifest.version;

    modals.openConfirmModal({
      title: `Install ${detail.name}?`,
      centered: true,
      labels: { confirm: installed ? "Replace" : "Install", cancel: "Cancel" },
      children: React.createElement("div", null,
        React.createElement("p", null, `${detail.name} ${detail.version} by ${detail.authorName}`),
        detail.description ? React.createElement("p", null, detail.description) : null,
        installed ? React.createElement("p", null, `This will replace version ${installed} with ${detail.version}.`) : null,
        React.createElement("p", null,
          React.createElement("b", null, "Only install extensions you trust. "),
          "Extensions run code on your computer."
        ),
      ),
      onConfirm: () => {
        DeepLink.install(detail).catch(error => {
          console.error(error);
          Toxen.error(`Couldn't install ${detail.name}: ${error?.message ?? error}`);
        });
      },
    });
  }

  /**
   * Download and install a confirmed extension.
   */
  private static async install(detail: DeepLink.StoreDetail): Promise<void> {
    const found = await ExtensionManager.installFromStoreId(detail.id, detail.extensionId);
    if (!found) throw new Error("The extension store no longer has this extension.");
    Toxen.log(`Installed ${detail.name} ${detail.version}.`);
  }

  /**
   * Fetch the public store record. Shows an error and returns `null` when it can't be used.
   */
  private static async fetchDetail(storeId: number): Promise<DeepLink.StoreDetail | null> {
    let response: Response;
    try {
      response = await fetch(`${Settings.getServer()}/extensions/store/${storeId}`, { signal: AbortSignal.timeout(15000) });
    } catch (error) {
      Toxen.error(`Couldn't reach the extension store: ${error?.message ?? error}`);
      return null;
    }
    if (response.status === 404) {
      Toxen.error("That extension isn't available in the extension store.");
      return null;
    }
    if (!response.ok) {
      Toxen.error(`The extension store answered ${response.status}. Try again later.`);
      return null;
    }
    const body = await response.json().catch((): null => null) as Partial<DeepLink.StoreDetail> | null;
    if (!body || body.id !== storeId || typeof body.extensionId !== "string" || typeof body.name !== "string"
      || typeof body.version !== "string" || typeof body.authorName !== "string") {
      Toxen.error("The extension store sent an unexpected answer.");
      return null;
    }
    return body as DeepLink.StoreDetail;
  }

  /**
   * Pick up a purchase made in the browser: refresh the account, then show the storage and upgrade settings.
   */
  private static async handlePremium(): Promise<void> {
    const loggedIn = Boolean(User.getCurrentUser());
    if (loggedIn) await User.refreshUser().catch(error => console.warn("Unable to refresh the account:", error));

    // The settings panel reads the open tab on mount, so it has to be remounted to land on the right one.
    window.localStorage.setItem("settings-tab-index", loggedIn ? "Sync" : "Account");
    const panel = Toxen.sidePanel;
    if (!panel) return;
    if (!panel.isShowing()) await panel.show(true);
    if (panel.state.sectionId === "settings") await panel.reloadSection();
    else await panel.setSectionId("settings");
  }
}

/**
 * Types of the deep link handler.
 */
export namespace DeepLink {
  /**
   * A link that passed validation.
   */
  export type Action =
    | { type: "open" }
    | { type: "extension"; storeId: number }
    | { type: "premium" };

  /**
   * The parts of `Site.StoreExtensionDetail` (`GET /extensions/store/:id`) that the confirmation shows.
   */
  export interface StoreDetail {
    id: number;
    extensionId: string;
    name: string;
    version: string;
    authorName: string;
    description?: string;
  }
}

export default DeepLink;
