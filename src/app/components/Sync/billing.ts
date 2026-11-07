import { Toxen } from "../../ToxenApp";
import Settings from "../../toxen/Settings";

/**
 * A paid storage tier. `bytes` is the quota it gives (plan §8.1).
 */
export interface StorageTier {
  id: "basic" | "pro" | "ultimate";
  name: string;
  bytes: number;
}

const GB = 1024 * 1024 * 1024;

export const STORAGE_TIERS: readonly StorageTier[] = [
  { id: "basic", name: "Basic", bytes: 10 * GB },
  { id: "pro", name: "Pro", bytes: 25 * GB },
  { id: "ultimate", name: "Ultimate", bytes: 100 * GB },
];

/**
 * Create a checkout for a tier on the server and open it in the browser.
 * @throws If the server refuses or can't be reached.
 */
export async function openUpgradeCheckout(tier: StorageTier["id"]): Promise<void> {
  const response = await Toxen.fetch(`${Settings.getServer()}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  const body = await response.json().catch((): null => null) as { checkoutUrl?: string; error?: string } | null;
  if (!response.ok || !body?.checkoutUrl) throw new Error(body?.error ?? "The server couldn't start the checkout. Try again later.");

  if (toxenapi.isDesktop()) toxenapi.remote.shell.openExternal(body.checkoutUrl);
  else window.open(body.checkoutUrl, "_blank", "noopener");
}
