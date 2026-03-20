import React, { useEffect, useState } from "react";
import { Badge, Button, Group, Loader, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCrown, IconStar, IconStarFilled, IconRocket } from "@tabler/icons-react";
import Settings from "../../../../toxen/Settings";
import User from "../../../../toxen/User";
import { Toxen } from "../../../../ToxenApp";
import SidepanelSectionHeader from "../../SidepanelSectionHeader";
import "./SubscriptionPanel.scss";

// ─── Plan definitions ─────────────────────────────────────────────────────────

interface PlanDef {
  tier: string;
  label: string;
  price: string;
  color: string;
  icon: React.ReactNode;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    tier: "basic",
    label: "Basic",
    price: "$6.99 / month",
    color: "blue",
    icon: <IconStar size={20} />,
    features: [
      "Stream your music anywhere",
      "Upload up to 10 GB",
      "128 kbps streaming quality",
    ],
  },
  {
    tier: "pro",
    label: "Pro",
    price: "$12.99 / month",
    color: "violet",
    icon: <IconStarFilled size={20} />,
    features: [
      "Everything in Basic",
      "Upload up to 25 GB",
      "320 kbps streaming quality",
    ],
  },
  {
    tier: "ultimate",
    label: "Ultimate",
    price: "$19.99 / month",
    color: "yellow",
    icon: <IconCrown size={20} />,
    features: [
      "Everything in Pro",
      "Upload up to 100 GB",
      "Lossless streaming",
    ],
  },
];

// ─── Subscription status shape returned by GET /billing/subscription ──────────

interface BillingStatus {
  active: boolean;
  tier: string | null;
  expiresAt: string | null;
  hasPaddleSubscription: boolean;
}

// ─── Open URL in the system browser ──────────────────────────────────────────

function openUrl(url: string) {
  if (toxenapi.isDesktop()) {
    toxenapi.remote.shell.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionPanel() {
  const user = User.getCurrentUser();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await Toxen.fetch(Settings.getServer() + "/billing/subscription");
      if (res.ok) setStatus(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(tier: string) {
    setCheckingOut(tier);
    try {
      const res = await Toxen.fetch(Settings.getServer() + "/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Checkout failed.");
      openUrl(body.checkoutUrl);
    } catch (err: unknown) {
      notifications.show({
        color: "red",
        title: "Could not start checkout",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setCheckingOut(null);
    }
  }

  async function handlePortal() {
    setOpeningPortal(true);
    try {
      const res = await Toxen.fetch(Settings.getServer() + "/billing/portal", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Portal unavailable.");
      openUrl(body.portalUrl);
    } catch (err: unknown) {
      notifications.show({
        color: "red",
        title: "Could not open billing portal",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setOpeningPortal(false);
    }
  }

  const currentTier = status?.tier ?? user?.premium_tier ?? null;
  const isActive = status?.active ?? user?.premium ?? false;

  return (
    <>
      <SidepanelSectionHeader>
        <h1>Subscription</h1>
      </SidepanelSectionHeader>

      {/* ── Current status ── */}
      <div className="sub-panel__status">
        {loading ? (
          <Loader size="sm" />
        ) : isActive && currentTier ? (
          <Stack gap="xs">
            <Group gap="xs">
              <IconRocket size={16} />
              <Text size="sm" fw={600}>
                Active subscription
              </Text>
              <Badge color={PLANS.find(p => p.tier === currentTier)?.color ?? "gray"} size="sm">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Badge>
            </Group>
            {status?.expiresAt && (
              <Text size="xs" c="dimmed">
                Renews {new Date(status.expiresAt).toLocaleDateString()}
              </Text>
            )}
            {status?.hasPaddleSubscription && (
              <Button
                variant="light"
                size="xs"
                loading={openingPortal}
                onClick={handlePortal}
              >
                Manage / cancel subscription
              </Button>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            You are currently on the <strong>free</strong> plan.
          </Text>
        )}
      </div>

      {/* ── Plan cards ── */}
      <div className="sub-panel__plans">
        {PLANS.map((plan) => {
          const isCurrentTier = isActive && currentTier === plan.tier;
          const isBusy = checkingOut === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`sub-panel__card${isCurrentTier ? " sub-panel__card--active" : ""}`}
              data-tier={plan.tier}
            >
              <div className="sub-panel__card-header">
                <ThemeIcon color={plan.color} size="lg" variant="light" radius="md">
                  {plan.icon}
                </ThemeIcon>
                <div>
                  <Title order={4} className="sub-panel__card-title">{plan.label}</Title>
                  <Text size="xs" c="dimmed">{plan.price}</Text>
                </div>
                {isCurrentTier && (
                  <Badge color={plan.color} size="xs" className="sub-panel__current-badge">
                    Current
                  </Badge>
                )}
              </div>

              <ul className="sub-panel__features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <IconCheck size={12} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                fullWidth
                variant={isCurrentTier ? "light" : "filled"}
                color={plan.color}
                size="sm"
                loading={isBusy}
                disabled={isCurrentTier || (isActive && !isCurrentTier && status?.hasPaddleSubscription)}
                onClick={() => handleSubscribe(plan.tier)}
                title={
                  isCurrentTier
                    ? "This is your current plan"
                    : isActive && status?.hasPaddleSubscription
                      ? "Change tier via the billing portal"
                      : `Subscribe to ${plan.label}`
                }
              >
                {isCurrentTier ? "Current plan" : "Subscribe"}
              </Button>
            </div>
          );
        })}
      </div>

      <Text size="xs" c="dimmed" style={{ padding: "8px 12px 16px", textAlign: "center" }}>
        Payments are securely handled by Paddle.
        To change tiers, use the <em>Manage subscription</em> button above.
      </Text>
    </>
  );
}
