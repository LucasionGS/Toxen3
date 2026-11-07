import React from "react";
import { Button, Group } from "@mantine/core";
import { hideNotification } from "@mantine/notifications";
import { Toxen } from "../../ToxenApp";
import SyncEngine from "../../toxen/sync/SyncEngine";
import { SongLibrary } from "../../toxen/SongLibrary";
import type { Merge } from "../../toxen/sync/Merge";
import { openSyncConflictModal } from "../SyncConflicts/SyncConflictModal";
import { SyncV2 } from "../../toxen/sync/SyncApi";
import { countConflictItems } from "./useSync";

/**
 * Shortest time between two notifications of the same kind. Unit is in ms.
 */
const REPEAT_MS = 5 * 60 * 1000;

const lastShown = new Map<string, number>();

/**
 * Whether a notification of this kind may be shown now, and if so remember that it was.
 */
function throttle(kind: string): boolean {
  const now = Date.now();
  const previous = lastShown.get(kind);
  if (previous !== undefined && now - previous < REPEAT_MS) return false;
  lastShown.set(kind, now);
  return true;
}

/**
 * Tell the user a conflict was auto-resolved, with a button that opens the review.
 */
export function notifyConflict(record: Merge.ConflictRecord): void {
  const count = countConflictItems(record);
  const id = Toxen.notify({
    title: "Sync conflict",
    type: "warning",
    expiresIn: 15000,
    content: (
      <div>
        <p>{count === 1 ? "1 sync conflict" : `${count} sync conflicts`} in '{record.songName}'</p>
        <Group>
          <Button size="xs" color="green" onClick={() => {
            hideNotification(id);
            openSyncConflictModal(record.uid);
          }}>
            Review
          </Button>
        </Group>
      </div>
    ),
  });
}

/**
 * Tell the user that a deleted song, or some of its files, came back because it was edited on one side and deleted on
 * the other. The engine reports it when the edit beats the delete.
 */
export function notifyKept(kept: SyncEngine.Kept): void {
  const files = kept.paths.length;
  let content: string;
  if (kept.kept === "local") {
    content = files === 0
      ? `Kept your edited copy of ${kept.songName}. It was deleted on another device after you changed it here.`
      : `Kept your changes to ${files === 1 ? "a file" : `${files} files`} in ${kept.songName}. ${files === 1 ? "It was" : "They were"} deleted on another device after you changed ${files === 1 ? "it" : "them"} here.`;
  }
  else {
    content = files === 0
      ? `Kept the edited copy of ${kept.songName} from another device. It was deleted here after it changed there.`
      : `Kept ${files === 1 ? "a file" : `${files} files`} of ${kept.songName} that changed on another device. ${files === 1 ? "It was" : "They were"} deleted here.`;
  }
  Toxen.notify({
    title: "Song kept",
    type: "normal",
    expiresIn: 8000,
    content,
  });
}

/**
 * Synced songs went missing from the library folder: ask before sync deletes them from the cloud.
 */
export function notifyMissingSongs(message: string): void {
  const id = Toxen.notify({
    title: "Songs missing from your library",
    type: "warning",
    content: (
      <div>
        <p>{message}</p>
        <Group>
          <Button size="xs" color="red" onClick={() => {
            hideNotification(id);
            SyncEngine.confirmMissingDeletes();
          }}>
            Delete them from the cloud
          </Button>
          <Button size="xs" color="gray" onClick={() => hideNotification(id)}>Keep them</Button>
        </Group>
      </div>
    ),
  });
}

/**
 * Tell the user the cloud is full, with the engine's own wording of how full.
 */
export function notifyStorageFull(reason: string): void {
  if (!throttle("quota")) return;
  Toxen.notify({
    title: "Cloud storage is full",
    type: "warning",
    expiresIn: 10000,
    content: `${reason} Your songs are safe, and downloads still work.`,
  });
}

function notifyServerTooOld(): void {
  if (!throttle("server-old")) return;
  Toxen.notify({
    title: "Can't sync",
    type: "error",
    expiresIn: 10000,
    content: "Your server needs an update to sync. Your library keeps working on this device.",
  });
}

function onError(failure: SyncEngine.Failure): void {
  if (failure.code === "server-outdated") return notifyServerTooOld();
  // Reported by the summary, which also covers uploads that stay paused
  if (failure.code === SyncV2.ErrorCode.QuotaExceeded) return;
  if (failure.code === "missing-songs") return notifyMissingSongs(failure.message);
  const song = failure.uid ? SongLibrary.getSong(failure.uid) : null;
  Toxen.error(song ? `Sync of "${song.getDisplayName()}" failed: ${failure.message}` : `Sync failed: ${failure.message}`, 8000);
}

let uploadsBlockedShown: string | null = null;

function onSummary(summary: SyncEngine.Summary): void {
  const reason = summary.uploadsBlockedReason;
  // Only the moment uploads get blocked; the reason text changes as the usage does
  if (reason && uploadsBlockedShown === null) notifyStorageFull(reason);
  uploadsBlockedShown = reason;
}

let initialized = false;

/**
 * Turn sync engine events into notifications: conflicts (with a Review button), kept edited copies, a server that is too
 * old, a full cloud and songs missing from the library. Called once at startup by `bootstrap`; later calls do nothing.
 */
export function initSyncNotifications(): void {
  if (initialized) return;
  initialized = true;
  SyncEngine.events.on("conflict", notifyConflict);
  SyncEngine.events.on("kept", notifyKept);
  SyncEngine.events.on("error", onError);
  SyncEngine.events.on("summary", onSummary);
}
