import React from "react";
import { IconAlertCircle, IconCloud, IconCloudCheck, IconCloudDown, IconCloudPause, IconCloudUp } from "@tabler/icons-react";
import type Song from "../../toxen/Song";
import SyncEngine from "../../toxen/sync/SyncEngine";
import { useSongSyncStatus } from "../Sync/useSync";
import { openSyncConflictModal } from "../SyncConflicts/SyncConflictModal";
import "./SyncBadge.scss";

export interface SyncBadgeProps {
  /** The song this badge belongs to. */
  song: Song;
}

const RING_RADIUS = 9;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * What a status looks like: icon, modifier class and hover text. `null` means no badge.
 */
function describe(status: SyncEngine.SongStatus): { icon: React.ReactNode; modifier: string; title: string } | null {
  const percent = status.progress === null ? null : Math.round(status.progress * 100);
  switch (status.status) {
    case SyncEngine.Status.LocalOnly:
      return null;
    case SyncEngine.Status.CloudOnly:
      // On the web every song is a cloud song, so the icon would be on every row
      return toxenapi.isDesktop() ? { icon: <IconCloud size="1em" />, modifier: "cloud", title: "In the cloud. Not downloaded to this device." } : null;
    case SyncEngine.Status.Synced:
      return { icon: <IconCloudCheck size="1em" />, modifier: "synced", title: "Synced" };
    case SyncEngine.Status.Queued:
      return { icon: <IconCloudPause size="1em" />, modifier: "queued", title: "Waiting to sync" };
    case SyncEngine.Status.Uploading:
      return { icon: <IconCloudUp size="1em" />, modifier: "transfer", title: percent === null ? "Uploading" : `Uploading ${percent}%` };
    case SyncEngine.Status.Downloading:
      return { icon: <IconCloudDown size="1em" />, modifier: "transfer", title: percent === null ? "Downloading" : `Downloading ${percent}%` };
    case SyncEngine.Status.Conflict:
      return {
        icon: <IconCloudCheck size="1em" />,
        modifier: "conflict",
        title: status.conflicts === 1 ? "1 sync conflict was resolved automatically. Click to review." : `${status.conflicts} sync conflicts were resolved automatically. Click to review.`,
      };
    case SyncEngine.Status.Error:
      return { icon: <IconAlertCircle size="1em" />, modifier: "error", title: status.error ? `Sync failed: ${status.error}` : "Sync failed. Toxen will try again." };
  }
}

/**
 * Cloud status icon for a song row (plan §2.1). Subscribes to its own song only, so a status change never re-renders the list.
 */
function SyncBadgeBase({ song }: SyncBadgeProps) {
  const status = useSongSyncStatus(song);
  const view = describe(status);
  if (!view) return null;

  const isTransfer = view.modifier === "transfer";
  const isConflict = view.modifier === "conflict";

  return (
    <span
      className={`sync-badge sync-badge--${view.modifier}${isConflict ? " sync-badge--clickable" : ""}`}
      title={view.title}
      onClick={isConflict ? e => {
        e.stopPropagation();
        openSyncConflictModal(song.uid);
      } : undefined}
    >
      {view.icon}
      {isTransfer && status.progress !== null && (
        <svg className="sync-badge__ring" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            className="sync-badge__ring-bar"
            cx="12" cy="12" r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - status.progress)}
          />
        </svg>
      )}
      {isConflict && <span className="sync-badge__dot" />}
    </span>
  );
}

/**
 * Memoised so a row re-render caused by playback doesn't touch the badge.
 */
export const SyncBadge = React.memo(SyncBadgeBase);
export default SyncBadge;
