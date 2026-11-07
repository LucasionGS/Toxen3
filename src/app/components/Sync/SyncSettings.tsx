import React, { useState } from "react";
import { Alert, Button, Checkbox, Group, Menu, Progress, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconArrowUpCircle, IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import SyncEngine from "../../toxen/sync/SyncEngine";
import type { Merge } from "../../toxen/sync/Merge";
import User from "../../toxen/User";
import { openSyncConflictModal } from "../SyncConflicts/SyncConflictModal";
import { STORAGE_TIERS, openUpgradeCheckout } from "./billing";
import { formatAgo, formatBytes } from "./format";
import { getSyncAuto, readAutoDownload, setSyncAuto, useSyncConflicts, useSyncSummary } from "./useSync";
import "./SyncSettings.scss";

/**
 * Storage use above this share of the quota shows the Upgrade button.
 */
const UPGRADE_THRESHOLD = 0.8;

const STATE_TEXT: Record<SyncEngine.Summary["state"], string> = {
  disabled: "Sync is off",
  idle: "Up to date",
  syncing: "Syncing…",
  offline: "Offline. Changes will sync when you're back online.",
  error: "Some songs couldn't be synced",
};

/**
 * Settings > Sync: auto-sync, per-device download, status, storage and unresolved conflicts.
 */
export default function SyncSettings() {
  const user = User.getCurrentUser();
  if (!user) {
    return (
      <>
        <h2>Sync</h2>
        <Alert color="blue">Log in from the Account tab to keep your library in the cloud and on all your devices.</Alert>
      </>
    );
  }

  return (
    <>
      <h2>Sync</h2>
      <Stack gap="md" className="sync-settings">
        <SyncToggles />
        <SyncStatus />
        <SyncStorage />
        <SyncConflictList />
      </Stack>
    </>
  );
}

function SyncToggles() {
  const [auto, setAuto] = useState(getSyncAuto);
  const [autoDownload, setAutoDownload] = useState(readAutoDownload);

  return (
    <div>
      <Checkbox
        checked={auto}
        onChange={e => {
          const enabled = e.currentTarget.checked;
          setAuto(enabled);
          setSyncAuto(enabled).catch(error => Toxen.error(`Couldn't save the setting: ${error instanceof Error ? error.message : String(error)}`));
        }}
        label="Auto-sync"
      />
      <sup>
        Keeps your library up to date in the cloud and on your other devices in the background.
      </sup>
      {toxenapi.isDesktop() && (
        <>
          <Checkbox
            mt="sm"
            checked={autoDownload}
            onChange={e => {
              const enabled = e.currentTarget.checked;
              try {
                SyncEngine.setAutoDownload(enabled);
                setAutoDownload(enabled);
              } catch (error) {
                Toxen.error(`Couldn't save the setting: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            label="Automatically download new cloud songs on this device"
          />
          <sup>
            This setting only applies to this device. Leave it off to keep new songs in the cloud until you choose
            to download them. Songs you made available offline always stay downloaded.
          </sup>
        </>
      )}
    </div>
  );
}

function SyncStatus() {
  const summary = useSyncSummary();
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await SyncEngine.syncNow();
    } catch (error) {
      Toxen.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    setSyncing(false);
  };

  return (
    <div>
      <h3>Status</h3>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Text size="sm" fw={600}>{STATE_TEXT[summary.state]}</Text>
          <Text size="xs" c="dimmed">
            Last sync: {summary.lastSyncAt === null ? "never" : formatAgo(summary.lastSyncAt)}
          </Text>
          <Text size="xs" c="dimmed">
            {summary.pending === 0 ? "Nothing waiting to sync" : `${summary.pending} ${summary.pending === 1 ? "change" : "changes"} waiting`}
          </Text>
          {summary.errors > 0 && (
            <Text size="xs" c="var(--error-color)">
              {summary.errors} {summary.errors === 1 ? "song" : "songs"} failed. Toxen will try again automatically.
            </Text>
          )}
        </Stack>
        <Button
          size="xs"
          leftSection={<IconRefresh size="1em" />}
          loading={syncing || summary.state === "syncing"}
          disabled={summary.state === "disabled"}
          onClick={syncNow}
        >
          Sync now
        </Button>
      </Group>
    </div>
  );
}

function SyncStorage() {
  const summary = useSyncSummary();
  const user = User.getCurrentUser();
  const used = summary.storageUsed ?? user?.storage_used ?? null;
  const quota = summary.storageQuota ?? user?.storage_quota ?? null;
  const [upgrading, setUpgrading] = useState(false);
  if (used === null || !quota) return null;

  const share = used / quota;
  const color = share >= 1 ? "var(--error-color)" : (share >= UPGRADE_THRESHOLD ? "var(--warning-color)" : "var(--accent-color)");
  const upgrades = STORAGE_TIERS.filter(tier => tier.bytes > quota);

  const upgrade = async (tier: typeof STORAGE_TIERS[number]) => {
    setUpgrading(true);
    try {
      await openUpgradeCheckout(tier.id);
    } catch (error) {
      Toxen.error(error instanceof Error ? error.message : String(error));
    }
    setUpgrading(false);
  };

  return (
    <div>
      <h3>Cloud storage</h3>
      <Progress value={Math.min(100, share * 100)} color={color} size="md" radius="xl" />
      <Group justify="space-between" mt={6} wrap="nowrap">
        <Text size="sm">{formatBytes(used)} of {formatBytes(quota)} used</Text>
        {share >= UPGRADE_THRESHOLD && upgrades.length > 0 && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button size="xs" loading={upgrading} leftSection={<IconArrowUpCircle size="1em" />} rightSection={<IconChevronDown size="1em" />}>
                Upgrade
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {upgrades.map(tier => (
                <Menu.Item key={tier.id} onClick={() => upgrade(tier)}>
                  {tier.name} ({formatBytes(tier.bytes)})
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {summary.readOnly && (
        <Alert mt="xs" color="yellow" icon={<IconAlertTriangle size="1em" />}>
          Your cloud storage is over its limit. You can still play and download your songs, but nothing new can be
          uploaded until you free up space or upgrade.
        </Alert>
      )}
    </div>
  );
}

/**
 * How many things in a record the user can review.
 */
export function countConflictItems(record: Merge.ConflictRecord): number {
  return record.items.reduce((total, item) => total + (item.type === "info" ? item.fields.length : 1), 0);
}

function SyncConflictList() {
  const records = useSyncConflicts();
  return (
    <div>
      <h3>Unresolved conflicts</h3>
      {records.length === 0 ? (
        <Text size="sm" c="dimmed">No conflicts. Nothing needs your attention.</Text>
      ) : (
        <Stack gap="xs">
          {records.map(record => {
            const count = countConflictItems(record);
            return (
              <Group key={record.id} justify="space-between" wrap="nowrap" className="sync-settings__conflict">
                <div className="sync-settings__conflict-name">
                  <Text size="sm" fw={600} truncate>{record.songName}</Text>
                  <Text size="xs" c="dimmed">{count} {count === 1 ? "conflict" : "conflicts"} · {formatAgo(record.createdAt)}</Text>
                </div>
                <Button size="xs" variant="light" onClick={() => openSyncConflictModal(record.uid)}>Review</Button>
              </Group>
            );
          })}
          {records.length > 1 && <Button size="xs" variant="default" onClick={() => openSyncConflictModal()}>Review all</Button>}
        </Stack>
      )}
    </div>
  );
}
